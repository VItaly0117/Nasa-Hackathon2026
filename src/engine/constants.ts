// Числа, на которые опираются и движок, и задания. Отдельный файл, чтобы они не импортировали друг друга по кругу
import type { GameMode, Resources } from "../types";

export const MISSION_DAYS = 20;
export const NIGHT_START = 14;
// Сколько длится игровой день: полторы минуты (90 секунд). Паузы, ускорения и пропуска дня нет (решение команды)
export const DAY_MS = 90000;
// Сколько строится любой модуль: одна минута, то есть полдня
export const BUILD_MS = 60000;

// Режимы игры. need — во сколько раз экипаж тратит больше или меньше воздуха, воды и еды
export const MODES: Record<GameMode, { start: Resources; need: number }> = {
  easy: { start: { oxygen: 100, water: 90, food: 60, energy: 70, health: 100, materials: 20 }, need: 0.75 },
  normal: { start: { oxygen: 80, water: 70, food: 40, energy: 60, health: 100, materials: 10 }, need: 1 },
  hard: { start: { oxygen: 60, water: 50, food: 25, energy: 40, health: 100, materials: 5 }, need: 1.25 },
};
export const MODE_IDS: GameMode[] = ["easy", "normal", "hard"];

// Болезни: не чаще одной за ILLNESS_GAP дней, не больше MAX_ILLNESS за миссию, шанс при старте стройки
export const MAX_ILLNESS = 3;
export const ILLNESS_GAP = 5;
export const ILLNESS_CHANCE = 0.4;
