import { describe, expect, it } from "vitest";
import type { GameState, ModuleType, PlacedModule } from "../../src/types";
import {
  BUILD_MS,
  DAY_MS,
  MAP_COLS,
  MAP_ROWS,
  buildReport,
  canPlace,
  initialState,
  reduce,
  slotOf,
} from "../helpers/engine";
import { PREPARED, playMission } from "../helpers/scenarios";

const FIRST_ILLNESS_SEED = 1;
const LAST_ILLNESS_SEED = 499;
const FIRST_DAY_SEED = 1;
const LAST_FIRST_DAY_SEED = 80;
const FIRST_MISSION_SEED = 1;
const LAST_MISSION_SEED = 40;
const MAX_ILLNESS = 3;
const ILLNESS_GAP = 5;
const UNTREATED_ILLNESS_MS = 2 * DAY_MS;
const MEDBAY_ILLNESS_MS = DAY_MS;
const TREATMENT_WATER_COST = 10;
const TREATMENT_FOOD_COST = 8;
const MEDBAY_TREATMENT_WATER_COST = 5;
const MEDBAY_TREATMENT_FOOD_COST = 4;
const IGNORE_HEALTH_COST = 5;
const WAITING_BUILD_MS = 5_000;
const RESUME_BUILD_MS = 100;

function tryBuild(state: GameState, type: ModuleType): GameState {
  for (let row = 0; row < MAP_ROWS; row++) {
    for (let col = 0; col < MAP_COLS; col++) {
      if (canPlace(state, type, row, col)) {
        return reduce(state, { type: "build", slot: slotOf(row, col), module: type });
      }
    }
  }

  return state;
}

function illnessDuringConstruction(seed: number): GameState {
  const secondDay = reduce(initialState(seed), { type: "tick", ms: DAY_MS });
  const building = tryBuild(secondDay, "solar");
  return reduce(building, { type: "tick", ms: BUILD_MS });
}

function findIllnessSeed(): number {
  for (let seed = FIRST_ILLNESS_SEED; seed <= LAST_ILLNESS_SEED; seed++) {
    if (illnessDuringConstruction(seed).activeEvent === "illness") {
      return seed;
    }
  }

  return 0;
}

function buildInProgress(state: GameState): PlacedModule | undefined {
  return state.modules.find((module) => module.build);
}

function illnessState(): GameState {
  const seed = findIllnessSeed();

  if (seed === 0) {
    throw new Error("No deterministic illness seed was found.");
  }

  return illnessDuringConstruction(seed);
}

function addMedbay(state: GameState): GameState {
  const medbay: PlacedModule = {
    slot: slotOf(1, 0),
    type: "medbay",
    broken: false,
  };

  return { ...state, modules: [...state.modules, medbay] };
}

