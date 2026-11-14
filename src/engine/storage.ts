// Сохранения и рекорды в localStorage. TODO @Regie
const RECORDS_KEY = "moonbase:records";

export type GameRecord = { days: number; health: number; won: boolean; at: string };

export function loadRecords(): GameRecord[] {
  try {
    return JSON.parse(localStorage.getItem(RECORDS_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function saveRecord(record: GameRecord) {
  try {
    localStorage.setItem(RECORDS_KEY, JSON.stringify([...loadRecords(), record]));
  } catch {
    // приватный режим или заблокированное хранилище: рекорды просто не сохраняются
  }
}
