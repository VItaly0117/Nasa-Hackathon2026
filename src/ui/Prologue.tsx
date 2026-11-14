import { useEffect, useMemo, useState } from "react";
import { t } from "../i18n";
import { sound } from "../audio/audio";
import "./Prologue.css";

// Сколько показывается каждый субтитр, мс. Последний ждёт нажатия кнопки
const STEP_MS = [6500, 6000, 6500, 6500, 6500, 7500];
const LAST = STEP_MS.length; // номер последнего шага: он без таймера
const SURFACE_FROM = 4;      // с этого шага камера смотрит на поверхность Луны

type RocketProps = { className?: string; flame?: boolean };

// Ракета смотрит носом вверх. Поворот и положение задаёт CSS
export function Rocket({ className = "", flame = false }: RocketProps) {
  return (
    <svg className={`rocket-svg ${className}`} viewBox="0 0 60 130" aria-hidden="true">
      {flame && (
        <g className="rocket-svg__flame">
          <path d="M22 96 Q30 140 38 96 Z" fill="#ff8a3d" />
          <path d="M25 96 Q30 124 35 96 Z" fill="#ffd166" />
        </g>
      )}
      <path d="M14 70 L2 98 L16 94 Z" fill="#e0524a" />
      <path d="M46 70 L58 98 L44 94 Z" fill="#e0524a" />
      <path d="M30 2 C 44 20 46 50 44 96 H16 C14 50 16 20 30 2 Z" fill="#f4f6ff" stroke="#b9c2e8" strokeWidth="1.5" />
      <path d="M30 2 C 38 12 42 24 43 34 H17 C18 24 22 12 30 2 Z" fill="#e0524a" />
      <circle cx="30" cy="54" r="8" fill="#6ec5ff" stroke="#8a96c8" strokeWidth="2" />
      <circle cx="27.5" cy="51.5" r="2.5" fill="#ffffff" opacity="0.7" />
      <rect x="20" y="96" width="20" height="6" rx="2" fill="#8a96c8" />
    </svg>
  );
}

// Одни и те же «случайные» звёзды при каждом показе
function useStars(count: number) {
  return useMemo(() => {
    let seed = 7;
    const rnd = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    return Array.from({ length: count }, () => ({
      left: rnd() * 100,
      top: rnd() * 100,
      size: 1 + rnd() * 2.5,
      delay: rnd() * 4,
    }));
  }, [count]);
}

type Props = { onDone: () => void };

// Пролог: ракета летит с Земли на Луну, внизу идут субтитры
export function Prologue({ onDone }: Props) {
  const [step, setStep] = useState(0);
  const stars = useStars(70);

  const finished = step >= LAST;
  // Время на субтитр зависит от длины текста, чтобы дети успели прочитать
  const text = t(`prologue.p${step + 1}`);
  const readMs = Math.max(STEP_MS[Math.min(step, LAST - 1)], 3500 + text.length * 110);

  useEffect(() => {
    sound.playRadioChirp();
  }, [step]);

  useEffect(() => {
    // Последний шаг тоже листается сам: после него начинаются правила
    const timer = window.setTimeout(() => (finished ? onDone() : setStep((s) => s + 1)), readMs);
    return () => window.clearTimeout(timer);
  }, [step, finished, readMs, onDone]);

  const surface = step >= SURFACE_FROM;

  return (
    <div className={`prologue prologue--s${step} ${surface ? "prologue--surface" : "prologue--space"}`}>
      <div className="prologue__stars" aria-hidden="true">
        {stars.map((s, i) => (
          <i
            key={i}
            style={{ left: `${s.left}%`, top: `${s.top}%`, width: s.size, height: s.size, animationDelay: `${s.delay}s` }}
          />
        ))}
      </div>

      {/* Космос: Земля, Луна и летящая ракета */}
      <div className="scene scene--space" aria-hidden="true">
        <div className="pro-earth">
          <span className="pro-earth__land pro-earth__land--a" />
          <span className="pro-earth__land pro-earth__land--b" />
          <span className="pro-earth__land pro-earth__land--c" />
        </div>
        <div className="pro-moon">
          <span className="pro-moon__crater pro-moon__crater--a" />
          <span className="pro-moon__crater pro-moon__crater--b" />
          <span className="pro-moon__crater pro-moon__crater--c" />
        </div>
        <div className="pro-fly">
          <Rocket className="pro-fly__rocket" flame={step >= 1} />
          {step === 1 && <span className="pro-smoke" />}
        </div>
      </div>

      {/* Поверхность Луны: посадка и пустая база */}
      <div className="scene scene--surface" aria-hidden="true">
        <div className="pro-ground">
          <div className="pro-pad" />
          <div className="pro-habitat">
            <i />
          </div>
        </div>
        <div className={`pro-land ${step >= 5 ? "pro-land--down" : ""}`}>
          <Rocket className="pro-land__rocket" flame={step === 4} />
          {step === 4 && <span className="pro-dust" />}
        </div>
      </div>

      <div className="prologue__bar">
        <ol className="prologue__dots" aria-hidden="true">
          {Array.from({ length: LAST + 1 }, (_, i) => (
            <li key={i} className={i === step ? "is-on" : i < step ? "is-done" : ""} />
          ))}
        </ol>
        <p key={step} className="prologue__text" role="status" aria-live="polite">
          {text}
        </p>
        <div key={`t${step}`} className="prologue__timer" aria-hidden="true">
          <div style={{ animationDuration: `${readMs}ms` }} />
        </div>
        <div className="prologue__actions">
          {!finished && (
            <>
              <button
                className="btn btn--ghost btn--small"
                onClick={() => {
                  sound.playClick();
                  onDone();
                }}
              >
                {t("prologue.skip")}
              </button>
              <button
                className="btn btn--ghost btn--small"
                onClick={() => {
                  sound.playClick();
                  setStep((s) => s + 1);
                }}
              >
                {t("prologue.next")}
              </button>
            </>
          )}
          {finished && (
            <button
              className="btn btn--primary"
              onClick={() => {
                sound.playClick();
                onDone();
              }}
            >
              {t("prologue.go")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
