import { t, tDynamic } from "@/i18n";
import { sound } from "@/audio/audio";
import "./Intro.css";

const RULES = [1, 2, 3, 4, 5, 6];

type Props = {
  onStart: () => void;
  // true — окно открыто уже во время игры кнопкой «Правила»
  rulesOnly?: boolean;
};

// Правила перед миссией. Предыстория теперь в прологе, поэтому здесь только они
export function Intro({ onStart, rulesOnly = false }: Props) {
  return (
    <div className="overlay">
      <div className="modal intro intro--rules" role="dialog" aria-labelledby="intro-title">
        <div className="intro__bar">
          <h2 id="intro-title">{t("rules.title")}</h2>
          {rulesOnly && (
            <button
              type="button"
              className="intro__x"
              onClick={() => { sound.playClick(); onStart(); }}
              aria-label={t("build.close")}
              title={t("build.close")}
            >
              <svg viewBox="0 0 20 20" width="22" height="22" aria-hidden="true">
                <path d="M5 5 L15 15 M15 5 L5 15" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
              </svg>
            </button>
          )}
        </div>
        <ol className="rules">
          {RULES.map((n) => (
            <li key={n} className="rules__item">
              <span className="rules__num" aria-hidden="true">{n}</span>
              <div>
                <strong>{tDynamic(`rules.r${n}.title`)}</strong>
                <p>{tDynamic(`rules.r${n}.text`)}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="intro__actions">
          <button
            className="btn btn--primary"
            onClick={() => {
              sound.playClick();
              onStart();
            }}
          >
            {rulesOnly ? t("intro.close") : t("intro.start")}
          </button>
        </div>
      </div>
    </div>
  );
}
