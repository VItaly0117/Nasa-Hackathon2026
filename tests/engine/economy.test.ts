import { afterEach, describe, expect, it, vi } from "vitest";
import type { GameState, PlacedModule } from "../../src/types";
import {
  bestRecord,
  capacityOf,
  initialState,
  loadGame,
  loadRecords,
  saveGame,
  saveRecord,
  reduce,
  slotOf,
} from "../helpers/engine";
import { CARELESS, IDLE, NO_BATTERY, NO_SHELTER, PREPARED, playMission } from "../helpers/scenarios";

const SAVE_KEY = "moonbase:save";
const RECORDS_KEY = "moonbase:records";
const BASE_WATER_CAPACITY = 100;
const MAX_RECORDS = 10;

type StoredRecord = { days: number; health: number; won: boolean; at: string };

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }

  removeItem(key: string): void {
    this.values.delete(key);
  }

  seed(key: string, value: unknown): void {
    this.setItem(key, typeof value === "string" ? value : JSON.stringify(value));
  }
}

function moduleAt(slot: number, type: PlacedModule["type"]): PlacedModule {
  return { slot, type, broken: false };
}

function stateWithFullWater(extraModules: PlacedModule[]): GameState {
  const state = initialState(1);
  const iceMine = moduleAt(slotOf(0, 0), "iceMine");
  return {
    ...state,
    resources: { ...state.resources, water: BASE_WATER_CAPACITY },
    modules: [...state.modules, iceMine, ...extraModules],
  };
}

function installStorage(): MemoryStorage {
  const storage = new MemoryStorage();
  vi.stubGlobal("localStorage", storage);
  return storage;
}

function record(days: number, health: number, won: boolean, at: string): StoredRecord {
  return { days, health, won, at };
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("scripted mission outcomes", () => {
  it("Без построек миссию не пройти", () => {
    expect(playMission(IDLE, 1).status).toBe("lost");
  });

  it("Риск без построек заканчивается раньше, чем осторожность", () => {
    const idle = playMission(IDLE, 1);
    const careless = playMission(CARELESS, 1);

    expect(careless.status).toBe("lost");
    expect(careless.day).toBeLessThanOrEqual(idle.day);
  });

  it("Подготовленная база проходит миссию", () => {
    expect(playMission(PREPARED, 1).status).toBe("won");
  });

  it("Подготовленная база сохраняет здоровье (80+)", () => {
    expect(playMission(PREPARED, 1).resources.health).toBeGreaterThanOrEqual(80);
  });

  it("Без убежища вспышка стоит здоровья", () => {
    expect(playMission(NO_SHELTER, 1).resources.health).toBeLessThan(playMission(PREPARED, 1).resources.health);
  });

  it("Без батарей лунная ночь оставляет базу без энергии", () => {
    expect(playMission(NO_BATTERY, 1).history).toContainEqual(expect.objectContaining({ kind: "blackout", night: true }));
  });
});

describe("storage capacity and overflow", () => {
  it("Без склада вода не больше 100", () => {
    const next = reduce(stateWithFullWater([]), { type: "nextDay" });

    expect(next.resources.water).toBeLessThanOrEqual(BASE_WATER_CAPACITY);
  });

  it("Со складом вода копится выше 100", () => {
    const storage = moduleAt(slotOf(0, 1), "storage");
    const next = reduce(stateWithFullWater([storage]), { type: "nextDay" });

    expect(next.resources.water).toBeGreaterThan(BASE_WATER_CAPACITY);
  });

  it("Склад добавляет место воде, еде и материалам, батарея энергии; кислород и здоровье всегда 100", () => {
    const state = initialState(1);
    const storage = moduleAt(slotOf(0, 1), "storage");
    const battery = moduleAt(slotOf(0, 2), "battery");
    const baseCapacity = capacityOf(state.modules);
    const expandedCapacity = capacityOf([...state.modules, storage, battery]);

    expect(baseCapacity.water).toBe(BASE_WATER_CAPACITY);
    expect(expandedCapacity.water).toBeGreaterThan(BASE_WATER_CAPACITY);
    expect(expandedCapacity.food).toBeGreaterThan(BASE_WATER_CAPACITY);
    expect(expandedCapacity.materials).toBeGreaterThan(BASE_WATER_CAPACITY);
    expect(expandedCapacity.energy).toBeGreaterThan(BASE_WATER_CAPACITY);
    expect(expandedCapacity.oxygen).toBe(BASE_WATER_CAPACITY);
    expect(expandedCapacity.health).toBe(BASE_WATER_CAPACITY);
  });
});

describe("localStorage persistence", () => {
  it("saves and loads the current schema", () => {
    installStorage();
    const state = initialState(123);

    saveGame(state);

    expect(loadGame()).toEqual(state);
  });

  it("migrates a v5 save to v6", () => {
    const storage = installStorage();
    const state = initialState(123);
    const { research: _research, ...v5State } = state;
    storage.seed(SAVE_KEY, { version: 5, state: v5State });

    expect(loadGame()).toEqual({ ...state, research: [] });
  });

  it("rejects corrupt and malformed saves", () => {
    const storage = installStorage();
    const validState = initialState(123);
    const malformedStates: unknown[] = [
      "not json",
      { version: 6 },
      { version: 4, state: validState },
      { version: 6, state: { ...validState, status: "won" } },
      { version: 6, state: { ...validState, modules: undefined } },
    ];

    for (const saved of malformedStates) {
      storage.seed(SAVE_KEY, saved);
      expect(loadGame()).toBeNull();
    }
  });

  it("sorts records by victory, health, and days", () => {
    const storage = installStorage();
    const loss = record(20, 100, false, "2026-01-01T00:00:00.000Z");
    const healthyWin = record(18, 90, true, "2026-01-02T00:00:00.000Z");
    const longerWin = record(20, 90, true, "2026-01-03T00:00:00.000Z");
    storage.seed(RECORDS_KEY, [loss, healthyWin, longerWin]);

    expect(loadRecords()).toEqual([longerWin, healthyWin, loss]);
  });

  it("returns the best result", () => {
    const storage = installStorage();
    const best = record(20, 95, true, "2026-01-01T00:00:00.000Z");
    storage.seed(RECORDS_KEY, [record(20, 100, false, "2026-01-02T00:00:00.000Z"), best]);

    expect(bestRecord()).toEqual(best);
  });

  it("keeps at most 10 records", () => {
    installStorage();
    const records = Array.from(
      { length: MAX_RECORDS + 1 },
      (_, index) => record(index + 1, index, true, `2026-01-${String(index + 1).padStart(2, "0")}T00:00:00.000Z`),
    );

    expect(saveRecord(records[0])).toBe(true);
    for (const entry of records.slice(1)) saveRecord(entry);

    const saved = loadRecords();
    expect(saved).toHaveLength(MAX_RECORDS);
    expect(saved).not.toContainEqual(records[0]);
    expect(saveRecord(record(1, 0, false, "2026-02-01T00:00:00.000Z"))).toBe(false);
  });
});
