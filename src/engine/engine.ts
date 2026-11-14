import modulesData from "../data/modules.json";
import type { Action, CrewMember, GameState, ModuleDef, ModuleType, PlacedModule, ResourceKey, Resources, Role } from "../types";
import { applyEventStart, eventForDay, pickFlare, resolveEvent } from "./events";
import { canPlace, cellOf, slotOf } from "./placement";
import { moduleName, t } from "../i18n";
import { BUILD_MS, DAY_MS, ILLNESS_CHANCE, ILLNESS_GAP, MAX_ILLNESS, MISSION_DAYS, NIGHT_START } from "./constants";
import { assignWaiting, hasFreeCrew, pickBuilder, restCrew } from "./crew";
import { issueTasks, MORALE_START, reviewTasks } from "./tasks";

export { BUILD_MS, DAY_MS, MISSION_DAYS, NIGHT_START };
export { hasFreeCrew, pickBuilder };

// Случайное число от 0 до 1 из seed и следующий seed (mulberry32). Состояние хранит seed, поэтому игра воспроизводима
export function nextRandom(seed: number): [number, number] {
  const s = (seed + 0x6d2b79f5) | 0;
  let x = Math.imul(s ^ (s >>> 15), 1 | s);
  x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
  return [((x ^ (x >>> 14)) >>> 0) / 4294967296, s];
}
// id совпадают с crew.n<id> в словарях и с crewData.ts. Номера 3 больше нет: Софию убрали из экипажа,
// врача на базе нет, поэтому убежище и медпункт закреплены за техником.
const CREW_ROLES: { id: number; role: Role }[] = [
  { id: 1, role: "engineer" },
  { id: 2, role: "scientist" },
  { id: 4, role: "technician" },
];

const MODULES = modulesData as ModuleDef[];
const KEYS: ResourceKey[] = ["oxygen", "water", "food", "energy", "health", "materials"];
const CREW_PER_DAY: Partial<Resources> = { oxygen: -5, water: -3, food: -4 };
// Сколько здоровья отнимает нехватка воздуха, воды или еды. Бьёт с задержкой в 2 дня и повторяется, пока ресурс на нуле
export const SHORTAGE_DAMAGE = 25;
const VITAL: ResourceKey[] = ["oxygen", "water", "food"];
const vitalName = (key: ResourceKey) => t(`vital.${key}`);

export function getDef(type: ModuleType): ModuleDef {
  return MODULES.find((m) => m.type === type)!;
}

// Сколько каждого ресурса помещается на базе. Без складов везде 100: баланс как раньше.
// Склад и батарея добавляют места (поле capacity в modules.json)
export const BASE_CAPACITY = 100;

export function capacityOf(modules: PlacedModule[]): Resources {
  const cap: Resources = { oxygen: 0, water: 0, food: 0, energy: 0, health: 0, materials: 0 };
  for (const key of KEYS) cap[key] = BASE_CAPACITY;
  for (const module of modules) {
    if (module.broken || module.build) continue;
    const extra = getDef(module.type).capacity;
    if (extra) for (const key of KEYS) cap[key] += extra[key] ?? 0;
  }
  return cap;
}

export function clamp(value: number, max = BASE_CAPACITY) {
  return Math.max(0, Math.min(max, value));
}

function addTo(target: Resources, delta: Partial<Resources>) {
  for (const key of KEYS) target[key] += delta[key] ?? 0;
}

// Модуль в стройке занимает клетку, но ещё не работает
export const isWorking = (m: PlacedModule) => !m.build;

function moduleOutput(module: PlacedModule, isNight: boolean): Partial<Resources> {
  if (module.broken || module.build) return {};
  const def = getDef(module.type);
  return isNight && def.nightPerDay ? def.nightPerDay : def.perDay;
}

