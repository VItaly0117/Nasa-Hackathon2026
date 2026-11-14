import type { GameState, Resources } from "../../types";
import { msg } from "../msg";
import { RESOURCE_KEYS } from "../selectors";
import { choiceCost } from "../systems/events";

// Починка кликом по модулю стоит столько же, сколько выбор «починить» в окне поломки (цена в events.json)
export const REPAIR_COST: Partial<Resources> = choiceCost("breakdown", "repair");

export function repairModule(state: GameState, slot: number): GameState {
  if (state.status !== "playing") return state; // после конца игры ничего не чиним
  const mod = state.modules.find((m) => m.slot === slot);
  if (!mod || !mod.broken) return state;
  const resources = { ...state.resources };
  for (const key of RESOURCE_KEYS) {
    const cost = REPAIR_COST[key] ?? 0;
    if (resources[key] < cost) return state;
    resources[key] -= cost;
  }
  const modules = state.modules.map((m) => (m.slot === slot ? { ...m, broken: false } : m));
  // Если окно поломки было открыто, починка закрывает его: это то же самое, что выбор «починить».
  // Если окно уже закрыли («отложить ремонт») и чинят позже, в истории это «repairLater»: разбор отличает их
  const atOnce = state.activeEvent === "breakdown";
  const activeEvent = atOnce ? null : state.activeEvent;
  const history: typeof state.history = [
    ...state.history,
    { day: state.day, kind: "choice", event: "breakdown", choice: atOnce ? "repair" : "repairLater", unprotected: false },
  ];
  return {
    ...state,
    resources,
    modules,
    activeEvent,
    history,
    log: [...state.log, { day: state.day, ...msg("log.repaired") }],
  };
}
