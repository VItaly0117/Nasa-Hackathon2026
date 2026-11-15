import type { GameState } from "@/types";
import type { MessageKey } from "@/i18n";

// Когда открытых заданий нет, подсказываем, что делать, исходя из состояния базы.
// Возвращает ключ строки: слой перевода подставит текст
const LOW = 15; // ресурс «почти на нуле»

export function goalHint(state: GameState): MessageKey {
  const r = state.resources;
  if (r.energy <= LOW) return state.isNight ? "goalHint.energyNight" : "goalHint.energy";
  if (r.oxygen <= LOW) return "goalHint.oxygen";
  if (r.water <= LOW) return "goalHint.water";
  if (r.food <= LOW) return "goalHint.food";
  return "goalHint.generic";
}
