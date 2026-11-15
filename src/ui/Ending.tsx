import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { t } from "../i18n";
import { sound } from "../audio/audio";
import { CREW } from "./crewData";
import { Rocket } from "./Prologue";
import "./Ending.css";

// Сколько держится каждый кадр, мс (к этому добавляется время на чтение субтитра)
const WIN_MS = [7000, 4500, 6000, 7000];
const LOSE_MS = [6000, 6500];

type Props = { won: boolean; onDone: () => void };

// Звёзды одни и те же при каждом показе
function useStars(count: number) {
  return useMemo(() => {
    let seed = 11;
    const rnd = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    return Array.from({ length: count }, () => ({
      left: rnd() * 100,
      top: rnd() * 100,
      size: 1 + rnd() * 2.2,
      delay: rnd() * 4,
    }));
  }, [count]);
}

// Член экипажа: голова и скафандр. Цвета берём из crewData, как у аватарок
function Astronaut({ id }: { id: number }) {
  const c = CREW.find((x) => x.id === id)!;
  return (
    <span className="end-man" style={{ "--suit": c.suit, "--skin": c.skin, "--hair": c.hair } as CSSProperties}>
      <span className="end-man__bob">
        <span className="end-man__head" />
        <span className="end-man__body" />
        <span className="end-man__legs" />
      </span>
    </span>
  );
}

// Финал: победа — экипаж садится в ракеты и летит на Землю, поражение — остаётся на Луне
export function Ending({ won, onDone }: Props) {
  const [step, setStep] = useState(0);
  const stars = useStars(80);

  const key = won ? "win" : "lose";
  const durations = won ? WIN_MS : LOSE_MS;
  const finished = step >= durations.length; // последний кадр без таймера: ждёт кнопку
  const text = t(`end.${key}${Math.min(step, durations.length - 1) + 1}`);
  const readMs = finished ? 0 : Math.max(durations[step], 3500 + text.length * 90);

  useEffect(() => {
    sound.playRadioChirp();
  }, [step]);

  useEffect(() => {
    if (finished) return;
    const timer = window.setTimeout(() => setStep((s) => s + 1), readMs);
    return () => window.clearTimeout(timer);
  }, [step, finished, readMs]);

  return (
    <div className={`ending-scene end--${key} end--s${step}`} role="dialog" aria-label={t(`end.${key}.title`)}>
      <div className="end-stars" aria-hidden="true">
        {stars.map((s, i) => (
          <i key={i} style={{ left: `${s.left}%`, top: `${s.top}%`, width: s.size, height: s.size, animationDelay: `${s.delay}s` }} />
        ))}
      </div>

      <div className="end-world" aria-hidden="true">
        <div className="end-earth">
          <span className="end-earth__land end-earth__land--a" />
          <span className="end-earth__land end-earth__land--b" />
          <span className="end-earth__land end-earth__land--c" />
        </div>

        <div className="end-ground">
          <div className="end-habitat">
            <i className="end-habitat__win end-habitat__win--a" />
            <i className="end-habitat__win end-habitat__win--b" />
          </div>
          <span className="end-rock end-rock--a" />
          <span className="end-rock end-rock--b" />
        </div>

        <div className="end-crew">
          {CREW.map((c, i) => (
            <span key={c.id} className={`end-walker end-walker--${i + 1}`}>
              <Astronaut id={c.id} />
            </span>
          ))}
        </div>

        <div className="end-rk end-rk--a">
          <Rocket flame={won && step >= 2} />
          {won && step === 2 && <span className="end-puff" />}
        </div>
        <div className="end-rk end-rk--b">
          <Rocket flame={won && step >= 2} />
          {won && step === 2 && <span className="end-puff end-puff--late" />}
        </div>

        <div className="end-dark" />
      </div>

      <div className="end-bar">
        <p key={step} className="end-text" role="status" aria-live="polite">
          {finished ? t(`end.${key}.final`) : text}
        </p>
        {finished && <p className="end-sub">{t(`end.${key}.title`)}</p>}
        <div className="end-actions">
          <button
            className={`btn ${finished ? "btn--primary" : "btn--ghost btn--small"}`}
            onClick={() => {
              sound.playClick();
              onDone();
            }}
          >
            {finished ? t("end.continue") : t("prologue.skip")}
          </button>
        </div>
      </div>
    </div>
  );
}
