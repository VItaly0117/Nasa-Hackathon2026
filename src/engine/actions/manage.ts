import type { CrewMember, GameState } from "@/types";
import { getDef, RESOURCE_KEYS } from "@/engine/selectors";
import { msg } from "@/engine/msg";

// Остановить работу модуля или запустить снова. Стройка и поломка не трогаются
export function togglePause(state: GameState, slot: number): GameState {
  if (state.status !== "playing") return state;
  const mod = state.modules.find((m) => m.slot === slot);
  if (!mod || mod.build || mod.broken) return state;
  return { ...state, modules: state.modules.map((m) => (m.slot === slot ? { ...m, paused: !m.paused } : m)) };
}

// Отменить стройку: ресурсы возвращаются, строитель освобождается
export function cancelBuild(state: GameState, slot: number): GameState {
  if (state.status !== "playing") return state;
  const mod = state.modules.find((m) => m.slot === slot);
  if (!mod || !mod.build) return state;
  const cost = getDef(mod.type).cost;
  const resources = { ...state.resources };
  for (const key of RESOURCE_KEYS) resources[key] += cost[key] ?? 0;
  const crewId = mod.build.crewId;
  return {
    ...state,
    resources,
    modules: state.modules.filter((m) => m.slot !== slot),
    crew: state.crew.map((c): CrewMember => (c.id === crewId ? { ...c, status: { kind: "free" } } : c)),
    log: [...state.log, { day: state.day, ...msg("log.buildCancelled", { name: mod.type }) }],
  };
}

// Убрать готовый модуль совсем: клетка освобождается, ресурсы не возвращаются
export function demolish(state: GameState, slot: number): GameState {
  if (state.status !== "playing") return state;
  const mod = state.modules.find((m) => m.slot === slot);
  if (!mod || mod.build) return state;
  return {
    ...state,
    modules: state.modules.filter((m) => m.slot !== slot),
    log: [...state.log, { day: state.day, ...msg("log.demolished", { name: mod.type }) }],
  };
}
