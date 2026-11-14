import sourcesData from "@/content/sources.json";
import { t, tDynamic } from "@/i18n";
import "@/features/results/ResultsScreen.css";

type Source = { id: string; url: string; provider: string; inGame: boolean };

const SOURCES = sourcesData as Source[];

// «Данные NASA»: откуда взяты цифры и факты в игре и что с ними сделано. Нужен жюри и любопытным
export function SourcesPanel({ onClose }: { onClose: () => void }) {
  return (
    <div className="overlay">
      <div className="modal results" role="dialog" aria-labelledby="sources-title">
        <h2 id="sources-title">{t("sources.title")}</h2>
        <p className="muted">{t("sources.intro")}</p>
        <div className="results__cards">
          {SOURCES.map((s) => (
            <div key={s.id} className="results__card">
              <strong>{tDynamic(`source.${s.id}.name`)}</strong>
              <p>{tDynamic(`source.${s.id}.usedFor`)}</p>
              <small>
                {s.provider} · {s.inGame ? t("sources.inGame") : t("sources.notYet")} ·{" "}
                <a href={s.url} target="_blank" rel="noreferrer">
                  {t("sources.open")}
                </a>
              </small>
            </div>
          ))}
        </div>
        <div className="modal__choices">
          <button className="btn btn--primary" onClick={onClose}>
            {t("sources.close")}
          </button>
        </div>
      </div>
    </div>
  );
}
