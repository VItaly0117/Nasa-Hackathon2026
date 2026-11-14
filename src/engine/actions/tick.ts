import type { GameState } from "../../types";
import { DAY_MS } from "../constants";
import { assignWaiting, restCrew } from "../systems/crew";
import { nextDay } from "../systems/day";
import { msUntilSick } from "../systems/illness";
import { advanceBuilds } from "./build";

// Прошло ms мс игрового времени. Время дня и стройка идут от одних часов: пауза и ускорение работают сразу для всего.
// Если за это время наступает событие или миссия кончается, оставшееся время отбрасываем
export function tick(state: GameState, ms: number): GameState {
  let s = state;
  let left = ms;
  while (left > 0 && s.status === "playing" && !s.activeEvent) {
    const step = Math.min(left, DAY_MS - s.clockMs, msUntilSick(s));
    left -= step;
    s = assignWaiting(restCrew(s, step)); // больные отдыхают, свободные подхватывают брошенные стройки
    s = advanceBuilds(s, step);
    const clockMs = s.clockMs + step;
    if (s.activeEvent) {
      // Началась болезнь: день не меняем, пока игрок не выберет. Остаток времени отбрасываем
      s = { ...s, clockMs: Math.min(clockMs, DAY_MS - 1) };
      break;
    }
    s = clockMs >= DAY_MS ? nextDay({ ...s, clockMs: 0 }) : { ...s, clockMs };
  }
  return s;
}
