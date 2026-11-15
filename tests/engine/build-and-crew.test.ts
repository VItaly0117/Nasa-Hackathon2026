import { describe, expect, it } from "vitest";
import type { GameState, ModuleType } from "../../src/types";
import {
  BUILD_MS,
  DAY_MS,
  REPAIR_COST,
  buildReport,
  canPlace,
  choiceCost,
  dailyDelta,
  getDef,
  initialState,
  reduce,
  slotOf,
} from "../helpers/engine";

const EXPECTED_ROLES = ["doctor", "engineer", "scientist", "technician"];

function tryBuild(state: GameState, type: ModuleType): GameState {
  for (let row = 0; row < 20; row += 1) {
    for (let col = 0; col < 20; col += 1) {
      if (canPlace(state, type, row, col)) {
        return reduce(state, { type: "build", slot: slotOf(row, col), module: type });
      }
    }
  }

  return state;
}

function startConcurrentSolarBuilds(state: GameState): GameState {
  let building = state;

  for (let index = 0; index < state.crew.length; index += 1) {
    building = tryBuild(building, "solar");
  }

  return building;
}

function lifeSupportOf(state: GameState) {
  const module = state.modules.find((item) => item.type === "lifeSupport");

  if (!module) {
    throw new Error("Expected the initial base to contain life support.");
  }

  return module;
}

function breakdownOpen(): GameState {
  let state = initialState(1);

  for (let day = 0; day < 12 && state.activeEvent !== "breakdown"; day += 1) {
    state = reduce(state, { type: "tick", ms: DAY_MS });
  }

  return {
    ...state,
    resources: { ...state.resources, water: 50, energy: 50 },
  };
}

function reportIds(state: GameState): string[] {
  const report = buildReport(state);

  return [...report.hurt, ...report.helped].map((line) => line.id);
}

describe("build and crew", () => {
  it("В экипаже ровно инженер, учёный, врач и техник", () => {
    const state = initialState(1);

    expect(new Set(state.crew.map((member) => member.role)).size).toBe(4);
    expect(state.crew.map((member) => member.role).sort()).toEqual(EXPECTED_ROLES);
  });

  it("Убежище и медпункт строит врач", () => {
    expect(getDef("shelter").builder).toBe("doctor");
    expect(getDef("medbay").builder).toBe("doctor");
  });

  it("Каждую стройку ведёт отдельный член экипажа, и все члены заняты", () => {
    const fresh = initialState(1);
    const state = startConcurrentSolarBuilds(fresh);

    expect(state.crew.every((member) => member.status.kind === "building")).toBe(true);
    expect(
      new Set(
        state.crew.map((member) =>
          member.status.kind === "building" ? member.status.slot : null,
        ),
      ).size,
    ).toBe(fresh.crew.length);
  });

  it("Когда все заняты, пятый модуль не ставится", () => {
    const busy = startConcurrentSolarBuilds(initialState(1));

    expect(tryBuild(busy, "solar")).toBe(busy);
  });

  it("Стройка не списывает ресурсы повторно и модуль в стройке ничего не даёт", () => {
    const fresh = initialState(1);
    const building = startConcurrentSolarBuilds(fresh);

    expect(dailyDelta(building).energy).toBe(dailyDelta(fresh).energy);
  });

  it("За минуту без 0,1 с стройка ещё идёт", () => {
    const building = startConcurrentSolarBuilds(initialState(1));
    const almostFinished = reduce(building, { type: "tick", ms: BUILD_MS - 100 });

    expect(
      almostFinished.crew.every((member) => member.status.kind === "building"),
    ).toBe(true);
  });

  it("Ровно за 60 с игрового времени модуль готов, а строитель свободен", () => {
    const building = startConcurrentSolarBuilds(initialState(1));
    const almostFinished = reduce(building, { type: "tick", ms: BUILD_MS - 100 });
    const finished = reduce(almostFinished, { type: "tick", ms: 100 });

    expect(finished.modules.every((module) => !module.build)).toBe(true);
    expect(finished.crew.every((member) => member.status.kind === "free")).toBe(true);
  });

  it("Полный день по часам = следующий день", () => {
    const state = reduce(initialState(1), { type: "tick", ms: DAY_MS });

    expect(state.day).toBe(2);
    expect(state.clockMs).toBe(0);
  });

  it("Полдня по часам день не меняет", () => {
    const state = reduce(initialState(1), { type: "tick", ms: DAY_MS / 2 });

    expect(state.day).toBe(1);
    expect(state.clockMs).toBe(DAY_MS / 2);
  });

  it("На 6-й день ломается жизнеобеспечение", () => {
    const state = breakdownOpen();

    expect(state.activeEvent).toBe("breakdown");
    expect(lifeSupportOf(state).broken).toBe(true);
    expect(state.day).toBe(6);
  });

  it("Починка кликом стоит столько же, сколько выбор «починить» в окне (цена из events.json)", () => {
    expect(REPAIR_COST).toEqual(choiceCost("breakdown", "repair"));
    expect(Object.keys(REPAIR_COST)).not.toHaveLength(0);
  });

  it("Починка при открытом окне поломки закрывает окно и списывает цену", () => {
    const broken = breakdownOpen();
    const repaired = reduce(broken, {
      type: "repair",
      slot: lifeSupportOf(broken).slot,
    });

    expect(lifeSupportOf(repaired).broken).toBe(false);
    expect(repaired.activeEvent).toBeNull();
    expect(broken.resources.water - repaired.resources.water).toBe(
      REPAIR_COST.water ?? 0,
    );
  });

  it("Починили сразу: в разборе «починили», без «не починили»", () => {
    const broken = breakdownOpen();
    const repaired = reduce(broken, {
      type: "repair",
      slot: lifeSupportOf(broken).slot,
    });
    const ids = reportIds(repaired);

    expect(ids).toContain("breakdown-repaired");
    expect(ids).not.toContain("breakdown-ignored");
  });

  it("Отложили, потом починили: в разборе «починили позже», без «не починили» и без «починили сразу»", () => {
    const broken = breakdownOpen();
    const postponed = reduce(broken, { type: "resolveEvent", choice: "ignore" });
    const repairedLater = reduce(postponed, {
      type: "repair",
      slot: lifeSupportOf(postponed).slot,
    });
    const ids = reportIds(repairedLater);

    expect(ids).toContain("breakdown-repaired-late");
    expect(ids).not.toContain("breakdown-ignored");
    expect(ids).not.toContain("breakdown-repaired");
  });

  it("Отложили и не починили: в разборе только «не починили»", () => {
    const broken = breakdownOpen();
    const postponed = reduce(broken, { type: "resolveEvent", choice: "ignore" });
    const ids = reportIds(postponed);

    expect(ids).toContain("breakdown-ignored");
    expect(ids).not.toContain("breakdown-repaired-late");
  });

  it("После конца игры починка и исследование ничего не меняют", () => {
    const broken = breakdownOpen();
    const postponed = reduce(broken, { type: "resolveEvent", choice: "ignore" });
    const lost: GameState = { ...postponed, status: "lost" };

    expect(
      reduce(lost, { type: "repair", slot: lifeSupportOf(lost).slot }),
    ).toBe(lost);
    expect(
      reduce(lost, { type: "research", id: "moonDust", answer: "shield" }),
    ).toBe(lost);
  });
});
