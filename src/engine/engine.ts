import modulesData from "../data/modules.json";
import type { Action, CrewMember, GameState, ModuleDef, ModuleType, PlacedModule, ResourceKey, Resources, Role } from "../types";
import { applyEventStart, eventForDay, pickFlare, resolveEvent } from "./events";
import { canPlace, cellOf, slotOf } from "./placement";
import { moduleName, t } from "../i18n";

export const MISSION_DAYS = 20;
// Сколько длится игровой день. Короче нельзя: дети 7-12 должны успеть прочитать и подумать
export const DAY_MS = 25000;
// Сколько строится любой модуль: одна игровая минута, около 2,4 дня. Пауза стройку останавливает, ×2 ускоряет
export const BUILD_MS = 60000;
const CREW_ROLES: Role[] = ["engineer", "scientist", "doctor", "technician"];
export const NIGHT_START = 14;

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

export function initialState(): GameState {
  return {
    crew: CREW_ROLES.map((role, i): CrewMember => ({ id: i + 1, role, status: { kind: "free" } })),
    clockMs: 0,
    day: 1,
    isNight: false,
    // еды с ракеты хватает на 10 дней из 20: без теплицы миссию не пройти
    // материалов хватает на первые модули, а убежище (25) требует карьера
    resources: { oxygen: 80, water: 70, food: 40, energy: 60, health: 100, materials: 20 },
    modules: [
      // стартовая база вокруг посадочной площадки (ряд 5, колонка 12): каждый модуль в двух клетках
      // от неё в своей стороне, чтобы между зданиями оставалось место
      { slot: slotOf(3, 11), type: "habitat", broken: false },
      { slot: slotOf(7, 11), type: "lifeSupport", broken: false },
      { slot: slotOf(5, 14), type: "solar", broken: false },
    ],
    pending: [],
    activeEvent: null,
    flare: pickFlare(),
    history: [],
    log: [{ day: 1, text: t("log.landed") }],
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

  const eventId = eventForDay(day);
  if (eventId) next = applyEventStart({ ...next, activeEvent: eventId }, eventId);
  return next;
}

// Кого поставить строить: свободного с подходящей ролью, иначе любого свободного
export function pickBuilder(state: GameState, type: ModuleType): CrewMember | null {
  const free = state.crew.filter((c) => c.status.kind === "free");
  return free.find((c) => c.role === getDef(type).builder) ?? free[0] ?? null;
}

export const hasFreeCrew = (state: GameState) => state.crew.some((c) => c.status.kind === "free");

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
  return {
    ...state,
    resources,
    modules: [...state.modules, { slot, type, broken: false, build: { leftMs: BUILD_MS, totalMs: BUILD_MS, crewId: builder.id } }],
    crew: state.crew.map((c) => (c.id === builder.id ? { ...c, status: { kind: "building", slot, module: type } } : c)),
    log: [...state.log, { day: state.day, text: t("log.buildStarted", { who: t(`crew.n${builder.id}`), name: moduleName(type) }) }],
  };
}

// Стройка идёт, пока идёт время. Готовый модуль начинает работать, строитель освобождается
function advanceBuilds(state: GameState, ms: number): GameState {
  if (!state.modules.some((m) => m.build)) return state;
  const log = [...state.log];
  const history = [...state.history];
  const freed = new Set<number>();
  const modules = state.modules.map((m) => {
    if (!m.build) return m;
    const leftMs = m.build.leftMs - ms;
    if (leftMs > 0) return { ...m, build: { ...m.build, leftMs } };
    freed.add(m.build.crewId);
    log.push({ day: state.day, text: t("log.built", { name: moduleName(m.type) }) });
    history.push({ day: state.day, kind: "built", module: m.type });
    const { build: _done, ...ready } = m;
    return ready;
  });
  const crew = state.crew.map((c): CrewMember => (freed.has(c.id) ? { ...c, status: { kind: "free" } } : c));
  return { ...state, modules, crew, log, history };
}

// Прошло ms мс игрового времени. Время дня и стройка идут от одних часов: пауза и ускорение работают сразу для всего.
// Если за это время наступает событие или миссия кончается, оставшееся время отбрасываем
function tick(state: GameState, ms: number): GameState {
  let s = state;
  let left = ms;
  while (left > 0 && s.status === "playing" && !s.activeEvent) {
    const step = Math.min(left, DAY_MS - s.clockMs);
    left -= step;
    s = advanceBuilds(s, step);
    const clockMs = s.clockMs + step;
    s = clockMs >= DAY_MS ? nextDay({ ...s, clockMs: 0 }) : { ...s, clockMs };
  }
  return s;
}

export function reduce(state: GameState, action: Action): GameState {
  switch (action.type) {
    case "tick":
      return tick(state, action.ms);
    case "nextDay":
      return tick(state, DAY_MS - state.clockMs);
    case "build":
      return build(state, action.slot, action.module);
    case "resolveEvent": {
      const next = resolveEvent(state, action.choice);
      return next.resources.health <= 0 ? { ...next, status: "lost" } : next;
    }
  }
}