export function initialState(startSeed: number = (Math.random() * 2 ** 32) >>> 0): GameState {
  // Вспышка тоже выбирается по seed: одна и та же игра повторяется целиком
  const [flareRoll, seed] = nextRandom(startSeed);
  const state: GameState = {
    seed,
    illness: null,
    sickCount: 0,
    lastIllnessDay: 0,
    crew: CREW_ROLES.map(({ id, role }): CrewMember => ({ id, role, morale: MORALE_START, status: { kind: "free" } })),
    tasks: [],
    clockMs: 0,
    day: 1,
    isNight: false,
    // еды с ракеты хватает на 10 дней из 20: без теплицы миссию не пройти.
    // материалов 10, а убежище стоит 25: сначала нужен карьер
    resources: { oxygen: 80, water: 70, food: 40, energy: 60, health: 100, materials: 10 },
    modules: [
      // На Луне есть только жилой модуль рядом с посадочной площадкой (ряд 5, колонка 12).
      // Энергию, воду, еду и укрытие игрок строит сам
      { slot: slotOf(3, 11), type: "habitat", broken: false },
      { slot: slotOf(7, 11), type: "lifeSupport", broken: false },
    ],
    pending: [],
    activeEvent: null,
    flare: pickFlare(() => flareRoll),
    history: [],
    log: [{ day: 1, text: t("log.landed") }],
    status: "playing",
  };
  return issueTasks(state); // первые задания экипаж даёт сразу
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
  const history = [...state.history];
  const day = state.day + 1;
  // Номер дня для журнала и истории. Последний шаг миссии относится к её последнему дню, а не к «дню 21»
  const stamp = Math.min(day, MISSION_DAYS);

  // Без энергии всё, что её потребляет, отключается
  const noPower = resources.energy <= 0;
  for (const module of state.modules) {
    const output = moduleOutput(module, state.isNight);
    if (noPower && (output.energy ?? 0) < 0) continue;
    addTo(resources, output);
  }
  if (noPower) {
    log.push({ day: stamp, text: t("log.noPower") });
    history.push({ day: stamp, kind: "blackout", night: state.isNight });
  }
  addTo(resources, CREW_PER_DAY);
  const capacity = capacityOf(state.modules);
  for (const key of KEYS) resources[key] = clamp(resources[key], capacity[key]);

  // Отложенные последствия
  const pending: GameState["pending"] = [];
  for (const effect of state.pending) {
    if (effect.inDays <= 1) {
      resources[effect.key] = clamp(resources[effect.key] + effect.amount, capacity[effect.key]);
      log.push({ day: stamp, text: effect.reason });
    } else {
      pending.push({ ...effect, inDays: effect.inDays - 1 });
    }
  }

  // Закончился жизненно важный ресурс — последствие наступит через 2 дня
  for (const key of VITAL) {
    if (resources[key] > 0) continue;
    const reason = t("log.vitalHealth", { what: vitalName(key), n: SHORTAGE_DAMAGE });
    if (pending.some((p) => p.reason === reason)) continue;
    pending.push({ inDays: 2, key: "health", amount: -SHORTAGE_DAMAGE, reason });
    log.push({ day: stamp, text: t("log.vitalOut", { what: vitalName(key) }) });
    history.push({ day: stamp, kind: "shortage", resource: key });
  }

  if (day === NIGHT_START - 2) log.push({ day: stamp, text: t("log.night2") });
  if (day === NIGHT_START) log.push({ day: stamp, text: t("log.nightStart") });

  let next: GameState = {
    ...state,
    day: Math.min(day, MISSION_DAYS),
    isNight: day >= NIGHT_START,
    resources,
    pending,
    log,
    history,
  };

  if (resources.health <= 0) return { ...next, status: "lost" };
  if (day > MISSION_DAYS) return { ...next, status: "won" };

  // Новый день: проверяем задания и просим новые
  next = issueTasks(reviewTasks(next));

  const eventId = eventForDay(day);
  if (eventId) next = applyEventStart({ ...next, activeEvent: eventId }, eventId);
  return next;
}

function build(state: GameState, slot: number, type: ModuleType): GameState {
  const { row, col } = cellOf(slot);
  if (!canPlace(state, type, row, col)) return state;
  const builder = pickBuilder(state, type);
  if (!builder) return state; // все заняты: модуль не ставится
  const def = getDef(type);
  const resources = { ...state.resources };
  for (const key of KEYS) {
    const cost = def.cost[key] ?? 0;
    if (resources[key] < cost) return state;
    resources[key] -= cost;
  }
  // Заболеет ли строитель, решаем сейчас по seed: так игра воспроизводима, а проверки не прыгают
  const [roll, seed1] = nextRandom(state.seed);
  const [when, seed2] = nextRandom(seed1);
  const canFall =
    state.day >= 2 &&
    state.sickCount < MAX_ILLNESS &&
    (state.sickCount === 0 || state.day - state.lastIllnessDay >= ILLNESS_GAP) &&
    !state.illness &&
    !state.modules.some((m) => m.build?.sickAt !== undefined);
  const sickAt = canFall && roll < ILLNESS_CHANCE ? Math.round(BUILD_MS * (0.3 + 0.4 * when)) : undefined;
  return {
    ...state,
    seed: seed2,
    resources,
    modules: [...state.modules, { slot, type, broken: false, build: { leftMs: BUILD_MS, totalMs: BUILD_MS, crewId: builder.id, sickAt } }],
    crew: state.crew.map((c) => (c.id === builder.id ? { ...c, status: { kind: "building", slot, module: type } } : c)),
    log: [...state.log, { day: state.day, text: t("log.buildStarted", { who: t(`crew.n${builder.id}`), name: moduleName(type) }) }],
  };
}

