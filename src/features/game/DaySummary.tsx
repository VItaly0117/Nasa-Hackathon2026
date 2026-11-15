import { useEffect, useRef, useState } from "react";
import type { DaySummary as Summary, VitalKey } from "@/engine";
import { days, moduleName, t, tDynamic } from "@/i18n";
import { ResourceIcon } from "@/ui/icons";

const VITAL: VitalKey[] = ["oxygen", "water", "food", "energy"];
const MAX_LEFT = 3;
const MAX_DONE = 4;
const AUTO_MIN = 8;
const AUTO_MAX = 18;

type Mood = "good" | "ok" | "bad";

// Хватает ли запаса: 5+ дней — всё хорошо, 3–4 — следи, меньше — тревога
function moodOf(left: number | null): Mood {
  if (left === null || left >= 5) return "good";
  return left >= 3 ? "ok" : "bad";
}


// Окно «Итоги дня» для детей 7–12: ракета и звёзды, что сделал, запасы со смайлами, план на завтра
export function DaySummary({ summary, onClose }: { summary: Summary; onClose: () => void }) {
  const { verdict, tomorrow } = summary;

  const done = [
    ...summary.built.map((m) => ({ text: t("sum.built", { name: moduleName(m) }) })),
    ...summary.tasksDone.map((id) => ({ text: tDynamic(`task.${id}`) })),
  ];
  const shownDone = done.slice(0, MAX_DONE);

  // Всё, что пошло не так, в одном блоке
  const care = [
    ...summary.shortages.map((key) => t("sum.care.shortage", { what: tDynamic(`res.${key}`) })),
    ...(summary.blackout ? [t("sum.blackout")] : []),
    ...summary.tasksMissed.map((id) => `${t("sum.missed.title")}: ${tDynamic(`task.${id}`)}`),
  ];

  // Что ждёт завтра: ночь и события, только если они совсем близко
  const heads: string[] = [];
  if (tomorrow.night) heads.push(t("sum.out.night"));
  else if (tomorrow.nightIn !== null && tomorrow.nightIn > 0 && tomorrow.nightIn <= 2) {
    heads.push(t("sum.out.nightSoon", { days: days(tomorrow.nightIn) }));
  }
  if (tomorrow.event && tomorrow.event.inDays <= 2) {
    heads.push(t("sum.out.event", { days: days(tomorrow.event.inDays), title: tDynamic(`ev.${tomorrow.event.id}.title`) }));
  }

  const left = summary.left.slice(0, MAX_LEFT);

  // Окно закрывается само: время читать зависит от количества текста (~2,5 слова в секунду для 7–12 лет)
  const wordCount = [...shownDone.map((d) => d.text), ...care, ...heads, ...left.map(({ task }) => tDynamic(`task.${task.id}`))]
    .join(" ")
    .split(/\s+/).length + 14;
  const seconds = Math.min(AUTO_MAX, Math.max(AUTO_MIN, Math.round(4 + wordCount * 0.4)));
  // Один источник времени: дедлайн по часам. Без паузы по наведению (из-за неё таймер «зависал»),
  // без второй CSS-анимации, которая расходилась с JS-таймером.
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const [secLeft, setSecLeft] = useState(seconds);
  useEffect(() => {
    const end = Date.now() + seconds * 1000;
    let done = false;
    const tick = () => {
      const rest = end - Date.now();
      if (rest <= 0) {
        if (!done) {
          done = true;
          closeRef.current();
        }
        return;
      }
      setSecLeft(Math.ceil(rest / 1000));
    };
    const id = window.setInterval(tick, 200);
    return () => window.clearInterval(id);
  }, [seconds]);

  return (
    <div className="overlay">
      <div className={`modal daysum daysum--${verdict}`} role="dialog" aria-labelledby="daysum-title"
        style={{ "--dur": `${seconds}s` } as React.CSSProperties}>
        <div className="daysum__bar" aria-hidden="true"><span /></div>
        <header className="daysum__head">
          <h2 id="daysum-title">{t("sum.title", { day: summary.day })}</h2>
          <p className="daysum__verdict">{tDynamic(`sum.verdict.${verdict}`)}</p>
        </header>

        <section aria-label={t("sum.res.title")}>
          <ul className="daysum__res">
            {VITAL.map((key) => {
              const left = summary.runway[key];
              const mood = moodOf(left);
              const n = summary.deltas[key];
              return (
                <li key={key} className={`is-${mood}`}>
                  <ResourceIcon type={key} size={32} />
                  <span className="daysum__res-name">{tDynamic(`res.${key}`)}</span>
                  <strong className={n > 0 ? "is-up" : n < 0 ? "is-down" : ""}>
                    {n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0"}
                  </strong>
                  {left !== null && mood !== "good" && (
                    <span className="daysum__res-state">{t("sum.res.left", { days: days(left) })}</span>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        {care.length > 0 && (
          <ul className="daysum__care" role="alert">
            {care.map((text, i) => (
              <li key={i}>{text}</li>
            ))}
          </ul>
        )}

        {shownDone.length > 0 && (
          <section className="daysum__list daysum__did">
            <h3>{t("sum.done.title")}</h3>
            <ul>
              {shownDone.map((d, i) => (
                <li key={i}><i aria-hidden="true">✓</i>{d.text}</li>
              ))}
            </ul>
          </section>
        )}

        {(left.length > 0 || heads.length > 0) && (
          <section className="daysum__list daysum__next">
            <h3>{t("sum.left.title")}</h3>
            <ul>
              {left.map(({ task, late }) => (
                <li key={task.id} className={late ? "is-late" : ""}>
                  <i aria-hidden="true" />
                  {tDynamic(`task.${task.id}`)}
                </li>
              ))}
            </ul>
            {heads.length > 0 && <p className="daysum__heads">{heads.join(" · ")}</p>}
          </section>
        )}

        <button className="btn btn--primary daysum__go" autoFocus onClick={onClose}>
          <span className="daysum__go-text">{t("sum.continue")}</span>
          <span className="daysum__count" aria-hidden="true">{secLeft}</span>
        </button>
      </div>
    </div>
  );
}
