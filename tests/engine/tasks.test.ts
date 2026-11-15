import { describe, expect, it } from "vitest";
import type { GameState } from "../../src/types";
import {
  MAX_OPEN,
  MISSION_DAYS,
  MORALE_START,
  MORALE_STEP,
  TASK_DEFS,
  dayOfEvent,
  initialState,
  reduce,
  reviewTasks,
  slotOf,
  tasksPerDay,
} from "../helpers/engine";

const EVENT_CHOICES: Record<string, string> = {
  breakdown: "repair",
  flare: "hide",
  illness: "treat",
};

function advanceWithoutBuilding(seed = 1): GameState {
  let state = initialState(seed);

  for (let step = 0; step < MISSION_DAYS * 3 && state.status === "playing"; step += 1) {
    if (state.activeEvent) {
      state = reduce(state, {
        type: "resolveEvent",
        choice: EVENT_CHOICES[state.activeEvent],
      });
      continue;
    }

    state = reduce(state, { type: "nextDay" });
  }

  return state;
}

describe("Задания от экипажа", () => {
  it("В начале экипаж даёт 2 задания", () => {
    const state = initialState();

    expect(state.tasks).toHaveLength(2);
    expect(state.tasks.every((task) => task.status === "open")).toBe(true);
  });

  it("Задание просит член экипажа с подходящей ролью", () => {
    const state = initialState();

    for (const task of state.tasks) {
      const giver = state.crew.find((crewMember) => crewMember.id === task.giver);
      const definition = TASK_DEFS.find((taskDefinition) => taskDefinition.id === task.id);

      expect(giver?.role).toBe(definition?.role);
    }
  });

  it("Новых заданий в день не больше 2 до 10-го дня и не больше 1 после", () => {
    const state = advanceWithoutBuilding();
    const issuedPerDay = new Map<number, number>();

    for (const task of state.tasks) {
      issuedPerDay.set(task.issuedDay, (issuedPerDay.get(task.issuedDay) ?? 0) + 1);
    }

    for (const [day, count] of issuedPerDay) {
      expect(count).toBeLessThanOrEqual(tasksPerDay(day));
    }
  });

  it(`Открытых заданий одновременно не больше ${MAX_OPEN}`, () => {
    let state = initialState();
    let maximumOpenTasks = 0;

    for (let day = 0; day < MISSION_DAYS && state.status === "playing"; day += 1) {
      if (state.activeEvent) {
        state = reduce(state, {
          type: "resolveEvent",
          choice: EVENT_CHOICES[state.activeEvent],
        });
      }

      state = reduce(state, { type: "nextDay" });
      maximumOpenTasks = Math.max(
        maximumOpenTasks,
        state.tasks.filter((task) => task.status === "open").length,
      );
    }

    expect(maximumOpenTasks).toBeLessThanOrEqual(MAX_OPEN);
  });

  it("Срок задания про убежище = день вспышки", () => {
    const state = advanceWithoutBuilding();
    const shelterTask = state.tasks.find((task) => task.id === "shelter");

    expect(shelterTask?.deadline).toBe(dayOfEvent("flare"));
  });

  it("Без построек задания просрочены, а настроение экипажа падает", () => {
    const state = advanceWithoutBuilding();

    expect(state.tasks.some((task) => task.status === "missed")).toBe(true);
    expect(state.crew.every((crewMember) => crewMember.morale < MORALE_START)).toBe(true);
  });

  it("Построили теплицу: задание выполнено, настроение растёт", () => {
    const state = initialState();
    const reviewed = reviewTasks({
      ...state,
      modules: [
        ...state.modules,
        { slot: slotOf(0, 0), type: "greenhouse", broken: false },
      ],
    });

    expect(reviewed.tasks.find((task) => task.id === "greenhouse")?.status).toBe("done");
    expect(
      reviewed.crew.every(
        (crewMember) => crewMember.morale === MORALE_START + MORALE_STEP,
      ),
    ).toBe(true);
  });

  it("Модуль в стройке задание ещё не закрывает", () => {
    const state = initialState();
    const reviewed = reviewTasks({
      ...state,
      modules: [
        ...state.modules,
        {
          slot: slotOf(0, 0),
          type: "greenhouse",
          broken: false,
          build: { leftMs: 1, totalMs: 1, crewId: 1 },
        },
      ],
    });

    expect(reviewed.tasks.find((task) => task.id === "greenhouse")?.status).toBe("open");
  });
});