// Стройка идёт, пока идёт время. Готовый модуль начинает работать, строитель освобождается.
// Если пришло время болезни, открывается событие
function advanceBuilds(state: GameState, ms: number): GameState {
  if (!state.modules.some((m) => m.build)) return state;
  const log = [...state.log];
  const history = [...state.history];
  const freed = new Set<number>();
  const sick: { crewId: number; slot: number }[] = [];
  const modules = state.modules.map((m) => {
    if (!m.build || m.build.crewId === null) return m; // строителя нет: время стройки не идёт
    const leftMs = m.build.leftMs - ms;
    if (leftMs > 0) {
      if (m.build.sickAt !== undefined && leftMs <= m.build.sickAt && sick.length === 0 && !state.illness && !state.activeEvent) {
        sick.push({ crewId: m.build.crewId, slot: m.slot });
        const { sickAt: _fired, ...rest } = m.build;
        return { ...m, build: { ...rest, leftMs } };
      }
      return { ...m, build: { ...m.build, leftMs } };
    }
    freed.add(m.build.crewId);
    log.push({ day: state.day, text: t("log.built", { name: moduleName(m.type) }) });
    history.push({ day: state.day, kind: "built", module: m.type });
    const { build: _done, ...ready } = m;
    return ready;
  });
  const crew = state.crew.map((c): CrewMember => (freed.has(c.id) ? { ...c, status: { kind: "free" } } : c));
  // Достроили модуль: задание могло выполниться, это видно сразу, а не на следующий день
  const next = reviewTasks({ ...state, modules, crew, log, history });
  if (sick.length === 0) return next;
  return {
    ...next,
    activeEvent: "illness",
    illness: sick[0],
    sickCount: next.sickCount + 1,
    lastIllnessDay: next.day,
    log: [...next.log, { day: next.day, text: t("log.illness", { name: t(`crew.n${sick[0].crewId}`) }) }],
  };
}

// Прошло ms мс игрового времени. Время дня и стройка идут от одних часов: пауза и ускорение работают сразу для всего.
// Если за это время наступает событие или миссия кончается, оставшееся время отбрасываем
// Через сколько мс начнётся ближайшая болезнь. Шаг времени не должен перепрыгнуть этот момент,
// даже если кто-то передал большой tick (например, «пропустить день»)
function msUntilSick(state: GameState): number {
  let soonest = Infinity;
  for (const m of state.modules) {
    if (m.build?.sickAt !== undefined && m.build.crewId !== null) soonest = Math.min(soonest, m.build.leftMs - m.build.sickAt);
  }
  return Math.max(1, soonest);
}

function tick(state: GameState, ms: number): GameState {
  let s = state;
  let left = ms;
  while (left > 0 && s.status === "playing" && !s.activeEvent) {
    const step = Math.min(left, DAY_MS - s.clockMs, msUntilSick(s));
    left -= step;
    s = assignWaiting(restCrew(s, step)); // больные отдыхают, свободные подхватывают брошенные стройки
    s = advanceBuilds(s, step);
    const clockMs = s.clockMs + step;
    if (s.activeEvent) {
      // Началась болезнь: день не меняем, пока игрок не выберет. Остаток времени отбрасываем
      s = { ...s, clockMs: Math.min(clockMs, DAY_MS - 1) };
      break;
    }
    s = clockMs >= DAY_MS ? nextDay({ ...s, clockMs: 0 }) : { ...s, clockMs };
  }
  return s;
}

export const REPAIR_COST: Partial<Resources> = { water: 10, energy: 10 };

function repairModule(state: GameState, slot: number): GameState {
  const mod = state.modules.find((m) => m.slot === slot);
  if (!mod || !mod.broken) return state;
  const resources = { ...state.resources };
  for (const key of KEYS) {
    const cost = REPAIR_COST[key] ?? 0;
    if (resources[key] < cost) return state;
    resources[key] -= cost;
  }
  const modules = state.modules.map((m) => (m.slot === slot ? { ...m, broken: false } : m));
  // Якщо було активне модальне вікно поломки — закриваємо його також
  const activeEvent = state.activeEvent === "breakdown" ? null : state.activeEvent;
  const history: typeof state.history = [
    ...state.history,
    { day: state.day, kind: "choice", event: "breakdown", choice: "repair", unprotected: false },
  ];
  return {
    ...state,
    resources,
    modules,
    activeEvent,
    history,
    log: [...state.log, { day: state.day, text: t("log.repaired") }],
  };
}

export function reduce(state: GameState, action: Action): GameState {
  switch (action.type) {
    case "tick":
      return tick(state, action.ms);
    case "nextDay":
      return tick(state, DAY_MS - state.clockMs);
    case "build":
      return build(state, action.slot, action.module);
    case "repair":
      return repairModule(state, action.slot);
    case "resolveEvent": {
      const next = resolveEvent(state, action.choice);
      return next.resources.health <= 0 ? { ...next, status: "lost" } : next;
    }
  }
}
