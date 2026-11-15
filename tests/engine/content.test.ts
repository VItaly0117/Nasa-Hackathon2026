import { describe, expect, it } from "vitest";
import debriefData from "../../src/content/debrief.json";
import eventsData from "../../src/content/events.json";
import healthData from "../../src/content/health.json";
import hintsData from "../../src/content/hints.json";
import sourcesData from "../../src/content/sources.json";
import { en } from "../../src/i18n/en";
import { ru } from "../../src/i18n/ru";
import { uk } from "../../src/i18n/uk";
import { TASK_DEFS } from "../helpers/engine";

const FACT_NAMES = [
  "won",
  "lost",
  "reachedNight",
  "healthHigh",
  "healthLow",
  "noBuilds",
  "builtGreenhouse",
  "builtBattery",
  "builtShelter",
  "batteryBeforeNight",
  "flareHappened",
  "flareHidInShelter",
  "flareHidNoShelter",
  "flareWorked",
  "breakdownRepaired",
  "breakdownRepairedLate",
  "breakdownIgnored",
  "ranOutOxygen",
  "ranOutWater",
  "ranOutFood",
  "anyShortage",
  "blackoutAtNight",
  "blackoutByDay",
  "illnessHappened",
  "illnessTreated",
  "illnessIgnored",
  "medbayBuilt",
  "tasksMostlyDone",
  "tasksMostlyMissed",
] as const;

const dictionaries = { ru, uk, en } as const;
const knownFacts = new Set<string>(FACT_NAMES);

type Dictionary = Record<string, string>;

type DebriefRule = {
  id: string;
  kind?: "helped" | "hurt" | "fact";
  when: string[];
  hint?: string;
};

type DebriefData = {
  verdicts: DebriefRule[];
  rules: DebriefRule[];
};

type EventChoice = {
  id: string;
  cost: Record<string, number>;
  costWithout?: { cost: Record<string, number> };
  rest?: { days: number; daysWith: number };
};

type EventDefinition = {
  id: string;
  choices: EventChoice[];
};

type IdentifiedItem = {
  id: string;
};

function missingTranslationKeys(keys: string[]): string[] {
  const missing: string[] = [];

  for (const [language, dictionary] of Object.entries(dictionaries)) {
    for (const key of keys) {
      if (!(key in (dictionary as Dictionary))) {
        missing.push(`${language}: ${key}`);
      }
    }
  }

  return missing;
}

function numericChoiceValues(choice: EventChoice): number[] {
  const values = new Set<number>();
  const costs = [choice.cost, choice.costWithout?.cost ?? {}];

  for (const cost of costs) {
    for (const value of Object.values(cost)) {
      if (value !== 0) {
        values.add(value);
      }
    }
  }

  if (choice.rest) {
    values.add(choice.rest.days);
    values.add(choice.rest.daysWith);
  }

  return [...values];
}

function containsWholeNumber(text: string, value: number): boolean {
  return new RegExp(`(^|\\D)${value}(\\D|$)`).test(text);
}

function selectedFactId(seed: number, facts: IdentifiedItem[]): string {
  return facts[(seed >>> 0) % facts.length].id;
}

describe("content validation", () => {
  it("debrief.json без опечаток", () => {
    const data = debriefData as DebriefData;
    const hintIds = new Set((hintsData as IdentifiedItem[]).map(({ id }) => id));
    const rulesAndVerdicts = [...data.verdicts, ...data.rules];
    const problems: string[] = [];

    for (const item of rulesAndVerdicts) {
      for (const condition of item.when) {
        const factName = condition.replace(/^!/, "");

        if (!knownFacts.has(factName)) {
          problems.push(`${item.id}: неизвестный факт "${condition}"`);
        }
      }
    }

    for (const rule of data.rules) {
      if (rule.hint && !hintIds.has(rule.hint)) {
        problems.push(`${rule.id}: нет подсказки "${rule.hint}" в hints.json`);
      }
    }

    const debriefKeys = [
      ...data.rules.map(({ id }) => `debrief.rule.${id}`),
      ...data.verdicts.flatMap(({ id }) =>
        ["title", "summary", "rating"].map(
          (field) => `debrief.verdict.${id}.${field}`,
        ),
      ),
      ...(hintsData as IdentifiedItem[]).map(({ id }) => `hint.${id}`),
      ...(healthData as IdentifiedItem[]).map(({ id }) => `fact.${id}`),
    ];
    problems.push(...missingTranslationKeys(debriefKeys));

    const ids = rulesAndVerdicts.map(({ id }) => id);
    const duplicateIds = [...new Set(ids)].filter(
      (id) => ids.filter((candidate) => candidate === id).length > 1,
    );
    problems.push(...duplicateIds.map((id) => `повтор id "${id}"`));

    expect(problems).toEqual([]);
  });

  it("Подсказки в окнах событий совпадают с ценами в events.json", () => {
    const drift: string[] = [];

    for (const event of eventsData as EventDefinition[]) {
      for (const choice of event.choices) {
        const values = numericChoiceValues(choice);

        for (const [language, dictionary] of Object.entries(dictionaries)) {
          const key = `ev.${event.id}.${choice.id}.hint`;
          const hint = (dictionary as Dictionary)[key] ?? "";

          for (const value of values) {
            if (!containsWholeNumber(hint, value)) {
              drift.push(`${language} ${event.id}.${choice.id}: нет числа ${value}`);
            }
          }
        }
      }
    }

    expect(drift).toEqual([]);
  });

  it("У каждого источника на экране «Данные NASA» есть название и описание", () => {
    const sourceKeys = (sourcesData as IdentifiedItem[]).flatMap(({ id }) => [
      `source.${id}.name`,
      `source.${id}.usedFor`,
    ]);

    expect(missingTranslationKeys(sourceKeys)).toEqual([]);
  });

  it("Для каждого факта NASA есть русский текст", () => {
    const facts = healthData as IdentifiedItem[];
    const seeds = [1, 2, 3, 4, 5, 6, 7, 8];
    const factIds = seeds.map((seed) => selectedFactId(seed, facts));
    const missingFactTexts = missingTranslationKeys(
      factIds.map((id) => `fact.${id}`),
    );

    expect(selectedFactId(3, facts)).toBe(selectedFactId(3, facts));
    expect(missingFactTexts).toEqual([]);
  });

  it("У каждого задания есть текст и объяснение", () => {
    const taskKeys = TASK_DEFS.flatMap(({ id }: { id: string }) => [
      `task.${id}`,
      `task.${id}.why`,
    ]);

    expect(missingTranslationKeys(taskKeys)).toEqual([]);
  });
});
