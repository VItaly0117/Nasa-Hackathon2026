import { DEBRIEF_DATA, FACT_NAMES, HINT_IDS, MISSION_FACTS } from "../../src/engine/debrief";
import { ru } from "../../src/i18n/ru";

// Проверка debrief.json: опечатка в имени факта или id подсказки не должна пройти молча (это про данные и словари, поэтому живёт в проверках, а не в ядре)
export function validateDebriefData(): string[] {
  const problems: string[] = [];
  const DATA = DEBRIEF_DATA;
  const FACTS = MISSION_FACTS;
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
  // Тексты подсказок и фактов лежат в словарях: hint.<id> и fact.<id>
  for (const id of HINT_IDS) if (!(`hint.${id}` in ru)) problems.push(`нет текста "hint.${id}" в словарях i18n`);
  for (const f of FACTS) if (!(`fact.${f.id}` in ru)) problems.push(`нет текста "fact.${f.id}" в словарях i18n`);
  const ids = [...DATA.verdicts, ...DATA.rules].map((x) => x.id);
  for (const id of new Set(ids)) if (ids.filter((x) => x === id).length > 1) problems.push(`повтор id "${id}"`);
  return problems;
}
