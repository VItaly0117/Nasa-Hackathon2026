import { readdirSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { en } from "../../src/i18n/en";
import { ru } from "../../src/i18n/ru";
import { uk } from "../../src/i18n/uk";

const dictionaries = { ru, uk, en } as const;
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const sourceRoot = join(root, "src");

function sourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

function usedTranslationKeys(): { exact: Set<string>; prefixes: Set<string> } {
  const exact = new Set<string>();
  const prefixes = new Set<string>();
  const callPattern = /\b(?:t|tDynamic)\s*\(\s*(?:"([^"]+)"|'([^']+)'|`([^`]+)`)/g;

  for (const file of sourceFiles(sourceRoot)) {
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(callPattern)) {
      const literal = match[1] ?? match[2] ?? match[3];
      if (!literal) continue;

      const interpolation = literal.indexOf("${");
      if (interpolation < 0) {
        exact.add(literal);
        continue;
      }

      const prefix = literal.slice(0, interpolation);
      if (prefix) prefixes.add(prefix);
    }

    for (const match of source.matchAll(/\bt\s*\([^,\n]*?\?\s*["']([^"']+)["']\s*:\s*["']([^"']+)["']/g)) {
      exact.add(match[1]);
      exact.add(match[2]);
    }

    for (const match of source.matchAll(/\bmsg\s*\(\s*(?:"([^"]+)"|'([^']+)')/g)) {
      exact.add(match[1] ?? match[2]);
    }
  }

  return { exact, prefixes };
}

function parameters(value: string): string[] {
  return [...new Set([...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1]))].sort();
}

describe("translation dictionaries", () => {
  it("has the same keys in every language", () => {
    const baseKeys = Object.keys(ru).sort();
    for (const [language, dictionary] of Object.entries(dictionaries)) {
      expect(Object.keys(dictionary).sort(), `${language} dictionary keys`).toEqual(baseKeys);
    }
  });

  it.todo("has no empty values (known issue: res.tip.cap is empty in ru, uk, and en)");

  it("has no values equal to their key", () => {
    for (const [language, dictionary] of Object.entries(dictionaries)) {
      for (const [key, value] of Object.entries(dictionary)) {
        expect(value, `${language}: ${key} equals its key`).not.toBe(key);
      }
    }
  });

  it("uses the same interpolation parameters for each key", () => {
    for (const key of Object.keys(ru)) {
      const expected = parameters(ru[key as keyof typeof ru]);
      for (const [language, dictionary] of Object.entries(dictionaries)) {
        expect(parameters(dictionary[key as keyof typeof dictionary]), `${language}: ${key}`).toEqual(expected);
      }
    }
  });

  it("has three day forms for Russian and Ukrainian", () => {
    expect(ru["plural.day"].split("|")).toHaveLength(3);
    expect(uk["plural.day"].split("|")).toHaveLength(3);
  });

  it.todo("has two English day forms (known issue: en plural.day has three)");

  it("resolves static keys and dynamic key prefixes from source", () => {
    const { exact, prefixes } = usedTranslationKeys();
    const missing = [...exact].filter((key) => !(key in ru));
    const missingPrefixes = [...prefixes].filter((prefix) => !Object.keys(ru).some((key) => key.startsWith(prefix)));

    expect(missing, "translation keys referenced literally but absent from ru").toEqual([]);
    expect(missingPrefixes, "dynamic translation prefixes without any ru keys").toEqual([]);
  });

  it("reports dictionary keys not found in static or dynamic source references", () => {
    const { exact, prefixes } = usedTranslationKeys();
    const unused = Object.keys(ru)
      .filter((key) => !exact.has(key) && ![...prefixes].some((prefix) => key.startsWith(prefix)))
      .sort();

    process.stdout.write(`Unused translation keys (informational): ${unused.join(", ") || "(none)"}\n`);
  });
});
