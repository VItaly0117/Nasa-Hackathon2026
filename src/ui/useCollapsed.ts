import { useState } from "react";

// Панели по умолчанию свёрнуты на любом экране: карта и астронавты должны быть видны,
// а нужную панель ребёнок раскрывает сам
export function startsCollapsed() {
  return true;
}

const PREFIX = "moonbase.collapsed.";

function readStored(key?: string): boolean | null {
  if (!key) return null;
  try {
    const value = localStorage.getItem(PREFIX + key);
    return value === null ? null : value === "1";
  } catch {
    return null; // хранилище недоступно: остаёмся с настройкой по умолчанию
  }
}

function writeStored(key: string | undefined, collapsed: boolean) {
  if (!key) return;
  try {
    localStorage.setItem(PREFIX + key, collapsed ? "1" : "0");
  } catch {
    // не страшно: панель просто не запомнит выбор
  }
}

// storageKey: если задан, выбор игрока (свёрнуто или развёрнуто) переживает перезапуск игры
export function useCollapsed(initial = false, storageKey?: string): [boolean, () => void] {
  const [collapsed, setCollapsed] = useState(() => readStored(storageKey) ?? initial);
  const toggle = () =>
    setCollapsed((c) => {
      writeStored(storageKey, !c);
      return !c;
    });
  return [collapsed, toggle];
}
