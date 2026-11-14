import { useState } from "react";
import { t } from "../i18n";

// Узкий экран (телефон, планшет): панели по умолчанию свёрнуты, чтобы не закрывать базу
export function startsCollapsed() {
  try {
    return window.matchMedia("(max-width: 900px), (max-height: 560px)").matches;
  } catch {
    return false;
  }
}

export function useCollapsed(initial = false): [boolean, () => void] {
  const [collapsed, setCollapsed] = useState(initial);
  return [collapsed, () => setCollapsed((c) => !c)];
}

// Кнопка-шеврон в заголовке панели
export function CollapseButton({ collapsed, onClick }: { collapsed: boolean; onClick: () => void }) {
  const label = collapsed ? t("ui.show") : t("ui.hide");
  return (
    <button className="collapse-btn" onClick={onClick} aria-expanded={!collapsed} aria-label={label} title={label}>
      <svg viewBox="0 0 20 20" width="20" height="20" aria-hidden="true">
        <path
          d={collapsed ? "M5 8 L10 13 L15 8" : "M5 13 L10 8 L15 13"}
          stroke="currentColor"
          strokeWidth="2.6"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
