import modulesData from "../data/modules.json";
import type { GameState, ModuleDef, ModuleType, PlacedModule, ResourceKey, Resources } from "../types";

// Чтение состояния и таблиц модулей: чистые функции без изменений

const MODULES = modulesData as ModuleDef[];

export const RESOURCE_KEYS: ResourceKey[] = ["oxygen", "water", "food", "energy", "health", "materials"];
// Что экипаж тратит каждый день
export const CREW_PER_DAY: Partial<Resources> = { oxygen: -5, water: -3, food: -4 };

export function getDef(type: ModuleType): ModuleDef {
  return MODULES.find((m) => m.type === type)!;
}

// Сколько каждого ресурса помещается на базе. Без складов везде 100: баланс как раньше.
// Склад и батарея добавляют места (поле capacity в modules.json)
export const BASE_CAPACITY = 100;

export function capacityOf(modules: PlacedModule[]): Resources {
  const cap: Resources = { oxygen: 0, water: 0, food: 0, energy: 0, health: 0, materials: 0 };
  for (const key of RESOURCE_KEYS) cap[key] = BASE_CAPACITY;
  for (const module of modules) {
    if (module.broken || module.build) continue;
    const extra = getDef(module.type).capacity;
    if (extra) for (const key of RESOURCE_KEYS) cap[key] += extra[key] ?? 0;
  }
  return cap;
}

export function clamp(value: number, max = BASE_CAPACITY) {
  return Math.max(0, Math.min(max, value));
}

export function addTo(target: Resources, delta: Partial<Resources>) {
  for (const key of RESOURCE_KEYS) target[key] += delta[key] ?? 0;
}

// Модуль в стройке занимает клетку, но ещё не работает
export const isWorking = (m: PlacedModule) => !m.build;

export function moduleOutput(module: PlacedModule, isNight: boolean): Partial<Resources> {
  if (module.broken || module.build) return {};
  const def = getDef(module.type);
  return isNight && def.nightPerDay ? def.nightPerDay : def.perDay;
}

// Сколько каждого ресурса прибавится или убавится за следующий день
export function dailyDelta(state: GameState): Partial<Resources> {
  const total: Resources = { oxygen: 0, water: 0, food: 0, energy: 0, health: 0, materials: 0 };
  addTo(total, CREW_PER_DAY);
  for (const module of state.modules) addTo(total, moduleOutput(module, state.isNight));
  return total;
}
