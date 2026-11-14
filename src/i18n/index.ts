import { ru } from "./ru";
import { uk } from "./uk";
import { en } from "./en";

export type Lang = "uk" | "en" | "ru";
export const LANGS: Lang[] = ["uk", "en", "ru"];

const DICTS: Record<Lang, Record<string, string>> = { ru, uk, en };

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

export function t(key: string, params?: Record<string, string | number>): string {
  const text = DICTS[current][key] ?? DICTS.en[key] ?? key;
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (_, name: string) => String(params[name] ?? `{${name}}`));
}

// «1 день», «2 дня», «5 дней»
export function days(n: number): string {
  const forms = t("plural.day").split("|");
  let form = forms[forms.length - 1];
  if (current === "en") {
    form = n === 1 ? forms[0] : forms[1];
  } else {
    const mod10 = n % 10;
    const mod100 = n % 100;
    if (mod10 === 1 && mod100 !== 11) form = forms[0];
    else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) form = forms[1];
  }
  return `${n} ${form}`;
}

export function daysShort(n: number): string {
  return `${n} ${t("unit.dShort")}`;
}

export const moduleName = (type: string) => t(`module.${type}.name`);
export const moduleDesc = (type: string) => t(`module.${type}.desc`);
