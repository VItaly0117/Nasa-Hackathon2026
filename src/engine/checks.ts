import type { GameState } from "../types";
import { initialState, reduce } from "./engine";

// Проверки баланса. TODO @Regie: дописать сценарии
function playDays(state: GameState, days: number): GameState {
  let s = state;
  for (let i = 0; i < days; i++) {
    if (s.activeEvent) s = reduce(s, { type: "resolveEvent", choice: s.activeEvent === "flare" ? "hide" : "repair" });
    s = reduce(s, { type: "nextDay" });
  }
  return s;
}

export function runChecks() {
  const idle = playDays(initialState(), 20);
  console.assert(idle.status !== "won", "Если ничего не строить, миссия не должна проходиться");
  console.log("Без построек:", idle.status, "день", idle.day, idle.resources);
}
