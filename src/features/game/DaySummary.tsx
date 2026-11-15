import { useEffect, useRef, useState } from "react";
import type { DaySummary as Summary, VitalKey } from "@/engine";
import { MISSION_DAYS } from "@/engine";
import { days, moduleName, t, tDynamic } from "@/i18n";
import { ResourceIcon } from "@/ui/icons";

const VITAL: VitalKey[] = ["oxygen", "water", "food", "energy"];
const STARS = { ahead: 3, onTrack: 2, behind: 1 } as const;
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

function Star({ on, index }: { on: boolean; index: number }) {
  return (
    <svg
      className={`daysum__star${on ? " is-on" : ""}`}
      style={{ animationDelay: `${0.15 + index * 0.18}s` }}
      viewBox="0 0 24 24"
      width="52"
      height="52"
      aria-hidden="true"
    >
      <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3 6.1 20.6l1.3-6.6L2.5 9.4l6.6-.8z" strokeLinejoin="round" />
    </svg>
  );
}

// Окно «Итоги дня» для детей 7–12: ракета и звёзды, что сделал, запасы со смайлами, план на завтра
export function DaySummary({ summary, onClose }: { summary: Summary; onClose: () => void }) {
  const { verdict, tomorrow } = summary;

  const done = [
    ...summary.built.map((m) => ({ text: t("sum.built", { name: moduleName(m) }) })),
    ...summary.tasksDone.map((id) => ({ text: tDynamic(`task.${id}`) })),
  ];
  const shownDone = done.slice(0, MAX_DONE);
  const moreDone = done.length - shownDone.length;

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
  const more = summary.left.length - left.length;
  const progress = Math.min(100, Math.round((summary.day / MISSION_DAYS) * 100));

  // Окно закрывается само: время читать зависит от количества текста (~2,5 слова в секунду для 7–12 лет)
  const wordCount = [...shownDone.map((d) => d.text), ...care, ...heads, ...left.map(({ task }) => tDynamic(`task.${task.id}`))]
    .join(" ")
    .split(/\s+/).length + 14;
  const seconds = Math.min(AUTO_MAX, Math.max(AUTO_MIN, Math.round(4 + wordCount * 0.4)));
  const [paused, setPaused] = useState(false);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });
  const elapsed = useRef(0);
  useEffect(() => {
    if (paused) return;
    const id = window.setInterval(() => {
      elapsed.current += 0.1;
      if (elapsed.current >= seconds) closeRef.current();
    }, 100);
    return () => window.clearInterval(id);
  }, [paused, seconds]);

  return (
    <div className="overlay">
      <div className={`modal daysum daysum--${verdict}`} role="dialog" aria-labelledby="daysum-title"
        onPointerEnter={() => setPaused(true)} onPointerLeave={() => setPaused(false)}>
        <header className="daysum__head">
          <h2 id="daysum-title">{t("sum.title", { day: summary.day })}</h2>
          <div className="daysum__progress" role="img" aria-label={t("sum.progress", { day: summary.day, total: MISSION_DAYS })}>
            <div className="daysum__progress-bar"><i style={{ width: `${progress}%` }} /></div>
            <span>{t("sum.progress", { day: summary.day, total: MISSION_DAYS })}</span>
          </div>
          <div className="daysum__stars" aria-hidden="true">
            {[1, 2, 3].map((n) => (
              <Star key={n} on={n <= STARS[verdict]} index={n} />
            ))}
          </div>
          <p className="daysum__verdict">{tDynamic(`sum.verdict.${verdict}`)}</p>
        </header>

        <section aria-label={t("sum.res.title")}>
          <h3>{t("sum.res.title")}</h3>
          <ul className="daysum__res">
            {VITAL.map((key) => {
              const left = summary.runway[key];
              const mood = moodOf(left);
              const n = summary.deltas[key];
              return (
                <li key={key} className={`is-${mood}`}>
                  <ResourceIcon type={key} size={38} />
                  <span className="daysum__res-name">{tDynamic(`res.${key}`)}</span>
                  <strong className={n > 0 ? "is-up" : n < 0 ? "is-down" : ""}>
                    {n > 0 ? `▲ +${n}` : n < 0 ? `▼ −${Math.abs(n)}` : "•"}
                  </strong>
                  <span className="daysum__res-state">
                    {left === null ? t("sum.res.plenty") : mood === "good" ? t("sum.res.good") : t("sum.res.left", { days: days(left) })}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        {care.length > 0 && (
          <section className="daysum__care" aria-label={t("sum.care.title")}>
            <h3>{t("sum.care.title")}</h3>
            <ul>
              {care.map((text, i) => (
                <li key={i}>{text}</li>
              ))}
            </ul>
          </section>
        )}

        <div className="daysum__cols">
        <section className="daysum__card daysum__did">
          <h3>{t("sum.done.title")}</h3>
          {shownDone.length > 0 ? (
            <ul>
              {shownDone.map((d, i) => (
                <li key={i} className="is-done"><i aria-hidden="true" />{d.text}</li>
              ))}
              {moreDone > 0 && <li className="daysum__more">{t("sum.left.more", { n: moreDone })}</li>}
            </ul>
          ) : (
            <p className="daysum__quiet">{t("sum.done.none")}</p>
          )}
        </section>

        {(left.length > 0 || heads.length > 0) && (
          <section className="daysum__card daysum__next">
            <h3>{t("sum.left.title")}</h3>
            <ul>
              {left.map(({ task, late }) => (
                <li key={task.id} className={late ? "is-late" : ""}>
                  <i aria-hidden="true" />
                  {tDynamic(`task.${task.id}`)}
                </li>
              ))}
              {more > 0 && <li className="daysum__more">{t("sum.left.more", { n: more })}</li>}
              {heads.map((h) => (
                <li key={h} className="daysum__head-up">{h}</li>
              ))}
            </ul>
          </section>
        )}
        </div>

        <button className="btn btn--primary daysum__go" autoFocus onClick={onClose}>
          {t("sum.continue")}
          <i className="daysum__timer" aria-hidden="true" style={{ animationDuration: `${seconds}s`, animationPlayState: paused ? "paused" : "running" }} />
        </button>
      </div>
    </div>
  );
}