describe("illness", () => {
  it("Во время стройки можно заболеть (нашёлся seed)", () => {
    expect(findIllnessSeed()).toBeGreaterThan(0);
  });

  it("Событие болезни: строитель отмечен, стройка и часы стоят", () => {
    const sick = illnessState();
    const patientId = sick.illness?.crewId;
    const construction = buildInProgress(sick);

    expect(sick.activeEvent).toBe("illness");
    expect(patientId).toBeDefined();
    expect(construction?.build?.crewId).toBe(patientId);
    expect(sick.status).toBe("playing");
    expect(sick.clockMs).toBeLessThan(DAY_MS);
  });

  it("Вылечить: −10 воды и −8 еды, стройка продолжается тем же человеком", () => {
    const sick = illnessState();
    const patientId = sick.illness?.crewId;
    const treated = reduce(sick, { type: "resolveEvent", choice: "treat" });

    expect(sick.resources.water - treated.resources.water).toBe(TREATMENT_WATER_COST);
    expect(sick.resources.food - treated.resources.food).toBe(TREATMENT_FOOD_COST);
    expect(buildInProgress(treated)?.build?.crewId).toBe(patientId);
    expect(treated.activeEvent).toBeNull();
    expect(treated.illness).toBeNull();
  });

  it("С медпунктом лечение вдвое дешевле", () => {
    const sick = illnessState();
    const treated = reduce(addMedbay(sick), { type: "resolveEvent", choice: "treat" });

    expect(sick.resources.water - treated.resources.water).toBe(MEDBAY_TREATMENT_WATER_COST);
    expect(sick.resources.food - treated.resources.food).toBe(MEDBAY_TREATMENT_FOOD_COST);
  });

  it("Не лечить: больной выбывает на 2 дня, здоровье −5, стройку подхватывает другой", () => {
    const sick = illnessState();
    const patientId = sick.illness?.crewId;
    const ignored = reduce(sick, { type: "resolveEvent", choice: "ignore" });
    const patientStatus = ignored.crew.find((crewMember) => crewMember.id === patientId)?.status;

    expect(patientStatus).toEqual({ kind: "sick", leftMs: UNTREATED_ILLNESS_MS });
    expect(sick.resources.health - ignored.resources.health).toBe(IGNORE_HEALTH_COST);
    expect(buildInProgress(ignored)?.build?.crewId).not.toBeNull();
    expect(buildInProgress(ignored)?.build?.crewId).not.toBe(patientId);
  });

  it("С медпунктом больной выбывает на 1 день", () => {
    const sick = illnessState();
    const patientId = sick.illness?.crewId;
    const ignored = reduce(addMedbay(sick), { type: "resolveEvent", choice: "ignore" });
    const patientStatus = ignored.crew.find((crewMember) => crewMember.id === patientId)?.status;

    expect(patientStatus).toEqual({ kind: "sick", leftMs: MEDBAY_ILLNESS_MS });
  });

  it("Через 2 дня больной выздоравливает и снова свободен", () => {
    const sick = illnessState();
    const patientId = sick.illness?.crewId;
    const ignored = reduce(sick, { type: "resolveEvent", choice: "ignore" });
    const recovered = reduce(ignored, { type: "tick", ms: UNTREATED_ILLNESS_MS });
    const patientStatus = recovered.crew.find((crewMember) => crewMember.id === patientId)?.status;

    expect(patientStatus?.kind).toBe("free");
  });

  it("Если некому подхватить, стройка стоит и время её не идёт", () => {
    const sick = illnessState();
    const patientId = sick.illness?.crewId;
    const everyoneElseBusy: GameState = {
      ...sick,
      crew: sick.crew.map((crewMember) =>
        crewMember.id === patientId
          ? crewMember
          : {
              ...crewMember,
              status: { kind: "building", slot: 999, module: "solar" },
            },
      ),
    };
    const waiting = reduce(everyoneElseBusy, { type: "resolveEvent", choice: "ignore" });
    const stalled = reduce(waiting, { type: "tick", ms: WAITING_BUILD_MS });

    expect(buildInProgress(waiting)?.build?.crewId).toBeNull();
    expect(buildInProgress(stalled)?.build?.leftMs).toBe(buildInProgress(waiting)?.build?.leftMs);
  });

  it("Освободился человек: он подхватывает стройку, и она снова идёт", () => {
    const sick = illnessState();
    const patientId = sick.illness?.crewId;
    const everyoneElseBusy: GameState = {
      ...sick,
      crew: sick.crew.map((crewMember) =>
        crewMember.id === patientId
          ? crewMember
          : {
              ...crewMember,
              status: { kind: "building", slot: 999, module: "solar" },
            },
      ),
    };
    const waiting = reduce(everyoneElseBusy, { type: "resolveEvent", choice: "ignore" });
    const stalled = reduce(waiting, { type: "tick", ms: WAITING_BUILD_MS });
    const helperId = stalled.crew.find((crewMember) => crewMember.id !== patientId)?.id;

    if (helperId === undefined) {
      throw new Error("No healthy crew member was available to resume construction.");
    }

    const freedCrew = {
      ...stalled,
      crew: stalled.crew.map((crewMember) =>
        crewMember.id === helperId ? { ...crewMember, status: { kind: "free" } } : crewMember,
      ),
    };
    const resumed = reduce(freedCrew, { type: "tick", ms: RESUME_BUILD_MS });

    expect(buildInProgress(resumed)?.build?.crewId).not.toBeNull();
    expect(buildInProgress(resumed)?.build?.leftMs).toBeLessThan(buildInProgress(stalled)?.build?.leftMs ?? Infinity);
  });

  it("В первый день никто не заболевает", () => {
    let illnessesOnFirstDay = 0;

    for (let seed = FIRST_DAY_SEED; seed <= LAST_FIRST_DAY_SEED; seed++) {
      const construction = tryBuild(initialState(seed), "solar");
      const firstDay = reduce(construction, { type: "tick", ms: DAY_MS - 1 });

      if (firstDay.activeEvent === "illness") {
        illnessesOnFirstDay++;
      }
    }

    expect(illnessesOnFirstDay).toBe(0);
  });

  it("За миссию не больше 3 болезней и не чаще, чем раз в 5 дней (40 разных seed)", () => {
    let maximumIllnesses = 0;
    let shortestGap = Infinity;

    for (let seed = FIRST_MISSION_SEED; seed <= LAST_MISSION_SEED; seed++) {
      const mission = playMission(PREPARED, seed);
      const illnessDays = mission.history
        .filter((entry) => entry.kind === "choice" && entry.event === "illness")
        .map((entry) => entry.day);

      maximumIllnesses = Math.max(maximumIllnesses, illnessDays.length);

      for (let index = 1; index < illnessDays.length; index++) {
        shortestGap = Math.min(shortestGap, illnessDays[index] - illnessDays[index - 1]);
      }
    }

    expect(maximumIllnesses).toBeLessThanOrEqual(MAX_ILLNESS);
    expect(shortestGap).toBeGreaterThanOrEqual(ILLNESS_GAP);
  });

  it("Один seed даёт одну и ту же игру", () => {
    expect(playMission(PREPARED, 7)).toEqual(playMission(PREPARED, 7));
  });

  it("Разбор болезни: вылечил, не лечил, медпункт", () => {
    const sick = illnessState();
    const treated = reduce(sick, { type: "resolveEvent", choice: "treat" });
    const ignored = reduce(sick, { type: "resolveEvent", choice: "ignore" });
    const withMedbayBuilt: GameState = {
      ...treated,
      history: [...treated.history, { day: 2, kind: "built", module: "medbay" }],
    };

    expect(buildReport(treated).helped.some((line) => line.id === "illness-treated")).toBe(true);
    expect(buildReport(ignored).hurt.some((line) => line.id === "illness-ignored")).toBe(true);
    expect(buildReport(withMedbayBuilt).helped.some((line) => line.id === "medbay-helped")).toBe(true);
    expect(buildReport(treated).helped.some((line) => line.id === "medbay-helped")).toBe(false);
  });
});
