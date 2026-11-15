import { describe, expect, it } from "vitest";
import type { GameState } from "../../src/types";
import { capacityOf, initialState, reduce } from "../helpers/engine";

const MOON_DUST_ID = "moonDust";
const ICE_SCOUT_ID = "iceScout";
const SHIELD_ANSWER = "shield";
const BRUSH_ANSWER = "brush";
const ICE_ANSWER = "ice";
const ROCK_ANSWER = "rock";
const NEAR_FULL_ENERGY = 95;
const CORRECT_MOON_DUST_ENERGY_REWARD = 24;
const CORRECT_MOON_DUST_MATERIALS_REWARD = 12;
const INCORRECT_MOON_DUST_ENERGY_REWARD = 8;

function researchMoonDust(state: GameState, answer: "shield" | "brush"): GameState {
  return reduce(state, { type: "research", id: MOON_DUST_ID, answer });
}

function researchIceScout(state: GameState, answer: "ice" | "rock"): GameState {
  return reduce(state, { type: "research", id: ICE_SCOUT_ID, answer });
}

describe("research", () => {
  it("Исследование: верный ответ даёт +24 энергии и +12 материалов, неверный только +8 энергии", () => {
    const base = initialState(1);
    const shield = researchMoonDust(base, SHIELD_ANSWER);
    const brush = researchMoonDust(base, BRUSH_ANSWER);

    expect(shield.resources.energy - base.resources.energy).toBe(
      CORRECT_MOON_DUST_ENERGY_REWARD,
    );
    expect(shield.resources.materials - base.resources.materials).toBe(
      CORRECT_MOON_DUST_MATERIALS_REWARD,
    );
    expect(brush.resources.energy - base.resources.energy).toBe(
      INCORRECT_MOON_DUST_ENERGY_REWARD,
    );
    expect(brush.resources.materials).toBe(base.resources.materials);
  });

  it("Исследование выполняется один раз", () => {
    const base = initialState(1);
    const completed = researchMoonDust(base, SHIELD_ANSWER);
    const repeated = researchMoonDust(completed, SHIELD_ANSWER);

    expect(repeated).toBe(completed);
    expect(completed.research.filter((id) => id === MOON_DUST_ID)).toHaveLength(1);
  });

  it("Разведка льда: верный ответ даёт воду и энергию, неверный немного материалов; оба один раз и независимо от пыли", () => {
    const base = initialState(1);
    const iceRight = researchIceScout(base, ICE_ANSWER);
    const iceWrong = researchIceScout(base, ROCK_ANSWER);
    const moonDustCompleted = researchMoonDust(base, SHIELD_ANSWER);
    const iceAfterMoonDust = researchIceScout(moonDustCompleted, ICE_ANSWER);

    expect(iceRight.resources.water).toBeGreaterThan(base.resources.water);
    expect(iceRight.resources.energy).toBeGreaterThan(base.resources.energy);
    expect(iceWrong.resources.materials).toBeGreaterThan(base.resources.materials);
    expect(iceWrong.resources.water).toBe(base.resources.water);
    expect(researchIceScout(iceRight, ICE_ANSWER)).toBe(iceRight);
    expect(iceAfterMoonDust).not.toBe(moonDustCompleted);
  });

  it("Награда за исследование не выходит за лимит хранения", () => {
    const base = initialState(1);
    const nearFull: GameState = {
      ...base,
      resources: { ...base.resources, energy: NEAR_FULL_ENERGY },
    };
    const completed = researchMoonDust(nearFull, SHIELD_ANSWER);

    expect(completed.resources.energy).toBe(capacityOf(base.modules).energy);
  });
});
