import modulesData from "@/content/modules.json";
import consumptionData from "@/content/nasa/consumption.json";
import type { GameState, ModuleDef, ModuleType, PlacedModule, ResourceKey, Resources } from "@/types";
import { MODES } from "./constants";

// Чтение состояния и таблиц модулей: чистые функции без изменений

const MODULES = modulesData as ModuleDef[];

export const RESOURCE_KEYS: ResourceKey[] = ["oxygen", "water", "food", "energy", "health", "materials"];
// Расход экипажа за день считается по нормам NASA на человека (src/content/nasa/consumption.json, бриф OCHMO-TB-002):
// кислород 0,771 кг в покое и 1,083 кг с тренировкой, питьевая вода не менее 2,5 л, еда в среднем 3 035 ккал.
// Нормы переводятся в игровые единицы по допущениям из того же файла (раздел game): 1% кислорода = 0,7 кг,
// игровая вода = 0,3 от реальной, 1 «кг» еды = суточный рацион одного человека.
// Кислорода тратит больше тот, кто работает (строит): ему добавляется «тренировка». Отдыхающий и больной тратит как в покое.
const NORM = consumptionData.perCrewmemberPerDay;
const GAME = consumptionData.game;
const OXYGEN_REST = NORM.oxygenKgResting / GAME.oxygenKgPerUnit;
const OXYGEN_WORK = NORM.oxygenKgWithExercise / GAME.oxygenKgPerUnit;
const WATER_PER_PERSON = (NORM.potableWaterLitersMin * GAME.waterScale);
const FOOD_PER_PERSON = NORM.foodKcalAverage / GAME.foodKcalPerUnit;

const round2 = (v: number) => Math.round(v * 100) / 100;

// Что экипаж тратит за день (с поправкой на режим игры и на то, кто сейчас работает). Числа отрицательные
export function crewNeeds(state: GameState): Partial<Resources> {
  const need = MODES[state.mode ?? "normal"].need;
  let oxygen = 0;
  for (const member of state.crew) oxygen += member.status.kind === "building" ? OXYGEN_WORK : OXYGEN_REST;
  const people = state.crew.length;
  return {
    oxygen: -round2(oxygen * need),
    water: -round2(people * WATER_PER_PERSON * need),
    food: -round2(people * FOOD_PER_PERSON * need),
  };
}

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
    if (module.broken || module.build || module.paused) continue;
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
  if (module.broken || module.build || module.paused) return {};
  const def = getDef(module.type);
  return isNight && def.nightPerDay ? def.nightPerDay : def.perDay;
}

// Сколько каждого ресурса прибавится или убавится за следующий день
export function dailyDelta(state: GameState): Partial<Resources> {
  const total: Resources = { oxygen: 0, water: 0, food: 0, energy: 0, health: 0, materials: 0 };
  addTo(total, crewNeeds(state));
  for (const module of state.modules) addTo(total, moduleOutput(module, state.isNight));
  return total;
}
