import type { GameState, ModuleType, Role, Task } from "../types";
import { t } from "../i18n";
import { NIGHT_START } from "./constants";
import { dayOfEvent } from "./events";

// Задания от экипажа. Это цели и подсказки: строить можно и то, о чём не просили.
// Выполнено или нет, считается по состоянию базы, поэтому условие лежит рядом с описанием.
// Тексты в словарях i18n: task.<id> и task.<id>.why

export const TASKS_BUSY_UNTIL = 10; // до этого дня включительно экипаж просит чаще
export const TASKS_BUSY = 2;        // сколько новых заданий в день до порога
export const TASKS_CALM = 1;        // и после него
export const MAX_OPEN = 4;          // больше открытых заданий сразу не выдаём: ребёнку не нужна гора просьб
export const TASK_DAYS = 5;         // срок по умолчанию
export const MORALE_START = 70;
export const MORALE_STEP = 10;

type TaskDef = {
  id: string;
  role: Role;               // кто просит
  fromDay?: number;         // не выдавать раньше этого дня
  deadline?: () => number;  // жёсткий срок (вспышка, ночь); иначе день выдачи + TASK_DAYS
  done: (s: GameState) => boolean;
};

const count = (s: GameState, type: ModuleType) => s.modules.filter((m) => m.type === type && !m.build).length;

// Порядок = приоритет: сначала выдаются верхние, ещё не выполненные
export const TASK_DEFS: TaskDef[] = [
  // на старте панелей нет, а без энергии не работает ничего: это первое, о чём просит экипаж
  { id: "solar", role: "engineer", done: (s) => count(s, "solar") >= 1 },
  { id: "greenhouse", role: "scientist", done: (s) => count(s, "greenhouse") >= 1 },
  { id: "rocks", role: "scientist", done: (s) => count(s, "rockMine") >= 1 },
  { id: "solar2", role: "engineer", fromDay: 3, done: (s) => count(s, "solar") >= 2 },
  { id: "shelter", role: "doctor", deadline: () => dayOfEvent("flare"), done: (s) => count(s, "shelter") >= 1 },
  { id: "ice", role: "scientist", done: (s) => count(s, "iceMine") >= 1 },
  { id: "storage", role: "engineer", fromDay: 3, done: (s) => count(s, "storage") >= 1 },
  { id: "battery", role: "engineer", fromDay: 4, deadline: () => NIGHT_START, done: (s) => count(s, "battery") >= 1 },
  { id: "air2", role: "technician", fromDay: 4, done: (s) => count(s, "lifeSupport") >= 2 },
  { id: "stockMaterials", role: "scientist", fromDay: 5, done: (s) => s.resources.materials >= 50 },
  { id: "battery2", role: "engineer", fromDay: 7, deadline: () => NIGHT_START, done: (s) => count(s, "battery") >= 2 },
  { id: "greenhouse2", role: "scientist", fromDay: 8, done: (s) => count(s, "greenhouse") >= 2 },
  { id: "stockWater", role: "technician", fromDay: 9, done: (s) => s.resources.water >= 80 },
  { id: "solar3", role: "engineer", fromDay: 10, done: (s) => count(s, "solar") >= 3 },
  { id: "habitat2", role: "technician", fromDay: 12, done: (s) => count(s, "habitat") >= 2 },
];

const defOf = (id: string) => TASK_DEFS.find((d) => d.id === id)!;

export const tasksPerDay = (day: number) => (day <= TASKS_BUSY_UNTIL ? TASKS_BUSY : TASKS_CALM);

// Выдаёт сегодняшние задания: сколько положено на этот день, но так, чтобы открытых не стало больше MAX_OPEN
export function issueTasks(state: GameState): GameState {
  const open = state.tasks.filter((task) => task.status === "open").length;
  const room = Math.min(tasksPerDay(state.day), MAX_OPEN - open);
  if (room <= 0) return state;

  // Подходящие задания по приоритету
  const candidates: Task[] = [];
  for (const def of TASK_DEFS) {
    if (state.tasks.some((task) => task.id === def.id)) continue; // это задание уже выдавали
    if ((def.fromDay ?? 1) > state.day || def.done(state)) continue;
    const deadline = def.deadline ? def.deadline() : state.day + TASK_DAYS;
    if (deadline <= state.day) continue; // срок уже прошёл
    const giver = state.crew.find((c) => c.role === def.role);
    if (!giver) continue;
    candidates.push({ id: def.id, giver: giver.id, issuedDay: state.day, deadline, status: "open" });
  }

  // Просят разные люди: сначала берём по одному заданию от каждого, потом добираем остальные по приоритету
  const issued: Task[] = [];
  const askedNow = new Set<number>();
  for (const task of candidates) {
    if (issued.length >= room) break;
    if (askedNow.has(task.giver)) continue;
    askedNow.add(task.giver);
    issued.push(task);
  }
  for (const task of candidates) {
    if (issued.length >= room) break;
    if (!issued.includes(task)) issued.push(task);
  }
  return issued.length ? { ...state, tasks: [...state.tasks, ...issued] } : state;
}

// Проверяет открытые задания: выполнено или срок вышел. Меняет настроение всего экипажа
export function reviewTasks(state: GameState): GameState {
  const log = [...state.log];
  let morale = 0;
  const tasks = state.tasks.map((task): Task => {
    if (task.status !== "open") return task;
    const who = t(`crew.from${task.giver}`); // «задание от Максима»
    const title = t(`task.${task.id}`);
    if (defOf(task.id).done(state)) {
      morale += MORALE_STEP;
      log.push({ day: state.day, text: t("log.taskDone", { who, task: title }) });
      return { ...task, status: "done" };
    }
    if (state.day > task.deadline) {
      morale -= MORALE_STEP;
      log.push({ day: state.day, text: t("log.taskMissed", { who, task: title }) });
      return { ...task, status: "missed" };
    }
    return task;
  });
  if (log.length === state.log.length) return state;
  return {
    ...state,
    tasks,
    log,
    crew: morale === 0 ? state.crew : state.crew.map((c) => ({ ...c, morale: Math.max(0, Math.min(100, c.morale + morale)) })),
  };
}
