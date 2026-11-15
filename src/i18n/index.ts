import { ru } from "./ru";
import { uk } from "./uk";
import { en } from "./en";
import type { ModuleType } from "@/types";

export type Lang = "uk" | "en" | "ru";
export const LANGS: Lang[] = ["uk", "en", "ru"];

// Ключ сообщения: любой ключ базового словаря. Опечатка в ключе не компилируется
export type MessageKey = keyof typeof ru;

const DICTS: Record<Lang, Record<MessageKey, string>> = { ru, uk, en };

// Язык выбирается один раз перед игрой, поэтому достаточно модульной переменной:
// App перерисовывает всё дерево при смене языка
let current: Lang = "uk";

export function setLang(lang: Lang) {
  current = lang;
  try {
    document.documentElement.lang = lang;
    document.title = DICTS[lang]["app.title"];
  } catch {
    // вне браузера (тесты) lang выставлять некуда
  }
}

export function getLang(): Lang {
  return current;
}

export function langName(lang: Lang): string {
  return DICTS[lang]["lang.name"];
}

export function t(key: MessageKey, params?: Record<string, string | number>): string {
  const text = DICTS[current][key] ?? DICTS.en[key] ?? key;
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`));
}

// Ключ, который собирается из id в данных (`task.${id}`, `ev.${id}.title`): компилятор такие ключи проверить не может.
// Наличие переводов для id из данных (события, источники, подсказки, факты, разбор) проверяют тесты (tests/engine/content.test.ts и extras.test.ts). Для обычных ключей используйте t()
export function tDynamic(key: string, params?: Record<string, string | number>): string {
  return t(key as MessageKey, params);
}

// Форма слова по правилам языка из Intl (в словаре формы через «|»: один|несколько|много, у английского один|много)
const PLURAL_LOCALE: Record<Lang, string> = { ru: "ru", uk: "uk", en: "en" };
const FORM_INDEX: Record<string, number> = { one: 0, few: 1, many: 2, other: 2 };

// «1 день», «2 дня», «5 дней»
export function days(n: number): string {
  const forms = t("plural.day").split("|");
  const category = new Intl.PluralRules(PLURAL_LOCALE[current]).select(n);
  // у английского только «один» и «другое»: берём вторую форму
  const index = current === "en" ? (category === "one" ? 0 : 1) : (FORM_INDEX[category] ?? 2);
  return `${n} ${forms[Math.min(index, forms.length - 1)]}`;
}

export function daysShort(n: number): string {
  return `${n} ${t("unit.dShort")}`;
}

export const moduleName = (type: ModuleType) => t(`module.${type}.name`);
export const moduleDesc = (type: ModuleType) => t(`module.${type}.desc`);
