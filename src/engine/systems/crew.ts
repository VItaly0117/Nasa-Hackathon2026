import modulesData from "@/content/modules.json";
import { msg } from "@/engine/msg";
import type { CrewMember, GameState, ModuleDef, ModuleType } from "@/types";

const MODULES = modulesData as ModuleDef[];

// Кого поставить строить: свободного с подходящей ролью, иначе любого свободного
export function pickBuilder(state: GameState, type: ModuleType): CrewMember | null {
  const free = state.crew.filter((c) => c.status.kind === "free");
  const role = MODULES.find((m) => m.type === type)?.builder;
  return free.find((c) => c.role === role) ?? free[0] ?? null;
}

export const hasFreeCrew = (state: GameState) => state.crew.some((c) => c.status.kind === "free");

// Брошенные стройки (строитель заболел) подхватывает первый свободный
export function assignWaiting(state: GameState): GameState {
  let s = state;
  for (const waiting of state.modules.filter((m) => m.build && m.build.crewId === null)) {
    const builder = pickBuilder(s, waiting.type);
    if (!builder) break;
    s = {
      ...s,
      modules: s.modules.map((m) => (m.slot === waiting.slot && m.build ? { ...m, build: { ...m.build, crewId: builder.id } } : m)),
      crew: s.crew.map((c) => (c.id === builder.id ? { ...c, status: { kind: "building", slot: waiting.slot, module: waiting.type } } : c)),
    };
  }
  return s;
}

// Больной выбывает на ms мс: его стройка встаёт и ждёт другого
export function restPatient(state: GameState, crewId: number, ms: number): GameState {
  return assignWaiting({
    ...state,
    modules: state.modules.map((m) => (m.build && m.build.crewId === crewId ? { ...m, build: { ...m.build, crewId: null } } : m)),
    crew: state.crew.map((c) => (c.id === crewId ? { ...c, status: { kind: "sick", leftMs: ms } } : c)),
  });
}

// Больные отдыхают, пока идёт время. Выздоровевший снова свободен
export function restCrew(state: GameState, ms: number): GameState {
  if (!state.crew.some((c) => c.status.kind === "sick")) return state;
  const log = [...state.log];
  const crew = state.crew.map((c): CrewMember => {
    if (c.status.kind !== "sick") return c;
    const leftMs = c.status.leftMs - ms;
    if (leftMs > 0) return { ...c, status: { kind: "sick", leftMs } };
    log.push({ day: state.day, ...msg("log.recovered", { name: c.id }) });
    return { ...c, status: { kind: "free" } };
  });
  return { ...state, crew, log };
}
