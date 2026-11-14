import debriefData from "../data/debrief.json";
import hintsData from "../data/hints.json";
import { days as daysText, t } from "../i18n";
import { ru } from "../i18n/ru";
import type { GameState, HistoryEntry, ModuleType, ResourceKey } from "../types";
import { MISSION_DAYS, NIGHT_START } from "./engine";
import { describeFlare } from "./events";

// Итоговый разбор. Работает в два шага:
//   1) collectFacts: из истории миссии получаем простые факты «да/нет» (что реально случилось);
//   2) правила из data/debrief.json: если все факты из when верны, показываем текст.
// Сами тексты лежат в словарях i18n: debrief.rule.<id> и debrief.verdict.<id>.title / .summary / .rating
// Чтобы добавить новый текст: правило в debrief.json + строка в ru.ts, uk.ts, en.ts. Код менять не нужно,
// пока хватает фактов из списка FACT_NAMES.

export const FACT_NAMES = [
  "won", "lost",
  "reachedNight",                  // миссия дошла до лунной ночи
  "healthHigh", "healthLow",       // здоровье в конце: 80+ / 30 и меньше
  "noBuilds",                      // игрок ничего не построил
  "builtGreenhouse", "builtBattery", "builtShelter",
  "batteryBeforeNight",            // батарея стояла до заката
  "flareHappened", "flareHidInShelter", "flareHidNoShelter", "flareWorked",
  "breakdownRepaired", "breakdownRepairedLate", "breakdownIgnored", // починили сразу / отложили и починили позже / так и не починили
  "ranOutOxygen", "ranOutWater", "ranOutFood", "anyShortage",
  "blackoutAtNight", "blackoutByDay",
  "illnessHappened", "illnessTreated", "illnessIgnored", "medbayBuilt", // болезнь во время стройки и медпункт
  "tasksMostlyDone", "tasksMostlyMissed", // задания экипажа: выполнено больше, чем просрочено, и наоборот
] as const;

export type FactName = (typeof FACT_NAMES)[number];
export type Facts = Record<FactName, boolean>;

// Условие правила: имя факта или "!имя" (факт должен быть ложным)
type Condition = FactName | `!${FactName}`;
type Verdict = { id: string; when: Condition[] };
type Rule = {
  id: string;
  kind: "helped" | "hurt" | "fact";
  when: Condition[];
  hint?: string;      // id из hints.json: подсказка «как это у NASA»
  source?: "flare";   // приложить ссылку на вспышку в DONKI
};

const DATA = debriefData as { verdicts: Verdict[]; rules: Rule[] };
const HINT_IDS = (hintsData as { id: string }[]).map((h) => h.id);

export type DebriefLine = {
  id: string;
  text: string;
  hintId?: string;                            // id подсказки NASA из hints.json
  source?: { label: string; url: string };    // подпись источника
};

export type DebriefReport = {
  won: boolean;
  title: string;
  summary: string;
  rating: string;
  days: number;
  health: number;
  helped: DebriefLine[];  // что помогло
  hurt: DebriefLine[];    // что помешало
  facts: DebriefLine[];   // настоящие данные NASA в этой миссии
};

export function collectFacts(state: GameState): Facts {
  const h = state.history;
  const of = <K extends HistoryEntry["kind"]>(kind: K) =>
    h.filter((e): e is Extract<HistoryEntry, { kind: K }> => e.kind === kind);

  const built = of("built");
  const choices = of("choice");
  const shortages = of("shortage");
  const blackouts = of("blackout");

  const builtType = (type: ModuleType, beforeDay = Infinity) => built.some((b) => b.module === type && b.day < beforeDay);
  const chose = (event: string, choice: string) => choices.find((c) => c.event === event && c.choice === choice);
  const ranOut = (resource: ResourceKey) => shortages.some((s) => s.resource === resource);
  const hid = chose("flare", "hide");
  const tasksDone = state.tasks.filter((x) => x.status === "done").length;
  const tasksMissed = state.tasks.filter((x) => x.status === "missed").length;

  return {
    won: state.status === "won",
    lost: state.status === "lost",
    reachedNight: state.day >= NIGHT_START,
    healthHigh: state.resources.health >= 80,
    healthLow: state.resources.health <= 30,
    noBuilds: built.length === 0,
    builtGreenhouse: builtType("greenhouse"),
    builtBattery: builtType("battery"),
    builtShelter: builtType("shelter"),
    batteryBeforeNight: builtType("battery", NIGHT_START),
    flareHappened: choices.some((c) => c.event === "flare"),
    flareHidInShelter: !!hid && !hid.unprotected,
    flareHidNoShelter: !!hid && hid.unprotected,
    flareWorked: !!chose("flare", "work"),
    breakdownRepaired: !!chose("breakdown", "repair"),
    breakdownRepairedLate: !!chose("breakdown", "repairLater") && !chose("breakdown", "repair"),
    breakdownIgnored: !!chose("breakdown", "ignore") && !chose("breakdown", "repairLater"),
    ranOutOxygen: ranOut("oxygen"),
    ranOutWater: ranOut("water"),
    ranOutFood: ranOut("food"),
    anyShortage: shortages.length > 0,
    blackoutAtNight: blackouts.some((b) => b.night),
    blackoutByDay: blackouts.some((b) => !b.night),
    illnessHappened: choices.some((c) => c.event === "illness"),
    illnessTreated: !!chose("illness", "treat"),
    illnessIgnored: !!chose("illness", "ignore"),
    medbayBuilt: builtType("medbay"),
    tasksMostlyDone: tasksDone >= 3 && tasksDone > tasksMissed,
    tasksMostlyMissed: tasksMissed >= 3 && tasksMissed >= tasksDone,
  };
}

