import { useState } from "react";

// Панели по умолчанию свёрнуты на любом экране: карта и астронавты должны быть видны,
// а нужную панель ребёнок раскрывает сам
export function startsCollapsed() {
  return true;
}

export function useCollapsed(initial = false): [boolean, () => void] {
  const [collapsed, setCollapsed] = useState(initial);
  return [collapsed, () => setCollapsed((c) => !c)];
}
