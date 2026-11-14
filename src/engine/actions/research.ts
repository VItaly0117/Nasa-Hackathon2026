import type { GameState } from "../../types";
import { msg } from "../msg";
import { capacityOf, clamp } from "../selectors";

// Научная экспедиция: один вопрос с наградой ресурсами. Каждая выполняется один раз за миссию
export function completeResearch(
  state: GameState,
  id: "moonDust" | "iceScout",
  answer: "shield" | "brush" | "ice" | "rock",
): GameState {
  if (state.status !== "playing" || state.research?.includes(id)) return state;
  const correct = id === "moonDust" ? answer === "shield" : answer === "ice";
  const energy = id === "moonDust" ? (correct ? 24 : 8) : (correct ? 8 : 0);
  const water = id === "iceScout" && correct ? 22 : 0;
  const materials = id === "moonDust" ? (correct ? 12 : 0) : (correct ? 0 : 5);
  const capacity = capacityOf(state.modules);
  const resources = {
    ...state.resources,
    energy: clamp(state.resources.energy + energy, capacity.energy),
    water: clamp(state.resources.water + water, capacity.water),
    materials: clamp(state.resources.materials + materials, capacity.materials),
  };
  const resultKey = id === "moonDust"
    ? (correct ? "research.moonDust.resultShield" : "research.moonDust.resultBrush")
    : (correct ? "research.iceScout.resultIce" : "research.iceScout.resultRock");
  return {
    ...state,
    research: [...(state.research ?? []), id, `${id}:${answer}`],
    resources,
    log: [...state.log, { day: state.day, ...msg("research.log", { result: resultKey }) }],
  };
}
