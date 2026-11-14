import { MISSION_DAYS } from "../engine/constants";
import { analyzeMission } from "../engine/debrief";
import type { ReportLine } from "../engine/debrief";
import { days as daysText, t } from "../i18n";
import { describeFlare } from "../i18n/messages";
import type { GameState } from "../types";

// Итоги миссии словами: анализ из ядра (engine/debrief.ts) плюс тексты из словарей на языке игрока

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

export function buildReport(state: GameState): DebriefReport {
  const analysis = analyzeMission(state);

  // {days} подставляется уже со словом: «19 дней», «19 днів», «19 days»
  const params = {
    days: daysText(analysis.days),
    total: MISSION_DAYS,
    health: analysis.health,
    flare: state.flare ? describeFlare(state.flare) : "NASA DONKI",
  };

  const line = (l: ReportLine): DebriefLine => {
    const out: DebriefLine = { id: l.id, text: t(`debrief.rule.${l.id}`, params) };
    if (l.hintId) out.hintId = l.hintId;
    if (l.flareSource && state.flare) out.source = { label: state.flare.source, url: state.flare.link };
    return out;
  };

  return {
    won: analysis.won,
    title: t(`debrief.verdict.${analysis.verdictId}.title`, params),
    summary: t(`debrief.verdict.${analysis.verdictId}.summary`, params),
    rating: t(`debrief.verdict.${analysis.verdictId}.rating`),
    days: analysis.days,
    health: analysis.health,
    helped: analysis.helped.map(line),
    hurt: analysis.hurt.map(line),
    facts: analysis.facts.map(line),
  };
}

// Короткая версия одним списком: сначала что помешало, потом что помогло, потом факты NASA
export function buildDebrief(state: GameState): string[] {
  const report = buildReport(state);
  return [...report.hurt, ...report.helped, ...report.facts].map((l) => l.text);
}
