export type ResourceKey = "oxygen" | "water" | "food" | "energy" | "health";
export type Resources = Record<ResourceKey, number>;

export type ModuleType = "habitat" | "lifeSupport" | "solar" | "battery" | "greenhouse" | "shelter";

export type ModuleDef = {
  type: ModuleType;   // название и описание лежат в словарях i18n: module.<type>.name / .desc
  cost: Partial<Resources>;         // разово при постройке
  perDay: Partial<Resources>;       // каждый день: + даёт, − берёт
  nightPerDay?: Partial<Resources>; // ночью, если отличается (панели, батарея)
};

export type PlacedModule = { slot: number; type: ModuleType; broken: boolean };

// Выбор в событии. Тексты лежат в словарях i18n: ev.<event>.<choice>.label / .hint, строки журнала по ключам result
// Цена в том же формате, что cost у модулей: положительное число = сколько ресурса забирает
export type EventChoice = {
  id: string;
  cost: Partial<Resources>;                                       // всегда
  costWithout?: { module: ModuleType; cost: Partial<Resources> }; // доплата, если такого модуля на базе нет
  repairs?: ModuleType;                                           // чинит все модули этого типа
  result: string;                                                 // ключ i18n строки для журнала
  resultWithout?: string;                                         // ключ i18n, если модуля нет
};

// Заголовок и описание события: ev.<id>.title / ev.<id>.text
export type EventDef = { id: string; choices: EventChoice[] };

// Реальная вспышка из NASA DONKI (src/data/nasa/flares.json)
export type Flare = {
  id: string;
  date: string;        // день пика, YYYY-MM-DD
  peakTime: string;
  class: string;       // например "X1.2"
  location: string | null;
  activeRegion: number | null;
  link: string;        // страница вспышки в DONKI
  source: string;      // "NASA DONKI"
};

// Что реально произошло за миссию. По этой истории строится итоговый разбор (engine/debrief.ts)
export type HistoryEntry =
  | { day: number; kind: "built"; module: ModuleType }
  | { day: number; kind: "choice"; event: string; choice: string; unprotected: boolean } // unprotected: не было нужного модуля
  | { day: number; kind: "shortage"; resource: ResourceKey }                             // ресурс упал до нуля
  | { day: number; kind: "blackout"; night: boolean };                                   // база осталась без энергии

export type GameState = {
  history: HistoryEntry[];
  flare: Flare | null; // вспышка, которая случится в этой миссии (выбрана при старте)
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
