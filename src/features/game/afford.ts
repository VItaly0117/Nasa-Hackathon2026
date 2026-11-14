import type { Resources } from "@/types";

export function canAffordCost(resources: Resources, cost: Partial<Resources>): boolean {
  return Object.entries(cost).every(([key, value]) => resources[key as keyof Resources] >= (value ?? 0));
}
