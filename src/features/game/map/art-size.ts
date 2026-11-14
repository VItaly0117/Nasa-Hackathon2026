import type { ModuleType } from "@/types";

// Высота рисунка над землёй: по ней облачко-подпись встаёт над объектом
export const ART_HEIGHT: Record<ModuleType, number> = {
  habitat: 50,
  lifeSupport: 42,
  solar: 34,
  battery: 26,
  greenhouse: 44,
  shelter: 40,
  storage: 34,
  medbay: 34,
  iceMine: 30,
  rockMine: 30,
};
