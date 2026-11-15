import { t } from "@/i18n";
import { MoonLogo } from "./icons";
import "./Loader.css";

type Props = {
  progress: number; // 0..1
  leaving: boolean; // плавно скрывается
};

// Экран загрузки между меню и игрой: луна на орбите и полоска прогресса
export function Loader({ progress, leaving }: Props) {
  const pct = Math.round(progress * 100);
  return (
    <div className={`loader${leaving ? " loader--out" : ""}`} role="progressbar" aria-label={t("app.loading")} aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct}>
      <div className="loader__orbit" aria-hidden="true">
        <span className="loader__ring" />
        <span className="loader__moon"><MoonLogo size={72} /></span>
      </div>
      <p className="loader__text">{t("app.loading")}</p>
      <div className="loader__bar" aria-hidden="true">
        <span className="loader__fill" style={{ transform: `scaleX(${progress})` }} />
      </div>
    </div>
  );
}
