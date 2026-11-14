import type { GameState } from "@/types";

// Сохранения, рекорды и выбранный язык в localStorage. Одиночная игра хранится только здесь, в браузере.
// Все функции молча переживают приватный режим и заблокированное хранилище: игра работает, просто без сохранений.

const RECORDS_KEY = "moonbase:records";
const SAVE_KEY = "moonbase:save";
const LANG_KEY = "moonbase:lang";
// Меняем номер, когда меняется форма GameState: старое сохранение тогда не загрузится и не сломает игру.
// 5: из экипажа убрали Софию; 6: добавлен список завершённых исследований;
// 7: журнал и причины отложенных эффектов хранят ключ и параметры вместо готового текста (старые тексты мигрируют как есть)
const SAVE_VERSION = 7;
const MAX_RECORDS = 10;

export type GameRecord = { days: number; health: number; won: boolean; at: string };

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // хранилище недоступно или переполнено
  }
}

// --- Язык ----------------------------------------------------------------------------

export function saveLang(lang: string) {
  write(LANG_KEY, lang);
}

export function loadLang(): string | null {
  return read<string | null>(LANG_KEY, null);
}

// --- Сохранение текущей миссии ---------------------------------------------------

export function saveGame(state: GameState) {
  write(SAVE_KEY, { version: SAVE_VERSION, state });
}

// Приводит сохранение старой версии к текущей форме
function migrate(s: GameState, version: number): GameState {
  let m = s;
  if (version < 6) m = { ...m, research: [] };
  if (version < 7) {
    // журнал и причины отложенных эффектов были готовым текстом: оставляем его как есть
    const legacy = (text: unknown) => ({ key: "log.legacy", params: { text: String(text) } });
    m = {
      ...m,
      log: (m.log as unknown as { day: number; text?: string }[]).map((e) => ({ day: e.day, ...legacy(e.text) })),
      pending: (m.pending as unknown as GameState["pending"]).map((p) => ({ ...p, reason: legacy(p.reason) })),
    };
  }
  return m;
}

// Незаконченная миссия или null. Законченные и повреждённые сохранения не возвращаем
export function loadGame(): GameState | null {
  const saved = read<{ version?: number; state?: GameState } | null>(SAVE_KEY, null);
  const s = saved?.state;
  if (!saved || !s || !saved.version || saved.version < 5 || saved.version > SAVE_VERSION) return null;
  const migrated = migrate(s, saved.version);
  const looksValid =
    typeof migrated.day === "number" &&
    migrated.status === "playing" &&
    typeof migrated.resources?.health === "number" &&
    Array.isArray(migrated.modules) &&
    Array.isArray(migrated.pending) &&
    Array.isArray(migrated.log) &&
    Array.isArray(migrated.history) &&
    Array.isArray(migrated.crew) &&
    Array.isArray(migrated.tasks) &&
    Array.isArray(migrated.research) &&
    typeof migrated.seed === "number" &&
    typeof migrated.clockMs === "number";
  return looksValid ? migrated : null;
}

export function clearSave() {
  try {
    localStorage.removeItem(SAVE_KEY);
  } catch {
    // нечего удалять
  }
}

// --- Рекорды -------------------------------------------------------------------------

// Что лучше: победа важнее поражения, потом здоровье экипажа, потом число прожитых дней
function compareRecords(a: GameRecord, b: GameRecord) {
  return Number(b.won) - Number(a.won) || b.health - a.health || b.days - a.days;
}

// Лучшие результаты, от лучшего к худшему
export function loadRecords(): GameRecord[] {
  const list = read<GameRecord[]>(RECORDS_KEY, []);
  return Array.isArray(list) ? [...list].sort(compareRecords) : [];
}

export function bestRecord(): GameRecord | null {
  return loadRecords()[0] ?? null;
}

export function recordFrom(state: GameState): GameRecord {
  return {
    days: state.day,
    health: Math.round(state.resources.health),
    won: state.status === "won",
    at: new Date().toISOString(),
  };
}

// Сохраняет результат и возвращает true, если это новый лучший результат
export function saveRecord(record: GameRecord): boolean {
  const previousBest = bestRecord();
  write(RECORDS_KEY, [...loadRecords(), record].sort(compareRecords).slice(0, MAX_RECORDS));
  return !previousBest || compareRecords(record, previousBest) < 0;
}
