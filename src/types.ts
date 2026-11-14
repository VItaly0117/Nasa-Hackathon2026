export type ResourceKey = "oxygen" | "water" | "food" | "energy" | "health";
export type Resources = Record<ResourceKey, number>;

export type ModuleType = "habitat" | "lifeSupport" | "solar" | "battery" | "greenhouse" | "shelter";

export type ModuleDef = {
  type: ModuleType;
  name: string;
  description?: string;
  cost: Partial<Resources>;         // разово при постройке
  perDay: Partial<Resources>;       // каждый день: + даёт, − берёт
  nightPerDay?: Partial<Resources>; // ночью, если отличается (панели, батарея)
};

export type PlacedModule = { slot: number; type: ModuleType; broken: boolean };

export type GameState = {
  day: number;
  isNight: boolean;
  resources: Resources;
  modules: PlacedModule[];
  pending: { inDays: number; key: ResourceKey; amount: number; reason: string }[];
  activeEvent: string | null;
  log: { day: number; text: string }[];
  status: "playing" | "won" | "lost";
};

export type Action =
  | { type: "nextDay" }
  | { type: "build"; slot: number; module: ModuleType }
  | { type: "resolveEvent"; choice: string };
