import type { GameState } from "@/types";
import { BUILD_MS, ILLNESS_CHANCE, ILLNESS_GAP, MAX_ILLNESS } from "@/engine/constants";
import { msg } from "@/engine/msg";
import { nextRandom } from "@/engine/random";

// Заболеет ли строитель, решаем в момент старта стройки по seed: так игра воспроизводима, а проверки не прыгают.
// Возвращает, когда строитель заболеет (leftMs, при котором это случится), и новый seed
export function rollIllness(state: GameState): { sickAt: number | undefined; seed: number } {
  const [roll, seed1] = nextRandom(state.seed);
  const [when, seed2] = nextRandom(seed1);
  const canFall =
    state.day >= 2 &&
    state.sickCount < MAX_ILLNESS &&
    (state.sickCount === 0 || state.day - state.lastIllnessDay >= ILLNESS_GAP) &&
    !state.illness &&
    !state.modules.some((m) => m.build?.sickAt !== undefined);
  return { sickAt: canFall && roll < ILLNESS_CHANCE ? Math.round(BUILD_MS * (0.3 + 0.4 * when)) : undefined, seed: seed2 };
}

// Через сколько мс начнётся ближайшая болезнь. Шаг времени не должен перепрыгнуть этот момент,
// даже если кто-то передал большой tick (например, «пропустить день»)
export function msUntilSick(state: GameState): number {
  let soonest = Infinity;
  for (const m of state.modules) {
    if (m.build?.sickAt !== undefined && m.build.crewId !== null) soonest = Math.min(soonest, m.build.leftMs - m.build.sickAt);
  }
  return Math.max(1, soonest);
}

// Строитель заболел: открывается событие «болезнь»
export function startIllness(state: GameState, patient: { crewId: number; slot: number }): GameState {
  return {
    ...state,
    activeEvent: "illness",
    illness: patient,
    sickCount: state.sickCount + 1,
    lastIllnessDay: state.day,
    log: [...state.log, { day: state.day, ...msg("log.illness", { name: patient.crewId }) }],
  };
}
