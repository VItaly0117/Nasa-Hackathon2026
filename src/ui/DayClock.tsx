import { useEffect, useRef, useState } from "react";
import { t } from "../i18n";

// Как часто часы отправляют движку tick (в мс игрового времени). Реже нельзя: полоска будет дёргаться,
// чаще не нужно: игра перерисовывается на каждый tick
const TICK_MS = 100;

type Props = {
  running: boolean;       // false: идёт событие, правила, выбор места или игра окончена
  progress: number;       // 0..1: сколько дня прошло (GameState.clockMs / DAY_MS)
  onTick: (ms: number) => void;
  children?: React.ReactNode; // например, кнопка «Правила» в том же ряду
};

// Время дня: полоска, пауза и ускорение ×2. Само время считает движок (action tick):
// от тех же часов идут день и стройка, поэтому пауза и ускорение действуют на всё сразу
export function DayClock({ running, progress, onTick, children }: Props) {
  const [paused, setPaused] = useState(false);
  const [fast, setFast] = useState(false);
  const tickRef = useRef(onTick);
  tickRef.current = onTick;

  useEffect(() => {
    if (!running || paused) return;
    let last = performance.now();
    let acc = 0;
    let raf = 0;
    const loop = (now: number) => {
      // Если вкладка пряталась, не прибавляем сразу всё пропущенное время
      acc += Math.min(now - last, 100) * (fast ? 2 : 1);
      last = now;
      if (acc >= TICK_MS) {
        tickRef.current(acc);
        acc = 0;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
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
