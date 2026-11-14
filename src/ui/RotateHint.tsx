import { t } from "../i18n";

// На телефоне в вертикальном положении CSS показывает эту подсказку поверх игры
export function RotateHint() {
  return (
    <div className="rotate-hint" role="alert">
      <svg viewBox="0 0 48 48" width="72" height="72" aria-hidden="true">
        <rect x="14" y="4" width="20" height="40" rx="4" fill="none" stroke="currentColor" strokeWidth="3" />
        <circle cx="24" cy="38" r="2" fill="currentColor" />
      </svg>
      {t("app.rotate")}
    </div>
  );
}
