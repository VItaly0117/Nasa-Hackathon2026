import { useEffect, useRef } from "react";
import { t } from "@/i18n";
import { DAY_MS } from "@/engine";

// Как часто часы отправляют движку tick (в мс). Реже нельзя: полоска будет дёргаться,
// чаще не нужно: игра перерисовывается на каждый tick
const TICK_MS = 100;

type Props = {
  running: boolean;       // false: идёт событие, правила, выбор места или игра окончена
  isNight?: boolean;      // ночь: на шкале луна вместо солнца
  progress: number;       // 0..1: сколько дня прошло (GameState.clockMs / DAY_MS)
  onTick: (ms: number) => void;
  children?: React.ReactNode; // например, кнопка «Правила» в том же ряду
};

function format(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// Обратный отсчёт дня: день ровно 2 минуты, паузы и ускорения нет. Само время считает движок (action tick):
// от тех же часов идут день и стройка, поэтому они всегда согласованы
export function DayClock({ running, progress, onTick, children }: Props) {
  const tickRef = useRef(onTick);
  useEffect(() => {
    tickRef.current = onTick;
  });

  useEffect(() => {
    if (!running) return;
    let last = performance.now();
    let acc = 0;
    let raf = 0;
    const loop = (now: number) => {
      // Если вкладка пряталась, не прибавляем сразу всё пропущенное время
      acc += Math.min(now - last, 100);
      last = now;
      if (acc >= TICK_MS) {
        tickRef.current(acc);
        acc = 0;
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running]);

  const left = DAY_MS * (1 - progress);
  const low = left <= 15000;

  return (
    <div className="dayclock">
      <div
        className={`dayclock__time ${low ? "dayclock__time--low" : ""}`}
        role="timer"
        aria-label={`${t("app.untilDayEnd")} ${format(left)}`}
        title={t("app.untilDayEnd")}
      >
        <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
          <circle cx="10" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M10 7 V11 L13 13 M8 2 H12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        <span className="dayclock__label">{t("app.untilDayEnd")}</span>
        {format(left)}
      </div>
      {children}
    </div>
  );
}
