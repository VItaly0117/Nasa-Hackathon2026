import type { GameState } from "../types";
import { t } from "../i18n";

// Правила итогового разбора. Тексты лежат в словарях i18n (debrief.*)
export function buildDebrief(state: GameState): string[] {
  const has = (type: string) => state.modules.some((m) => m.type === type);
  const lines: string[] = [];

  if (!has("greenhouse")) lines.push(t("debrief.greenhouse"));
  if (!has("battery")) lines.push(t("debrief.battery"));
  if (!has("shelter")) lines.push(t("debrief.shelter"));
  if (lines.length === 0) lines.push(t("debrief.ok"));

  return lines;
}
