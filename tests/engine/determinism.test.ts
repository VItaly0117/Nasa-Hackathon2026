import { describe, expect, it } from "vitest";
import { PREPARED, playMission } from "../helpers/scenarios";

const LEGACY_SEED = 7;
const REPEATABILITY_SEEDS = [1, 42, 101, 1_337] as const;

function serializeMission(seed: number): string {
  return JSON.stringify(playMission(PREPARED, seed));
}

describe("engine determinism", () => {
  it("one seed produces the same game", () => {
    expect(serializeMission(LEGACY_SEED)).toBe(serializeMission(LEGACY_SEED));
  });

  it.each(REPEATABILITY_SEEDS)(
    "replays fixed seed %i identically",
    (seed) => {
      expect(serializeMission(seed)).toBe(serializeMission(seed));
    },
  );
});
