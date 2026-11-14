import debriefData from "../data/debrief.json";
import hintsData from "../data/hints.json";
import healthData from "../data/health.json";
import type { GameState, HistoryEntry, ModuleType, ResourceKey } from "../types";
import { NIGHT_START } from "./constants";

// Итоговый разбор (чистая часть: без текстов и без языка). Работает в два шага:
//   1) collectFacts: из истории миссии получаем простые факты «да/нет» (что реально случилось);
//   2) правила из data/debrief.json: если все факты из when верны, показываем текст.
// Тексты лежат в словарях i18n (debrief.rule.<id>, debrief.verdict.<id>.*), а собирает их слой интерфейса: ui/report.ts.
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
export type Condition = FactName | `!${FactName}`;
export type Verdict = { id: string; when: Condition[] };
export type Rule = {
  id: string;
  kind: "helped" | "hurt" | "fact";
  when: Condition[];
  hint?: string;      // id из hints.json: подсказка «как это у NASA»
  source?: "flare";   // приложить ссылку на вспышку в DONKI
};

export const DEBRIEF_DATA = debriefData as { verdicts: Verdict[]; rules: Rule[] };
export const HINT_IDS = (hintsData as { id: string }[]).map((h) => h.id);
export const MISSION_FACTS = healthData as { id: string; source?: string }[];
const DATA = DEBRIEF_DATA;
const FACTS = MISSION_FACTS;

// Факт NASA о здоровье астронавтов для итогового экрана. Выбирается по seed: чистая функция,
// в одной и той же игре (и у всех игроков совместной игры) факт один и тот же
export function missionFact(state: GameState): { id: string; source?: string } {
  return FACTS[(state.seed >>> 0) % FACTS.length];
}

export type ReportLine = {
  id: string;
  hintId?: string;       // id подсказки NASA из hints.json
  flareSource?: boolean; // приложить ссылку на вспышку в DONKI
};

// Что показать в итогах, без слов: вердикт и пункты по id. Слова подставляет ui/report.ts
export type MissionAnalysis = {
  won: boolean;
  verdictId: string;
  days: number;
  health: number;
  helped: ReportLine[];
  hurt: ReportLine[];
  facts: ReportLine[];
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

export function analyzeMission(state: GameState): MissionAnalysis {
  const facts = collectFacts(state);
  const verdict = DATA.verdicts.find((v) => matches(facts, v.when)) ?? DATA.verdicts[DATA.verdicts.length - 1];
  const analysis: MissionAnalysis = {
    won: facts.won,
    verdictId: verdict.id,
    days: state.day,
    health: Math.round(state.resources.health),
    helped: [],
    hurt: [],
    facts: [],
  };
  for (const rule of DATA.rules) {
    if (!matches(facts, rule.when)) continue;
    const line: ReportLine = { id: rule.id };
    if (rule.hint) line.hintId = rule.hint;
    if (rule.source === "flare" && state.flare) line.flareSource = true;
    (rule.kind === "helped" ? analysis.helped : rule.kind === "hurt" ? analysis.hurt : analysis.facts).push(line);
  }
  return analysis;
}
