import { afterEach, describe, expect, it, vi } from "vitest";
import consumptionData from "../../src/content/nasa/consumption.json";
import flaresData from "../../src/content/nasa/flares.json";
import radiationData from "../../src/content/nasa/radiation.json";
import { days, getLang, setLang } from "../../src/i18n";
import type { Lang } from "../../src/i18n";
import { formatMsg } from "../../src/i18n/messages";
import { initialState, loadGame, saveGame } from "../helpers/engine";
import { CARELESS, IDLE, NO_SHELTER, PREPARED, playMission } from "../helpers/scenarios";

// Проверки, которых не было в порте Codex: язык, склонения, миграция сохранений, данные NASA.
// Раньше жили в src/engine/checks.ts.

const LANGS: Lang[] = ["ru", "uk", "en"];

class MemoryStorage {
  private readonly values = new Map<string, string>();
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("язык и тексты", () => {
  it("состояние игры целиком (с журналом) не зависит от языка: ru, en и uk дают одно и то же", () => {
    const saved = getLang();
    const stateIn = (lang: Lang) => {
      setLang(lang);
      return JSON.stringify(playMission(PREPARED, 3));
    };
    const [ru, en, uk] = [stateIn("ru"), stateIn("en"), stateIn("uk")];
    setLang(saved);
    expect(ru).toBe(en);
    expect(en).toBe(uk);
  });

  it("каждое сообщение журнала переводится на ru, uk и en без «дыр» в тексте", () => {
    const saved = getLang();
    const states = [playMission(PREPARED), playMission(IDLE), playMission(NO_SHELTER), playMission(CARELESS)];
    const entries = states.flatMap((s) => [...s.log, ...s.pending.map((p) => ({ day: 0, ...p.reason }))]);
    const broken: string[] = [];
    for (const lang of LANGS) {
      setLang(lang);
      for (const entry of entries) {
        const text = formatMsg(entry);
        if (/[{}]/.test(text) || text === entry.key) broken.push(`${lang}:${entry.key}`);
      }
    }
    setLang(saved);
    expect(broken).toEqual([]);
    expect(entries.length).toBeGreaterThan(0);
  });

  it("склонение «день/дня/дней» верно в ru, uk и en", () => {
    const saved = getLang();
    const expected: Record<Lang, string[]> = {
      ru: ["1 день", "2 дня", "5 дней", "11 дней", "21 день", "22 дня", "25 дней"],
      uk: ["1 день", "2 дні", "5 днів", "11 днів", "21 день", "22 дні", "25 днів"],
      en: ["1 day", "2 days", "5 days", "11 days", "21 days", "22 days", "25 days"],
    };
    for (const lang of LANGS) {
      setLang(lang);
      expect([1, 2, 5, 11, 21, 22, 25].map(days)).toEqual(expected[lang]);
    }
    setLang(saved);
  });
});

describe("сохранения", () => {
  it("текущей версии загружается без изменений", () => {
    vi.stubGlobal("localStorage", new MemoryStorage());
    const state = initialState(9);
    saveGame(state);
    expect(JSON.stringify(loadGame())).toBe(JSON.stringify(state));
  });

  it("версии 6 мигрирует: текст журнала и причин остаётся как есть", () => {
    const storage = new MemoryStorage();
    vi.stubGlobal("localStorage", storage);
    const state = initialState(9);
    const old = { ...state, log: [{ day: 1, text: "Старая запись" }], pending: [{ inDays: 1, key: "health", amount: -25, reason: "Старая причина" }] };
    storage.setItem("moonbase:save", JSON.stringify({ version: 6, state: old }));
    const migrated = loadGame();
    expect(migrated).not.toBeNull();
    expect(migrated!.log[0].key).toBe("log.legacy");
    expect(formatMsg(migrated!.log[0])).toBe("Старая запись");
    expect(formatMsg(migrated!.pending[0].reason)).toBe("Старая причина");
  });

  it("из будущей версии не загружается", () => {
    const storage = new MemoryStorage();
    vi.stubGlobal("localStorage", storage);
    storage.setItem("moonbase:save", JSON.stringify({ version: 99, state: initialState(9) }));
    expect(loadGame()).toBeNull();
  });
});

describe("данные NASA", () => {
  it("нормы расхода на человека заполнены (кислород, вода, еда) со ссылкой на источник", () => {
    const real = consumptionData.perCrewmemberPerDay;
    expect(Object.values(real).every((v) => typeof v === "number" && v > 0)).toBe(true);
    expect(real.oxygenKgWithExercise).toBeGreaterThan(real.oxygenKgResting);
    expect(consumptionData.url.startsWith("https://www.nasa.gov/")).toBe(true);
  });

  it("RadLab: у каждого дня есть показания, и он совпадает со вспышкой DONKI", () => {
    const flareDates = new Set((flaresData as { date: string }[]).map((f) => f.date));
    expect(radiationData.days.length).toBeGreaterThan(0);
    const bad = radiationData.days.filter(
      (d) => !(d.samples > 0 && d.meanDoseRate > 0 && d.meanDoseRate < 1000 && d.maxDoseRate >= d.meanDoseRate && flareDates.has(d.date)),
    );
    expect(bad).toEqual([]);
  });
});
