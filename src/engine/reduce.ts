import type { Action, GameState } from "@/types";
import { build } from "@/engine/actions/build";
import { cancelBuild, demolish, togglePause } from "@/engine/actions/manage";
import { repairModule } from "@/engine/actions/repair";
import { completeResearch } from "@/engine/actions/research";
import { tick } from "@/engine/actions/tick";
import { DAY_MS } from "./constants";
import { resolveEvent } from "@/engine/systems/events";

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
    case "pause":
      return togglePause(state, action.slot);
    case "cancelBuild":
      return cancelBuild(state, action.slot);
    case "demolish":
      return demolish(state, action.slot);
    case "research":
      return completeResearch(state, action.id, action.answer);
    case "resolveEvent": {
      const next = resolveEvent(state, action.choice);
      return next.resources.health <= 0 ? { ...next, status: "lost" } : next;
    }
  }
}
