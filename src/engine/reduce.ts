import type { Action, GameState } from "../types";
import { build } from "./actions/build";
import { repairModule } from "./actions/repair";
import { completeResearch } from "./actions/research";
import { tick } from "./actions/tick";
import { DAY_MS } from "./constants";
import { resolveEvent } from "./systems/events";

// Корневой редюсер ядра: только маршрутизация действий. Сама логика в actions/ и systems/
export function reduce(state: GameState, action: Action): GameState {
  switch (action.type) {
    case "tick":
      return tick(state, action.ms);
    case "nextDay":
      return tick(state, DAY_MS - state.clockMs);
    case "build":
      return build(state, action.slot, action.module);
    case "repair":
      return repairModule(state, action.slot);
    case "research":
      return completeResearch(state, action.id, action.answer);
    case "resolveEvent": {
      const next = resolveEvent(state, action.choice);
      return next.resources.health <= 0 ? { ...next, status: "lost" } : next;
    }
  }
}
