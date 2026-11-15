import type { GameState, ModuleType } from "../../src/types";
import { DAY_MS, MISSION_DAYS, canPlace, initialState, MAP_COLS, MAP_ROWS, reduce, slotOf } from "./engine";

export type Strategy = { builds: Record<number, ModuleType[]>; choices: Record<string, string> };

export const CAREFUL = { breakdown: "repair", flare: "hide", illness: "treat" };
export const RECKLESS = { breakdown: "ignore", flare: "work", illness: "ignore" };
export const IDLE: Strategy = { builds: {}, choices: CAREFUL };
export const CARELESS: Strategy = { builds: {}, choices: RECKLESS };
export const PREPARED: Strategy = {
  builds: {
    1: ["solar", "solar", "solar", "greenhouse"],
    2: ["rockMine", "iceMine"],
    3: ["shelter"],
    5: ["battery", "solar"],
    7: ["battery"],
    9: ["battery"],
    11: ["battery"],
  },
  choices: CAREFUL,
};

export const NO_BATTERY: Strategy = {
  builds: Object.fromEntries(Object.entries(PREPARED.builds).map(([day, list]) => [day, list.filter((type) => type !== "battery")])),
  choices: CAREFUL,
};

export const NO_SHELTER: Strategy = {
  builds: Object.fromEntries(Object.entries(PREPARED.builds).map(([day, list]) => [day, list.filter((type) => type !== "shelter")])),
  choices: CAREFUL,
};

function tryBuild(state: GameState, type: ModuleType): GameState {
  for (let row = 0; row < MAP_ROWS; row++) {
    for (let col = 0; col < MAP_COLS; col++) {
      if (canPlace(state, type, row, col)) return reduce(state, { type: "build", slot: slotOf(row, col), module: type });
    }
  }
  return state;
}

export function playMission(strategy: Strategy, seed = 1): GameState {
  let state = initialState(seed);
  const queue: ModuleType[] = [];
  let queuedDay = 0;
  for (let step = 0; step < MISSION_DAYS * 3 && state.status === "playing"; step++) {
    if (state.activeEvent) {
      state = reduce(state, { type: "resolveEvent", choice: strategy.choices[state.activeEvent] });
      continue;
    }
    if (queuedDay !== state.day) {
      queuedDay = state.day;
      queue.push(...(strategy.builds[state.day] ?? []));
    }
    for (let i = 0; i < queue.length;) {
      const next = tryBuild(state, queue[i]);
      if (next === state) i++;
      else {
        state = next;
        queue.splice(i, 1);
      }
    }
    state = reduce(state, { type: "nextDay" });
  }
  return state;
}

export function finishDay(state: GameState): GameState {
  return reduce(state, { type: "tick", ms: DAY_MS });
}
