import { describe, expect, it } from "vitest";
import consumption from "../../src/content/nasa/consumption.json";
import { dailyDelta, initialState } from "../helpers/engine";
import { crewNeeds } from "../../src/engine/selectors";
import type { GameState } from "../../src/types";

// Расход экипажа считается по нормам NASA (consumption.json), а не берётся «с потолка»
const N = consumption.perCrewmemberPerDay;
const G = consumption.game;

const withStatus = (state: GameState, kinds: ("free" | "building" | "sick")[]): GameState => ({
  ...state,
  crew: state.crew.map((c, i) => ({
    ...c,
    status:
      kinds[i] === "building"
        ? { kind: "building" as const, slot: 1000 + i, module: "solar" as const }
        : kinds[i] === "sick"
          ? { kind: "sick" as const, leftMs: 1000 }
          : { kind: "free" as const },
  })),
});

describe("расход экипажа по нормам NASA", () => {
  it("в покое: кислород 0,771 кг на человека, вода 2,5 л, рацион 3035 ккал, в игровых единицах", () => {
    const need = crewNeeds(initialState(1));
    expect(need.oxygen).toBeCloseTo(-(4 * N.oxygenKgResting) / G.oxygenKgPerUnit, 1);
    expect(need.water).toBeCloseTo(-4 * N.potableWaterLitersMin * G.waterScale, 5);
    expect(need.food).toBeCloseTo(-(4 * N.foodKcalAverage) / G.foodKcalPerUnit, 5);
  });

  it("тот, кто строит, тратит кислорода как при тренировке (1,083 кг), а не как в покое", () => {
    const rest = crewNeeds(initialState(1)).oxygen!;
    const state = withStatus(initialState(1), ["building", "building", "free", "free"]);
    const working = crewNeeds(state).oxygen!;
    expect(working).toBeLessThan(rest); // отрицательные числа: тратится больше
    expect(working).toBeCloseTo(-(2 * N.oxygenKgResting + 2 * N.oxygenKgWithExercise) / G.oxygenKgPerUnit, 1);
  });

  it("больной отдыхает: кислород как в покое, вода и еда те же", () => {
    const sick = crewNeeds(withStatus(initialState(1), ["sick", "free", "free", "free"]));
    const rest = crewNeeds(initialState(1));
    expect(sick).toEqual(rest);
  });

  it("лёгкий режим тратит меньше, сложный больше", () => {
    const easy = crewNeeds(initialState(1, "easy")).food!;
    const normal = crewNeeds(initialState(1, "normal")).food!;
    const hard = crewNeeds(initialState(1, "hard")).food!;
    expect(easy).toBeGreaterThan(normal);
    expect(normal).toBeGreaterThan(hard);
  });

  it("суточное изменение запасов (dailyDelta) включает расход экипажа", () => {
    const state = initialState(1);
    expect(dailyDelta(state).food!).toBeLessThanOrEqual(crewNeeds(state).food! + 1e-9);
  });
});
