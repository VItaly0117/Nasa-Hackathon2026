import type { Flare, ModuleType, Msg } from "@/types";
import { days as daysText, getLang, moduleName, t, tDynamic } from "./index";

// Перевод сообщений ядра игры (журнал, причины отложенных эффектов). Ядро отдаёт ключ и параметры-id,
// здесь они превращаются в слова на языке игрока. Так состояние игры не зависит от языка.

type ParamKind = "resource" | "module" | "crew" | "crewFrom" | "task" | "days" | "key" | "date";

// Что означает каждый параметр сообщения. Ключи сообщений и имена параметров совпадают с текстами в словарях
const KINDS: Record<string, Record<string, ParamKind>> = {
  "log.vitalOut": { what: "resource" },
  "log.vitalHealth": { what: "resource" },
  "log.built": { name: "module" },
  "log.buildStarted": { who: "crew", name: "module" },
  "log.illness": { name: "crew" },
  "log.treated": { name: "crew" },
  "log.ignored": { name: "crew", days: "days" },
  "log.recovered": { name: "crew" },
  "log.taskDone": { who: "crewFrom", task: "task" },
  "log.taskMissed": { who: "crewFrom", task: "task" },
  "log.flareReal": { date: "date" },
  "research.log": { result: "key" },
};

const LOCALES = { ru: "ru-RU", uk: "uk-UA", en: "en-US" } as const;

// «25 мая 2025» на текущем языке (Intl добавляет «г.» или «р.»: убираем, чтобы фраза не кончалась двумя точками)
export function formatDate(iso: string): string {
  return new Intl.DateTimeFormat(LOCALES[getLang()], { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(iso))
    .replace(/\s*[гр]\.$/, "");
}

const FORMAT: Record<ParamKind, (v: string | number) => string> = {
  resource: (v) => tDynamic(`vital.${v}`),
  module: (v) => moduleName(String(v) as ModuleType),
  crew: (v) => tDynamic(`crew.n${v}`),
  crewFrom: (v) => tDynamic(`crew.from${v}`), // «задание от Максима»
  task: (v) => tDynamic(`task.${v}`),
  days: (v) => daysText(Number(v)),
  key: (v) => tDynamic(String(v)),
  date: (v) => formatDate(String(v)),
};

export function formatMsg(message: Msg): string {
  const kinds = KINDS[message.key] ?? {};
  const params: Record<string, string | number> = {};
  for (const [name, value] of Object.entries(message.params ?? {})) {
    const kind = kinds[name];
    params[name] = kind ? FORMAT[kind](value) : value;
  }
  return tDynamic(message.key, params);
}

// «класс X1.1, 25 мая 2025»
export function describeFlare(flare: Flare): string {
  return t("flare.desc", { cls: flare.class, date: formatDate(flare.date) });
}