function matches(facts: Facts, when: Condition[]): boolean {
  return when.every((c) => (c.startsWith("!") ? !facts[c.slice(1) as FactName] : facts[c as FactName]));
}

export function buildReport(state: GameState): DebriefReport {
  const facts = collectFacts(state);
  const days = state.day;
  const health = Math.round(state.resources.health);

  // {days} подставляется уже со словом: «19 дней», «19 днів», «19 days»
  const params = {
    days: daysText(days),
    total: MISSION_DAYS,
    health,
    flare: state.flare ? describeFlare(state.flare) : "NASA DONKI",
  };

  const verdict = DATA.verdicts.find((v) => matches(facts, v.when)) ?? DATA.verdicts[DATA.verdicts.length - 1];

  const report: DebriefReport = {
    won: facts.won,
    title: t(`debrief.verdict.${verdict.id}.title`, params),
    summary: t(`debrief.verdict.${verdict.id}.summary`, params),
    rating: t(`debrief.verdict.${verdict.id}.rating`),
    days,
    health,
    helped: [],
    hurt: [],
    facts: [],
  };

  for (const rule of DATA.rules) {
    if (!matches(facts, rule.when)) continue;
    const line: DebriefLine = { id: rule.id, text: t(`debrief.rule.${rule.id}`, params) };
    if (rule.hint) line.hintId = rule.hint;
    if (rule.source === "flare" && state.flare) line.source = { label: state.flare.source, url: state.flare.link };
    (rule.kind === "helped" ? report.helped : rule.kind === "hurt" ? report.hurt : report.facts).push(line);
  }

  return report;
}

// Короткая версия одним списком: сначала что помешало, потом что помогло, потом факты NASA
export function buildDebrief(state: GameState): string[] {
  const report = buildReport(state);
  return [...report.hurt, ...report.helped, ...report.facts].map((line) => line.text);
}

// Проверка debrief.json для checks.ts: опечатка в имени факта или id подсказки не должна пройти молча
export function validateDebriefData(): string[] {
  const problems: string[] = [];
  const known = new Set<string>(FACT_NAMES);
  for (const item of [...DATA.verdicts, ...DATA.rules]) {
    for (const c of item.when) {
      if (!known.has(c.replace(/^!/, ""))) problems.push(`${item.id}: неизвестный факт "${c}"`);
    }
  }
  for (const rule of DATA.rules) {
    if (rule.hint && !HINT_IDS.includes(rule.hint)) problems.push(`${rule.id}: нет подсказки "${rule.hint}" в hints.json`);
  }
  // У каждого правила и вердикта должен быть текст. ru.ts базовый: uk.ts и en.ts сверяет с ним TypeScript
  const keys = [
    ...DATA.rules.map((r) => `debrief.rule.${r.id}`),
    ...DATA.verdicts.flatMap((v) => ["title", "summary", "rating"].map((f) => `debrief.verdict.${v.id}.${f}`)),
  ];
  for (const key of keys) if (!(key in ru)) problems.push(`нет текста "${key}" в словарях i18n`);
  const ids = [...DATA.verdicts, ...DATA.rules].map((x) => x.id);
  for (const id of new Set(ids)) if (ids.filter((x) => x === id).length > 1) problems.push(`повтор id "${id}"`);
  return problems;
}
