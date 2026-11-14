import type { GameState } from "../types";

// Правила итогового разбора. TODO @Regie: перенести тексты в data/debrief.json
export function buildDebrief(state: GameState): string[] {
  const has = (type: string) => state.modules.some((m) => m.type === type);
  const lines: string[] = [];

  if (!has("greenhouse")) lines.push("Без теплицы еда только убывала. На настоящей базе часть еды придётся выращивать на месте.");
  if (!has("battery")) lines.push("Без батареи лунная ночь оставила базу без энергии. 14 суток темноты нужно пережить на запасах.");
  if (!has("shelter")) lines.push("Не было радиационного убежища, поэтому вспышка ударила по здоровью экипажа.");
  if (lines.length === 0) lines.push("Ты подготовил базу к ночи, вспышке и нехватке еды. Так и работает запас прочности.");

  return lines;
}
