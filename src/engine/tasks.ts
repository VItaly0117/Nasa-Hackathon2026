import type { GameState, ModuleType } from "../types";
import { NIGHT_START } from "./engine";

// Задачи для игрока: что сделать и зачем. Тексты лежат в словарях i18n: task.<id> и task.<id>.why.
// Выполнена задача или нет, считается по построенным модулям, поэтому в GameState их хранить не нужно
export type Task = {
  id: string;
  deadline?: number; // до какого дня
  done: (s: GameState) => boolean;
};

const has = (s: GameState, type: ModuleType) => s.modules.some((m) => m.type === type && !m.build);

// Порядок = порядок, в котором игроку стоит их делать.
// TODO @Regie: день вспышки взять из events.ts, когда вспышки станут случайными
export const TASKS: Task[] = [
  { id: "habitat", done: (s) => has(s, "habitat") },
  { id: "solar", done: (s) => has(s, "solar") },
  { id: "air", done: (s) => has(s, "lifeSupport") },
  { id: "ice", done: (s) => has(s, "iceMine") },
  { id: "greenhouse", done: (s) => has(s, "greenhouse") },
  { id: "rocks", done: (s) => has(s, "rockMine") },
  { id: "shelter", deadline: 9, done: (s) => has(s, "shelter") },
  { id: "battery", deadline: NIGHT_START, done: (s) => has(s, "battery") },
];

export function taskList(s: GameState) {
  return TASKS.map((t) => {
    const isDone = t.done(s);
    return { ...t, isDone, late: !isDone && t.deadline !== undefined && s.day >= t.deadline };
  });
}
