import type { GameState, ModuleType } from "../types";
import { NIGHT_START } from "./engine";

// Задачи для игрока: что сделать и зачем. Выполнена задача или нет, считается по построенным модулям,
// поэтому в GameState их хранить не нужно
export type Task = {
  id: string;
  text: string;      // что сделать
  why: string;       // зачем, простыми словами
  deadline?: number; // до какого дня
  done: (s: GameState) => boolean;
};

const has = (s: GameState, type: ModuleType) => s.modules.some((m) => m.type === type);

// Порядок = порядок, в котором игроку стоит их делать.
// TODO @Regie: день вспышки взять из events.ts, когда вспышки станут случайными
export const TASKS: Task[] = [
  { id: "habitat", text: "Построй жилой модуль", why: "Экипажу нужно где-то жить и отдыхать", done: (s) => has(s, "habitat") },
  { id: "solar", text: "Поставь солнечные панели", why: "Почти всё на базе работает на энергии", done: (s) => has(s, "solar") },
  { id: "air", text: "Построй жизнеобеспечение", why: "Экипажу нужен воздух, иначе падает здоровье", done: (s) => has(s, "lifeSupport") },
  { id: "ice", text: "Поставь ледодобытчик на лёд", why: "Изо льда получают воду для людей и теплицы", done: (s) => has(s, "iceMine") },
  { id: "greenhouse", text: "Построй теплицу", why: "Запасы еды с Земли скоро закончатся", done: (s) => has(s, "greenhouse") },
  { id: "rocks", text: "Открой карьер на камнях", why: "Из камней делают материалы для убежища", done: (s) => has(s, "rockMine") },
  { id: "shelter", text: "Построй убежище", why: "Скоро солнечная вспышка, нужна защита от радиации", deadline: 9, done: (s) => has(s, "shelter") },
  { id: "battery", text: "Построй батарею", why: "Ночью панели уснут на 14 суток", deadline: NIGHT_START, done: (s) => has(s, "battery") },
];

export function taskList(s: GameState) {
  return TASKS.map((t) => {
    const isDone = t.done(s);
    return { ...t, isDone, late: !isDone && t.deadline !== undefined && s.day >= t.deadline };
  });
}
