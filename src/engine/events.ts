import eventsData from "../data/events.json";
import flaresData from "../data/nasa/flares.json";
import { msg } from "./msg";
import { DAY_MS } from "./constants";
import { restPatient } from "./crew";
import type { EventDef, Flare, GameState, ModuleType, ResourceKey, Resources } from "../types";

const FLARES = flaresData as Flare[];
const EVENTS = eventsData as EventDef[];

// Цена выбора из events.json. Другие места (например, починка кликом по модулю) берут цену отсюда,
// чтобы она не разошлась с подсказкой в окне события
export function choiceCost(eventId: string, choiceId: string): Partial<Resources> {
  return EVENTS.find((e) => e.id === eventId)?.choices.find((c) => c.id === choiceId)?.cost ?? {};
}

// День миссии → событие. Потом можно сделать случайными
const SCHEDULE: Record<number, string> = {
  6: "breakdown",
  9: "flare",
};

// Цена события только отнимает ресурсы, поэтому верхний предел не нужен
const clamp = (value: number) => Math.max(0, value);

// Случайная РЕАЛЬНАЯ вспышка NASA DONKI. Зовётся один раз при старте миссии (initialState),
// чтобы reduce оставался чистой функцией.
export function pickFlare(random: () => number = Math.random): Flare | null {
  return FLARES.length ? FLARES[Math.floor(random() * FLARES.length)] : null;
}

// День, на который запланировано событие (например, вспышка): задания берут срок отсюда
export function dayOfEvent(id: string): number {
  return Number(Object.keys(SCHEDULE).find((d) => SCHEDULE[Number(d)] === id));
}

export function eventForDay(day: number): string | null {
  return SCHEDULE[day] ?? null;
}

// Ближайшее запланированное событие после текущего дня — для предупреждения в интерфейсе
export function nextScheduledEvent(day: number): { id: string; inDays: number } | null {
  const next = Object.keys(SCHEDULE)
    .map(Number)
    .filter((d) => d > day)
    .sort((a, b) => a - b)[0];
  return next ? { id: SCHEDULE[next], inDays: next - day } : null;
}

// Что происходит в момент начала события, до выбора игрока
export function applyEventStart(state: GameState, eventId: string): GameState {
  if (eventId === "breakdown") {
    return {
      ...state,
      modules: state.modules.map((m) => (m.type === "lifeSupport" ? { ...m, broken: true } : m)),
    };
  }
  if (eventId === "flare" && state.flare) {
    return {
      ...state,
      log: [...state.log, { day: state.day, ...msg("log.flareReal", { cls: state.flare.class, date: state.flare.date }) }],
    };
  }
  return state;
}

// Применяет выбор игрока. Цены берутся из events.json, тексты из словарей i18n
export function resolveEvent(state: GameState, choiceId: string): GameState {
  const choice = EVENTS.find((e) => e.id === state.activeEvent)?.choices.find((c) => c.id === choiceId);
  if (!choice) return state;

  const resources = { ...state.resources };
  const pay = (cost: Partial<Resources>) => {
    for (const key of Object.keys(cost) as ResourceKey[]) resources[key] = clamp(resources[key] - (cost[key] ?? 0));
  };
  const has = (type: ModuleType) => state.modules.some((m) => m.type === type && !m.build);

  pay(choice.costWith && has(choice.costWith.module) ? choice.costWith.cost : choice.cost);

  let textKey = choice.result;
  let unprotected = false;
  if (choice.costWithout && !has(choice.costWithout.module)) {
    unprotected = true;
    pay(choice.costWithout.cost);
    textKey = choice.resultWithout ?? textKey;
  }
  // Болезнь: сколько дней больной выбывает. Медпункт сокращает срок
  const patient = state.illness;
  const restDays = patient && choice.rest ? (has(choice.rest.module) ? choice.rest.daysWith : choice.rest.days) : 0;
  if (choice.rest) unprotected = !has(choice.rest.module);

  const modules = choice.repairs
    ? state.modules.map((m) => (m.type === choice.repairs ? { ...m, broken: false } : m))
    : state.modules;

  const next: GameState = {
    ...state,
    resources,
    modules,
    activeEvent: null,
    illness: null,
    log: [...state.log, { day: state.day, ...(patient ? msg(textKey, { name: patient.crewId, days: restDays }) : msg(textKey)) }],
    history: [...state.history, { day: state.day, kind: "choice", event: state.activeEvent!, choice: choice.id, unprotected }],
  };
  return patient && restDays > 0 ? restPatient(next, patient.crewId, restDays * DAY_MS) : next;
}
