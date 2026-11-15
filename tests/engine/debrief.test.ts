import { describe, expect, it } from "vitest";
import { t } from "../../src/i18n";
import { ru } from "../../src/i18n/ru";
import type { GameState } from "../../src/types";
import { buildReport, initialState, missionFact } from "../helpers/engine";
import { CARELESS, IDLE, NO_BATTERY, NO_SHELTER, playMission, PREPARED } from "../helpers/scenarios";

const REPORT_SEEDS = [1, 2, 3, 4, 5, 6, 7, 8];

function reportLineIds(state: GameState): string[] {
  const report = buildReport(state);
  return [...report.hurt, ...report.helped, ...report.facts].map((line) => line.id);
}

function expectReportLines(state: GameState, expected: string[], forbidden: string[] = []): void {
  const ids = reportLineIds(state);
  for (const id of expected) expect(ids).toContain(id);
  for (const id of forbidden) expect(ids).not.toContain(id);
}

describe("debrief", () => {
  const idle = playMission(IDLE);
  const careless = playMission(CARELESS);
  const prepared = playMission(PREPARED);
  const noShelter = playMission(NO_SHELTER);
  const noBattery = playMission(NO_BATTERY);

  it("Разбор: подготовленная база", () => {
    expectReportLines(
      prepared,
      ["flare-shelter", "breakdown-repaired", "night-survived", "greenhouse-fed", "real-flare"],
      ["flare-worked", "no-builds", "water-out", "food-no-greenhouse", "oxygen-out", "night-no-battery"],
    );
  });

  it("Разбор: без убежища", () => {
    expectReportLines(noShelter, ["flare-no-shelter"], ["flare-shelter"]);
  });

  it("Разбор: без батарей", () => {
    expectReportLines(noBattery, ["night-no-battery"], ["night-survived"]);
  });

  it("Разбор: без построек", () => {
    expectReportLines(idle, ["no-builds"], ["night-survived", "greenhouse-fed"]);
  });

  it("Разбор: риск", () => {
    expectReportLines(careless, ["breakdown-ignored", "no-builds"], ["breakdown-repaired"]);
  });

  for (const [name, state] of [
    ["idle", idle],
    ["careless", careless],
    ["prepared", prepared],
    ["noShelter", noShelter],
    ["noBattery", noBattery],
  ] as const) {
    it(`Разбор (${name}): тексты без незаполненных {скобок}`, () => {
      const report = buildReport(state);
      const text = [
        report.title,
        report.summary,
        ...report.hurt.map((line) => line.text),
        ...report.helped.map((line) => line.text),
        ...report.facts.map((line) => line.text),
      ];

      expect(text).not.toContainEqual(expect.stringMatching(/[{}]/));
    });
  }

  it("Факт NASA в итогах выбирается по seed: один seed даёт один факт, и текст у него есть", () => {
    const facts = REPORT_SEEDS.map((seed) => missionFact(initialState(seed)));

    for (const seed of REPORT_SEEDS) {
      expect(missionFact(initialState(seed))).toEqual(missionFact(initialState(seed)));
    }
    expect(facts).toEqual(
      REPORT_SEEDS.map((seed) => missionFact(initialState(seed))),
    );
    expect(facts.every((fact) => `fact.${fact.id}` in ru)).toBe(true);
  });

  it("«На отлично» только если экипаж не остался без ответа на большинство просьб", () => {
    const flawless = {
      ...prepared,
      tasks: prepared.tasks.map((task) => ({ ...task, status: "done" as const })),
    };
    const ignoredAsks = {
      ...prepared,
      tasks: prepared.tasks.map((task) => ({ ...task, status: "missed" as const })),
    };
    const perfectRating = t("debrief.verdict.perfect.rating");

    expect(buildReport(flawless).rating).toBe(perfectRating);
    expect(buildReport(ignoredAsks).rating).not.toBe(perfectRating);
  });

  it("Разбор стабилен для нескольких seed", () => {
    for (const seed of REPORT_SEEDS) {
      expect(buildReport(initialState(seed))).toEqual(buildReport(initialState(seed)));
    }
  });
});
