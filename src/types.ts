export type ResourceKey = "oxygen" | "water" | "food" | "energy" | "health" | "materials";
export type Resources = Record<ResourceKey, number>;

export type ModuleType =
  | "habitat" | "lifeSupport" | "solar" | "battery" | "greenhouse" | "shelter"
  | "iceMine" | "rockMine" | "storage" | "medbay";

// Роль определяет, кого игра ставит строить в первую очередь: у каждого модуля есть builder в modules.json
export type Role = "engineer" | "scientist" | "technician";

export type CrewMember = {
  id: number; // 1..4, совпадает с crew.n<id> / crew.r<id> в словарях и с crewData.ts
  role: Role;
  morale: number; // 0..100: растёт, когда задания выполнены, падает, когда просрочены
  status:
    | { kind: "free" }
    | { kind: "building"; slot: number; module: ModuleType }
    | { kind: "sick"; leftMs: number }; // болеет и отдыхает, строить не может
};

export type ModuleDef = {
  type: ModuleType;   // название и описание лежат в словарях i18n: module.<type>.name / .desc
  cost: Partial<Resources>;         // разово при постройке
  perDay: Partial<Resources>;       // каждый день: + даёт, − берёт
  nightPerDay?: Partial<Resources>; // ночью, если отличается (панели, батарея)
  capacity?: Partial<Resources>;    // сколько места для запасов добавляет модуль (склад, батарея)
  builder?: Role;                   // кто строит его в первую очередь
};

// build есть, пока модуль строится: он не работает, не потребляет и не даёт места для запасов
export type PlacedModule = {
  slot: number;
  type: ModuleType;
  broken: boolean;
  // crewId null: строитель заболел, стройка стоит, пока её не подхватит другой свободный
  // sickAt: когда leftMs дойдёт до этого числа, строитель заболеет (решено при старте стройки по seed)
  build?: { leftMs: number; totalMs: number; crewId: number | null; sickAt?: number };
};

// Выбор в событии. Тексты лежат в словарях i18n: ev.<event>.<choice>.label / .hint, строки журнала по ключам result
// Цена в том же формате, что cost у модулей: положительное число = сколько ресурса забирает
export type EventChoice = {
  id: string;
  cost: Partial<Resources>;                                       // всегда
  costWithout?: { module: ModuleType; cost: Partial<Resources> }; // доплата, если такого модуля на базе нет
  costWith?: { module: ModuleType; cost: Partial<Resources> };    // вместо cost, если такой модуль есть (медпункт делает лечение дешевле)
  rest?: { days: number; daysWith: number; module: ModuleType };  // на сколько дней больной выбывает (с модулем меньше)
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

// Задание, которое дал член экипажа. Что оно значит и когда выполнено, описано в engine/tasks.ts
export type Task = {
  id: string;
  giver: number; // id члена экипажа
  issuedDay: number;
  deadline: number; // последний день, когда ещё можно успеть
  status: "open" | "done" | "missed";
};

export type GameState = {
  seed: number; // для детерминированных случайностей (болезни): одна и та же игра повторяется
  illness: { crewId: number; slot: number } | null; // кто заболел, пока открыто событие
  sickCount: number;
  lastIllnessDay: number;
  tasks: Task[];
  crew: CrewMember[];
  clockMs: number; // сколько миллисекунд игрового времени прошло в текущем дне
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
  | { type: "tick"; ms: number } // прошло ms мс игрового времени: идёт день и стройка
  | { type: "nextDay" }      // пропустить остаток дня
  | { type: "build"; slot: number; module: ModuleType }
  | { type: "repair"; slot: number }
  | { type: "resolveEvent"; choice: string };
