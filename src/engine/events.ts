import type { GameState } from "../types";

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
  return state;
}

export function resolveEvent(state: GameState, choice: string): GameState {
  const resources = { ...state.resources };
  let modules = state.modules;
  let text = "";

  switch (`${state.activeEvent}:${choice}`) {
    case "breakdown:repair":
      resources.water = clamp(resources.water - 10);
      resources.energy = clamp(resources.energy - 10);
      modules = modules.map((m) => (m.type === "lifeSupport" ? { ...m, broken: false } : m));
      text = "Жизнеобеспечение починили";
      break;
    case "breakdown:ignore":
      text = "Ремонт отложен: жизнеобеспечение не работает";
      break;
    case "flare:hide": {
      const hasShelter = modules.some((m) => m.type === "shelter");
      if (!hasShelter) resources.health = clamp(resources.health - 10);
      text = hasShelter ? "Экипаж переждал вспышку в убежище" : "Убежища нет: укрылись за баками с водой, здоровье −10";
      break;
    }
    case "flare:work":
      resources.health = clamp(resources.health - 30);
      text = "Работа продолжалась во время вспышки: здоровье −30";
      break;
    default:
      return state;
  }

  return {
    ...state,
    resources,
    modules,
    activeEvent: null,
    log: [...state.log, { day: state.day, text }],
  };
}
