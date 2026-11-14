import { t } from "../i18n";
import { sound } from "../audio/audio";
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
      <div className="modal intro" role="dialog" aria-labelledby="intro-title">
        <h2 id="intro-title">{t("rules.title")}</h2>
        <ol className="rules">
          {RULES.map((n) => (
            <li key={n} className="rules__item">
              <span className="rules__num" aria-hidden="true">{n}</span>
              <div>
                <strong>{t(`rules.r${n}.title`)}</strong>
                <p>{t(`rules.r${n}.text`)}</p>
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
