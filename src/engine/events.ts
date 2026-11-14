import eventsData from "../data/events.json";
import flaresData from "../data/nasa/flares.json";
import { getLang, t } from "../i18n";
import type { EventDef, Flare, GameState, ResourceKey, Resources } from "../types";

const FLARES = flaresData as Flare[];
const EVENTS = eventsData as EventDef[];

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

const LOCALES = { ru: "ru-RU", uk: "uk-UA", en: "en-US" } as const;

// «класс X1.2, 14 мая 2024» на текущем языке игры
export function describeFlare(flare: Flare): string {
  const date = new Intl.DateTimeFormat(LOCALES[getLang()], { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(flare.date))
    .replace(/\s*[гр]\.$/, ""); // Intl добавляет «г.» / «р.»: убираем, чтобы фраза не кончалась двумя точками
  return t("flare.desc", { cls: flare.class, date });
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
      log: [...state.log, { day: state.day, text: t("log.flareReal", { flare: describeFlare(state.flare) }) }],
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

  pay(choice.cost);

  let textKey = choice.result;
  let unprotected = false;
  if (choice.costWithout) {
    const hasModule = state.modules.some((m) => m.type === choice.costWithout!.module && !m.build);
    if (!hasModule) {
      unprotected = true;
      pay(choice.costWithout.cost);
      textKey = choice.resultWithout ?? textKey;
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
    log: [...state.log, { day: state.day, text: t(textKey) }],
    history: [...state.history, { day: state.day, kind: "choice", event: state.activeEvent!, choice: choice.id, unprotected }],
  };
}
