import modulesData from "../data/modules.json";
import type { Action, GameState, ModuleDef, ModuleType, PlacedModule, ResourceKey, Resources } from "../types";
import { applyEventStart, eventForDay, resolveEvent } from "./events";
import { canPlace, cellOf, slotOf } from "./placement";

export const MISSION_DAYS = 20;
export const NIGHT_START = 14;

const MODULES = modulesData as ModuleDef[];
const KEYS: ResourceKey[] = ["oxygen", "water", "food", "energy", "health", "materials"];
const CREW_PER_DAY: Partial<Resources> = { oxygen: -5, water: -3, food: -4 };
const VITAL: ResourceKey[] = ["oxygen", "water", "food"];
const VITAL_NAMES: Partial<Record<ResourceKey, string>> = { oxygen: "кислорода", water: "воды", food: "еды" };

export function getDef(type: ModuleType): ModuleDef {
  return MODULES.find((m) => m.type === type)!;
}

export function clamp(value: number) {
  return Math.max(0, Math.min(100, value));
}

function addTo(target: Resources, delta: Partial<Resources>) {
  for (const key of KEYS) target[key] += delta[key] ?? 0;
}

function moduleOutput(module: PlacedModule, isNight: boolean): Partial<Resources> {
  if (module.broken) return {};
  const def = getDef(module.type);
  return isNight && def.nightPerDay ? def.nightPerDay : def.perDay;
}

export function initialState(): GameState {
  return {
    day: 1,
    isNight: false,
    resources: { oxygen: 80, water: 70, food: 60, energy: 60, health: 100, materials: 10 },
    modules: [
      // стартовая база вокруг посадочной площадки (ряд 5, колонка 12) — ближе к середине карты
      { slot: slotOf(4, 13), type: "habitat", broken: false },
      { slot: slotOf(6, 13), type: "lifeSupport", broken: false },
      { slot: slotOf(5, 13), type: "solar", broken: false },
    ],
    pending: [],
    activeEvent: null,
    log: [{ day: 1, text: "Экипаж высадился на южном полюсе Луны" }],
    status: "playing",
  };
}

// Сколько каждого ресурса прибавится или убавится за следующий день
export function dailyDelta(state: GameState): Partial<Resources> {
  const total: Resources = { oxygen: 0, water: 0, food: 0, energy: 0, health: 0, materials: 0 };
  addTo(total, CREW_PER_DAY);
  for (const module of state.modules) addTo(total, moduleOutput(module, state.isNight));
  return total;
}

function nextDay(state: GameState): GameState {
  const resources = { ...state.resources };
  const log = [...state.log];
  const day = state.day + 1;

  // Без энергии всё, что её потребляет, отключается
  const noPower = resources.energy <= 0;
  for (const module of state.modules) {
    const output = moduleOutput(module, state.isNight);
    if (noPower && (output.energy ?? 0) < 0) continue;
    addTo(resources, output);
  }
  if (noPower) log.push({ day, text: "Нет энергии: системы, которым она нужна, отключены" });
  addTo(resources, CREW_PER_DAY);
  for (const key of KEYS) resources[key] = clamp(resources[key]);

  // Отложенные последствия
  const pending: GameState["pending"] = [];
  for (const effect of state.pending) {
    if (effect.inDays <= 1) {
      resources[effect.key] = clamp(resources[effect.key] + effect.amount);
      log.push({ day, text: effect.reason });
    } else {
      pending.push({ ...effect, inDays: effect.inDays - 1 });
    }
  }

  // Закончился жизненно важный ресурс — последствие наступит через 2 дня
  for (const key of VITAL) {
    if (resources[key] > 0) continue;
    const reason = `Без ${VITAL_NAMES[key]} экипаж слабеет: здоровье −20`;
    if (pending.some((p) => p.reason === reason)) continue;
    pending.push({ inDays: 2, key: "health", amount: -20, reason });
    log.push({ day, text: `Закончились запасы ${VITAL_NAMES[key]}` });
  }

  if (day === NIGHT_START - 2) log.push({ day, text: "Через 2 дня наступит лунная ночь" });
  if (day === NIGHT_START) log.push({ day, text: "Наступила лунная ночь: панели не дают энергии" });

  let next: GameState = {
    ...state,
    day: Math.min(day, MISSION_DAYS),
    isNight: day >= NIGHT_START,
    resources,
    pending,
    log,
  };

  if (resources.health <= 0) return { ...next, status: "lost" };
  if (day > MISSION_DAYS) return { ...next, status: "won" };

  const eventId = eventForDay(day);
  if (eventId) next = applyEventStart({ ...next, activeEvent: eventId }, eventId);
  return next;
}

function build(state: GameState, slot: number, type: ModuleType): GameState {
  const { row, col } = cellOf(slot);
  if (!canPlace(state, type, row, col)) return state;
  const def = getDef(type);
  const resources = { ...state.resources };
  for (const key of KEYS) {
    const cost = def.cost[key] ?? 0;
    if (resources[key] < cost) return state;
    resources[key] -= cost;
  }
  return {
    ...state,
    resources,
    modules: [...state.modules, { slot, type, broken: false }],
    log: [...state.log, { day: state.day, text: `Построен модуль «${def.name}»` }],
  };
}

export function reduce(state: GameState, action: Action): GameState {
  switch (action.type) {
    case "nextDay":
      return state.status === "playing" && !state.activeEvent ? nextDay(state) : state;
    case "build":
      return build(state, action.slot, action.module);
    case "resolveEvent": {
      const next = resolveEvent(state, action.choice);
      return next.resources.health <= 0 ? { ...next, status: "lost" } : next;
    }
  }
}
