import type { CrewMember, GameState, ModuleType } from "../../types";
import { BUILD_MS } from "../constants";
import { msg } from "../msg";
import { canPlace, cellOf } from "../placement";
import { getDef, RESOURCE_KEYS } from "../selectors";
import { pickBuilder } from "../systems/crew";
import { rollIllness, startIllness } from "../systems/illness";
import { reviewTasks } from "../systems/tasks";

// Начать стройку: свободный член экипажа берёт модуль, ресурсы списываются сразу
export function build(state: GameState, slot: number, type: ModuleType): GameState {
  const { row, col } = cellOf(slot);
  if (!canPlace(state, type, row, col)) return state;
  const builder = pickBuilder(state, type);
  if (!builder) return state; // все заняты: модуль не ставится
  const def = getDef(type);
  const resources = { ...state.resources };
  for (const key of RESOURCE_KEYS) {
    const cost = def.cost[key] ?? 0;
    if (resources[key] < cost) return state;
    resources[key] -= cost;
  }
  const { sickAt, seed } = rollIllness(state);
  return {
    ...state,
    seed,
    resources,
    modules: [...state.modules, { slot, type, broken: false, build: { leftMs: BUILD_MS, totalMs: BUILD_MS, crewId: builder.id, sickAt } }],
    crew: state.crew.map((c) => (c.id === builder.id ? { ...c, status: { kind: "building", slot, module: type } } : c)),
    log: [...state.log, { day: state.day, ...msg("log.buildStarted", { who: builder.id, name: type }) }],
  };
}

// Стройка идёт, пока идёт время. Готовый модуль начинает работать, строитель освобождается.
// Если пришло время болезни, открывается событие
export function advanceBuilds(state: GameState, ms: number): GameState {
  if (!state.modules.some((m) => m.build)) return state;
  // Журнал и историю копируем, только если в них что-то добавилось: за такт обычно меняется лишь время стройки,
  // и тогда у состояния остаются прежние ссылки на log, history и crew (интерфейс не перерисовывает то, что не изменилось)
  const added: { log: GameState["log"]; history: GameState["history"] } = { log: [], history: [] };
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
    added.log.push({ day: state.day, ...msg("log.built", { name: m.type }) });
    added.history.push({ day: state.day, kind: "built", module: m.type });
    const { build: _done, ...ready } = m;
    return ready;
  });
  const crew = freed.size ? state.crew.map((c): CrewMember => (freed.has(c.id) ? { ...c, status: { kind: "free" } } : c)) : state.crew;
  const log = added.log.length ? [...state.log, ...added.log] : state.log;
  const history = added.history.length ? [...state.history, ...added.history] : state.history;
  // Достроили модуль: задание могло выполниться, это видно сразу, а не на следующий день
  const next = reviewTasks({ ...state, modules, crew, log, history });
  return sick.length === 0 ? next : startIllness(next, sick[0]);
}
