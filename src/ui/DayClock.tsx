import { useEffect, useRef, useState } from "react";
import { t } from "../i18n";

// Сколько длится игровой день. Короче нельзя: дети 7–12 должны успеть прочитать и подумать
export const DAY_MS = 25000;

type Props = {
  running: boolean;       // false: идёт событие, правила, выбор места или игра окончена
  dayKey: number;         // новый день сбрасывает полоску
  onDayEnd: () => void;
  children?: React.ReactNode; // например, кнопка «Правила» в том же ряду
};

// Время дня: полоска, пауза и ускорение ×2. Когда полоска заполнится, день сменится сам
export function DayClock({ running, dayKey, onDayEnd, children }: Props) {
  const [paused, setPaused] = useState(false);
  const [fast, setFast] = useState(false);
  const [progress, setProgress] = useState(0);
  const elapsed = useRef(0);
  const endRef = useRef(onDayEnd);
  endRef.current = onDayEnd;

  useEffect(() => {
    elapsed.current = 0;
    setProgress(0);
  }, [dayKey]);

  useEffect(() => {
    if (!running || paused) return;
    let last = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      // Если вкладка пряталась, не прибавляем сразу всё пропущенное время
      elapsed.current += Math.min(now - last, 100) * (fast ? 2 : 1);
      last = now;
      if (elapsed.current >= DAY_MS) {
        elapsed.current = 0;
        setProgress(0);
        endRef.current();
      } else {
        setProgress(Math.round((elapsed.current / DAY_MS) * 200) / 200);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running, paused, fast]);

  const low = progress > 0.75;

  return (
    <div className="dayclock">
      <div
        className={`dayclock__bar ${low ? "dayclock__bar--low" : ""}`}
        role="progressbar"
        aria-label={t("app.dayTimer")}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
      >
        <div style={{ transform: `scaleX(${progress})` }} />
      </div>
      <button
        className="btn btn--ghost btn--small"
        onClick={() => setPaused((p) => !p)}
        aria-pressed={paused}
        title={paused ? t("app.resume") : t("app.pause")}
      >
        {paused ? "▶" : "⏸"} {paused ? t("app.resume") : t("app.pause")}
      </button>
      <button
        className={`btn btn--ghost btn--small ${fast ? "btn--on" : ""}`}
        onClick={() => setFast((f) => !f)}
        aria-pressed={fast}
        title={t("app.fast")}
      >
        ×2
      </button>
      {children}
    </div>
  );
}
