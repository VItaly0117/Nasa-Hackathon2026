import { useEffect } from "react";
import sourcesData from "@/content/sources.json";
import { t, tDynamic } from "@/i18n";
import { sound } from "@/audio/audio";
import "./MainMenu.css";

type Source = { id: string; url: string; provider: string; inGame: boolean };

const SOURCES = sourcesData as Source[];

// «Данные NASA»: откуда взяты цифры и факты в игре. Оформление как у главного экрана; каждая карточка — ссылка на источник
export function SourcesPanel({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="mm mm--sources">
      <div className="mm__box mm__box--sources" role="dialog" aria-labelledby="sources-title">
        <h1 id="sources-title" className="mm__title">{t("sources.title")}</h1>
        <p className="mm__tagline">{t("sources.intro")}</p>
        <div className="mm__list">
          {SOURCES.map((s) => (
            <a
              key={s.id}
              className="mm__btn mm__btn--glass mm__card"
              href={s.url}
              target="_blank"
              rel="noreferrer"
              onClick={() => sound.playClick()}
            >
              <strong>{tDynamic(`source.${s.id}.name`)}</strong>
              <span>{tDynamic(`source.${s.id}.usedFor`)}</span>
            </a>
          ))}
        </div>
        <button className="mm__btn mm__btn--new" onClick={() => { sound.playClick(); onClose(); }}>
          {t("sources.close")}
        </button>
      </div>
    </div>
  );
}
