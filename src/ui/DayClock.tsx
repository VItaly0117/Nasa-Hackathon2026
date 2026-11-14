import { useEffect, useRef, useState } from "react";
import { t } from "../i18n";

// Сколько длится игровой день: ровно 2 минуты. Паузы и пропуска дня нет
export const DAY_MS = 120000;

type Props = {
  running: boolean;       // false: идёт событие, правила, выбор места или игра окончена
  dayKey: number;         // новый день сбрасывает таймер
  onDayEnd: () => void;
  children?: React.ReactNode; // например, кнопка «Правила» в том же ряду
};

function format(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

// Обратный отсчёт дня. Когда время выйдет, день сменится сам
export function DayClock({ running, dayKey, onDayEnd, children }: Props) {
  const [left, setLeft] = useState(DAY_MS);
  const elapsed = useRef(0);
  const endRef = useRef(onDayEnd);
  endRef.current = onDayEnd;

  useEffect(() => {
    elapsed.current = 0;
    setLeft(DAY_MS);
  }, [dayKey]);

  useEffect(() => {
    if (!running) return;
    let last = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      // Если вкладка пряталась, не прибавляем сразу всё пропущенное время
      elapsed.current += Math.min(now - last, 100);
      last = now;
      if (elapsed.current >= DAY_MS) {
        elapsed.current = 0;
        setLeft(DAY_MS);
        endRef.current();
      } else {
        // Обновляем раз в 200 мс: секунды всё равно меняются реже
        setLeft(Math.round((DAY_MS - elapsed.current) / 200) * 200);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running]);

  const progress = 1 - left / DAY_MS;
  const low = left <= 15000;

  return (
    <div className="dayclock">
      <div
        className={`dayclock__time ${low ? "dayclock__time--low" : ""}`}
        role="timer"
        aria-label={t("app.timerLeft")}
        title={t("app.timerLeft")}
      >
        <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
          <circle cx="10" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
          <path d="M10 7 V11 L13 13 M8 2 H12" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        </svg>
        {format(left)}
      </div>
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
      {children}
    </div>
  );
}
