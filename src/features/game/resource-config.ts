import type { ResourceKey } from "@/types";

// Пороги цвета ресурса: зелёный → жёлтый → красный. Уровень берётся худший из двух проверок:
// по запасу в днях (если ресурс убывает) и по заполненности склада
export const RESOURCE_THRESHOLDS = {
  warnDays: 5,         // жёлтый, если хватит меньше чем на столько дней
  dangerDays: 2,       // красный
  warnFraction: 0.25,  // жёлтый, если осталось не больше четверти вместимости
  dangerFraction: 0.1, // красный: почти пусто (например, энергия 3 из 400)
};

// Материалы мало-мало не страшны: «пусто» для них не тревога, поэтому по заполненности их не проверяем
export const CHECK_FRACTION: ResourceKey[] = ["oxygen", "water", "food", "energy", "health"];

export type ResourceLevel = "ok" | "warn" | "danger";

const RANK: Record<ResourceLevel, number> = { ok: 0, warn: 1, danger: 2 };
const worst = (a: ResourceLevel, b: ResourceLevel) => (RANK[a] >= RANK[b] ? a : b);

// daysLeft: на сколько дней хватит (дробное число), null, если ресурс не убывает
export function resourceLevel(key: ResourceKey, value: number, capacity: number, daysLeft: number | null): ResourceLevel {
  const { warnDays, dangerDays, warnFraction, dangerFraction } = RESOURCE_THRESHOLDS;
  let level: ResourceLevel = "ok";
  if (daysLeft !== null) level = daysLeft <= dangerDays ? "danger" : daysLeft <= warnDays ? "warn" : "ok";
  if (CHECK_FRACTION.includes(key) && capacity > 0) {
    const fill = value / capacity;
    level = worst(level, fill <= dangerFraction ? "danger" : fill <= warnFraction ? "warn" : "ok");
  }
  return level;
}
