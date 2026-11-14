import type { GameState, ModuleType, ResourceKey, Task } from "../types";
import { MISSION_DAYS, NIGHT_START } from "./constants";
import { dailyDelta } from "./engine";
import { nextScheduledEvent } from "./events";

// Итоги дня. Считаются как разница между состоянием в начале дня (before) и в его конце (after),
// поэтому движок не меняется, а совместная игра у всех игроков показывает одно и то же.

export type Verdict = "ahead" | "onTrack" | "behind";
// Почему день признан неудачным
export type Setback = "shortage" | "blackout" | "missed" | "health" | "lowStock";

const RESOURCES: ResourceKey[] = ["oxygen", "water", "food", "energy", "health", "materials"];
const VITAL: ResourceKey[] = ["oxygen", "water", "food"];
// Меньше стольких дней запаса: уже тревожно
const LOW_STOCK_DAYS = 3;

export type DaySummary = {
  day: number;                                   // день, который закончился
  verdict: Verdict;
  setbacks: Setback[];
  lowStock: { key: ResourceKey; days: number }[]; // жизненно важные ресурсы, которых осталось на пару дней
  built: ModuleType[];                           // что достроено за день
  tasksDone: string[];                           // id выполненных заданий
  tasksMissed: string[];                         // id просроченных заданий
  decisions: { event: string; choice: string }[]; // что игрок решил в событиях
  shortages: ResourceKey[];                      // что закончилось
  blackout: boolean;                             // база оставалась без энергии
  deltas: Record<ResourceKey, number>;           // как изменились запасы за день
  left: { task: Task; isNew: boolean; late: boolean }[]; // что ещё осталось сделать, срочное сверху
  tomorrow: {
    night: boolean;                              // следующий день уже ночь
    nightIn: number | null;                      // сколько дней до ночи (если ещё не ночь)
    event: { id: string; inDays: number } | null;
  };
};

// На сколько дней хватит запаса при нынешнем расходе. Если ресурс не убывает, то на бесконечно
function runwayDays(state: GameState, key: ResourceKey): number {
  const rate = dailyDelta(state)[key] ?? 0;
  return rate < 0 ? state.resources[key] / -rate : Infinity;
}

export function summarizeDay(before: GameState, after: GameState): DaySummary {
  const newHistory = after.history.slice(before.history.length);
  const openBefore = new Set(before.tasks.filter((x) => x.status === "open").map((x) => x.id));
  const statusAfter = new Map(after.tasks.map((x) => [x.id, x.status]));

  const tasksDone = [...openBefore].filter((id) => statusAfter.get(id) === "done");
  const tasksMissed = [...openBefore].filter((id) => statusAfter.get(id) === "missed");

  const shortages = newHistory.flatMap((e) => (e.kind === "shortage" ? [e.resource] : []));
  const blackout = newHistory.some((e) => e.kind === "blackout");

  const deltas = {} as Record<ResourceKey, number>;
  for (const key of RESOURCES) deltas[key] = Math.round(after.resources[key] - before.resources[key]);

  const lowStock = VITAL.flatMap((key) => {
    const days = runwayDays(after, key);
    return days < LOW_STOCK_DAYS ? [{ key, days: Math.max(0, Math.floor(days)) }] : [];
  });

  const setbacks: Setback[] = [];
  if (shortages.length) setbacks.push("shortage");
  if (blackout) setbacks.push("blackout");
  if (tasksMissed.length) setbacks.push("missed");
  if (deltas.health < 0) setbacks.push("health");
  if (lowStock.length) setbacks.push("lowStock");

  // «Впереди»: сбоев нет, ничего не просрочено и запасов хватает до конца миссии
  const daysToEnd = MISSION_DAYS - after.day + 1;
  const enough = VITAL.every((key) => runwayDays(after, key) >= daysToEnd);
  const anyLate = after.tasks.some((x) => x.status === "open" && after.day >= x.deadline);
  const verdict: Verdict = setbacks.length ? "behind" : enough && !anyLate ? "ahead" : "onTrack";

  const left = after.tasks
    .filter((x) => x.status === "open")
    .sort((a, b) => a.deadline - b.deadline)
    .map((task) => ({ task, isNew: task.issuedDay === after.day, late: after.day >= task.deadline }));

  return {
    day: before.day,
    verdict,
    setbacks,
    lowStock,
    built: newHistory.flatMap((e) => (e.kind === "built" ? [e.module] : [])),
    tasksDone,
    tasksMissed,
    decisions: newHistory.flatMap((e) => (e.kind === "choice" ? [{ event: e.event, choice: e.choice }] : [])),
    shortages,
    blackout,
    deltas,
    left,
    tomorrow: {
      night: after.isNight,
      nightIn: after.isNight ? null : NIGHT_START - after.day,
      event: nextScheduledEvent(after.day),
    },
  };
}
