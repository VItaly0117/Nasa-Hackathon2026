import type { CrewMember, GameState, Role } from "@/types";
import { msg } from "./msg";
import { nearestGroundSlot } from "./placement";
import { nextRandom } from "./random";
import { pickFlare } from "@/engine/systems/events";
import { issueTasks, MORALE_START } from "@/engine/systems/tasks";

// id совпадают с crew.n<id> в словарях и с crewData.ts. Под номером 3 теперь врач Виталий:
// убежище и медпункт закреплены за ним.
const CREW_ROLES: { id: number; role: Role }[] = [
  { id: 1, role: "engineer" },
  { id: 2, role: "scientist" },
  { id: 3, role: "doctor" },
  { id: 4, role: "technician" },
];

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
    research: [],
    clockMs: 0,
    day: 1,
    isNight: false,
    // еды с ракеты хватает на 10 дней из 20: без теплицы миссию не пройти.
    // материалов 10, а убежище стоит 25: сначала нужен карьер
    resources: { oxygen: 80, water: 70, food: 40, energy: 60, health: 100, materials: 10 },
    modules: [
      // На Луне есть только жилой модуль и жизнеобеспечение рядом с ракетой на фоновой картинке
      // (координаты в её пикселях). Энергию, воду, еду и укрытие игрок строит сам
      { slot: nearestGroundSlot(650, 300), type: "habitat", broken: false },
      { slot: nearestGroundSlot(560, 440), type: "lifeSupport", broken: false },
    ],
    pending: [],
    activeEvent: null,
    flare: pickFlare(() => flareRoll),
    history: [],
    log: [{ day: 1, ...msg("log.landed") }],
    status: "playing",
  };
  return issueTasks(state); // первые задания экипаж даёт сразу
}
