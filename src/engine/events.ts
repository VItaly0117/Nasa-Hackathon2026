import eventsData from "../data/events.json";
import type { EventDef, Flare, GameState, ResourceKey, Resources } from "../types";
import flaresData from "../data/nasa/flares.json";

const FLARES = flaresData as Flare[];
const EVENTS = eventsData as EventDef[];

// Случайная РЕАЛЬНАЯ вспышка NASA DONKI. Зовётся один раз при старте миссии (initialState),
// чтобы reduce оставался чистой функцией.
export function pickFlare(random: () => number = Math.random): Flare | null {
  return FLARES.length ? FLARES[Math.floor(random() * FLARES.length)] : null;
}

const FLARE_DATE = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });

export function describeFlare(flare: Flare): string {
  // Intl добавляет в конце «г.»: убираем, чтобы фраза не кончалась двумя точками
  const date = FLARE_DATE.format(new Date(flare.date)).replace(/\s*г\.$/, " года");
  return `класс ${flare.class}, ${date}`;
}

// День миссии → событие. Потом можно сделать случайными
const SCHEDULE: Record<number, string> = {
  6: "breakdown",
  9: "flare",
};

const clamp = (value: number) => Math.max(0, Math.min(100, value));

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
      log: [...state.log, { day: state.day, text: `Вспышка на Солнце: ${describeFlare(state.flare)} (по данным NASA DONKI)` }],
    };
  }
  return state;
}

// Применяет выбор игрока. Цены и тексты берутся из events.json
export function resolveEvent(state: GameState, choiceId: string): GameState {
  const choice = EVENTS.find((e) => e.id === state.activeEvent)?.choices.find((c) => c.id === choiceId);
  if (!choice) return state;

  const resources = { ...state.resources };
  const pay = (cost: Partial<Resources>) => {
    for (const key of Object.keys(cost) as ResourceKey[]) resources[key] = clamp(resources[key] - (cost[key] ?? 0));
  };

  pay(choice.cost);

  let text = choice.result;
  let unprotected = false;
  if (choice.costWithout) {
    const hasModule = state.modules.some((m) => m.type === choice.costWithout!.module);
    if (!hasModule) {
      unprotected = true;
      pay(choice.costWithout.cost);
      text = choice.resultWithout ?? text;
    }
  }

  const modules = choice.repairs
    ? state.modules.map((m) => (m.type === choice.repairs ? { ...m, broken: false } : m))
    : state.modules;

  return {
    ...state,
    resources,
    modules,
    activeEvent: null,
    log: [...state.log, { day: state.day, text }],
    history: [...state.history, { day: state.day, kind: "choice", event: state.activeEvent!, choice: choice.id, unprotected }],
  };
}
