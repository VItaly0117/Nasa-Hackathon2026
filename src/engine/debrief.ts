import debriefData from "../data/debrief.json";
import hintsData from "../data/hints.json";
import type { GameState, HistoryEntry, ModuleType, ResourceKey } from "../types";
import { MISSION_DAYS, NIGHT_START } from "./engine";
import { describeFlare } from "./events";

// Итоговый разбор. Работает в два шага:
//   1) collectFacts: из истории миссии получаем простые факты «да/нет» (что реально случилось);
//   2) правила из data/debrief.json: если все факты из when верны, показываем текст.
// Чтобы добавить новый текст, достаточно дописать правило в debrief.json. Код менять не нужно,
// пока хватает фактов из списка FACT_NAMES.

export const FACT_NAMES = [
  "won", "lost",
  "reachedNight",                  // миссия дошла до лунной ночи
  "healthHigh", "healthLow",       // здоровье в конце: 80+ / 30 и меньше
  "noBuilds",                      // игрок ничего не построил
  "builtGreenhouse", "builtBattery", "builtShelter",
  "batteryBeforeNight",            // батарея стояла до заката
  "flareHappened", "flareHidInShelter", "flareHidNoShelter", "flareWorked",
  "breakdownRepaired", "breakdownIgnored",
  "ranOutOxygen", "ranOutWater", "ranOutFood", "anyShortage",
  "blackoutAtNight", "blackoutByDay",
] as const;

export type FactName = (typeof FACT_NAMES)[number];
export type Facts = Record<FactName, boolean>;

// Условие правила: имя факта или "!имя" (факт должен быть ложным)
type Condition = FactName | `!${FactName}`;
type Verdict = { id: string; when: Condition[]; title: string; summary: string; rating: string };
type Rule = {
  id: string;
  kind: "helped" | "hurt" | "fact";
  when: Condition[];
  text: string;
  hint?: string;      // id из hints.json: подсказка «как это у NASA»
  source?: "flare";   // приложить ссылку на вспышку в DONKI
};

const DATA = debriefData as { verdicts: Verdict[]; rules: Rule[] };
const HINTS = hintsData as { id: string; text: string }[];

export type DebriefLine = {
  id: string;
  text: string;
  hint?: string;                              // текст подсказки NASA
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
    breakdownIgnored: !!chose("breakdown", "ignore"),
    ranOutOxygen: ranOut("oxygen"),
    ranOutWater: ranOut("water"),
    ranOutFood: ranOut("food"),
    anyShortage: shortages.length > 0,
    blackoutAtNight: blackouts.some((b) => b.night),
    blackoutByDay: blackouts.some((b) => !b.night),
  };
}

function matches(facts: Facts, when: Condition[]): boolean {
  return when.every((c) => (c.startsWith("!") ? !facts[c.slice(1) as FactName] : facts[c as FactName]));
}

export function buildReport(state: GameState): DebriefReport {
  const facts = collectFacts(state);
  const days = state.day;
  const health = Math.round(state.resources.health);

  const fill = (text: string) =>
    text
      .replaceAll("{days}", String(days))
      .replaceAll("{total}", String(MISSION_DAYS))
      .replaceAll("{health}", String(health))
      .replaceAll("{flare}", state.flare ? describeFlare(state.flare) : "данные NASA DONKI");

  const verdict = DATA.verdicts.find((v) => matches(facts, v.when)) ?? DATA.verdicts[DATA.verdicts.length - 1];

  const report: DebriefReport = {
    won: facts.won,
    title: fill(verdict.title),
    summary: fill(verdict.summary),
    rating: verdict.rating,
    days,
    health,
    helped: [],
    hurt: [],
    facts: [],
  };

  for (const rule of DATA.rules) {
    if (!matches(facts, rule.when)) continue;
    const line: DebriefLine = { id: rule.id, text: fill(rule.text) };
    const hint = rule.hint && HINTS.find((x) => x.id === rule.hint)?.text;
    if (hint) line.hint = hint;
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
    if (rule.hint && !HINTS.some((x) => x.id === rule.hint)) problems.push(`${rule.id}: нет подсказки "${rule.hint}" в hints.json`);
  }
  const ids = [...DATA.verdicts, ...DATA.rules].map((x) => x.id);
  for (const id of new Set(ids)) if (ids.filter((x) => x === id).length > 1) problems.push(`повтор id "${id}"`);
  return problems;
}
