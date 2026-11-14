import { useState } from "react";
import { t } from "../i18n";
import { MoonLogo } from "./icons";
import "./Intro.css";

const RULES = [1, 2, 3, 4, 5, 6];
const STORY = [1, 2];

type Props = {
  onStart: () => void;
  // true — окно открыто уже во время игры кнопкой «Правила»: показываем только правила
  rulesOnly?: boolean;
};

// Перед началом игры: сначала предыстория, потом правила
export function Intro({ onStart, rulesOnly = false }: Props) {
  const [step, setStep] = useState<0 | 1>(rulesOnly ? 1 : 0);

  return (
    <div className="overlay">
      <div className="modal intro" role="dialog" aria-labelledby="intro-title">
        {step === 0 ? (
          <>
            <div className="intro__head">
              <MoonLogo size={64} />
              <span className="intro__kicker">{t("intro.kicker")}</span>
            </div>
            <h2 id="intro-title">{t("story.title")}</h2>
            {STORY.map((n) => (
              <p key={n} className="intro__text">{t(`story.p${n}`)}</p>
            ))}
            <div className="intro__actions">
              <button className="btn btn--primary" onClick={() => setStep(1)}>
                {t("intro.next")}
              </button>
            </div>
          </>
        ) : (
          <>
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
              {!rulesOnly && (
                <button className="btn btn--ghost" onClick={() => setStep(0)}>
                  {t("intro.back")}
                </button>
              )}
              <button className="btn btn--primary" onClick={onStart}>
                {rulesOnly ? t("intro.close") : t("intro.start")}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
