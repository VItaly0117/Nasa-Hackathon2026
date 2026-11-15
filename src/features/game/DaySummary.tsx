import { useEffect, useRef } from "react";
import { MISSION_DAYS, type DaySummary as Summary, type VitalKey } from "@/engine";
import { days, moduleName, t, tDynamic } from "@/i18n";
import { sound } from "@/audio/audio";
import { ResourceIcon } from "@/ui/icons";

const VITAL: VitalKey[] = ["oxygen", "water", "food", "energy"];
const MAX_LEFT = 3;
const MAX_DONE = 4;

type Mood = "good" | "ok" | "bad";

// Хватает ли запаса: 5+ дней — всё хорошо, 3–4 — следи, меньше — тревога
function moodOf(left: number | null): Mood {
  if (left === null || left >= 5) return "good";
  return left >= 3 ? "ok" : "bad";
}


// Окно «Итоги дня» для детей 7–12: ракета и звёзды, что сделал, запасы со смайлами, план на завтра
export function DaySummary({ summary, onClose }: { summary: Summary; onClose: () => void }) {
  const { verdict } = summary;

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

  const left = summary.left.slice(0, MAX_LEFT);

  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  });
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeRef.current();
    };
    window.addEventListener("keydown", onKey);
    // Після заповнення смужки (10 с) вікно закривається саме
    const timer = window.setTimeout(() => closeRef.current(), 10000);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(timer);
    };
  }, []);
  return (
    <div className="overlay">
      <div className={`modal daysum daysum--${verdict} daysum--kids`} role="dialog" aria-labelledby="daysum-title">
        <header className="daysum__head">
          <h2 id="daysum-title" className="daysum__title">{t("sum.title", { day: summary.day })}</h2>
          <p className="daysum__verdict">{tDynamic(`sum.verdict.${verdict}`)}</p>
        </header>

        <div className="daysum__body">
        <section aria-label={t("sum.res.title")}>
          <ul className="daysum__res">
            {VITAL.map((key) => {
              const left = summary.runway[key];
              const mood = moodOf(left);
              return (
                <li key={key} className={`is-${mood}`}>
                  <ResourceIcon type={key} size={36} />
                  <span className="daysum__res-name">{tDynamic(`res.${key}`)}</span>
                  <strong>{t(`sum.res.${mood}`)}</strong>
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

        {left.length > 0 && (
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
          </section>
        )}

        </div>

        <footer className="daysum__foot">
        <button className="btn btn--primary daysum__go" autoFocus style={{ "--p": `${Math.min(100, (summary.day / MISSION_DAYS) * 100)}%`, "--p0": `${Math.min(100, ((summary.day - 1) / MISSION_DAYS) * 100)}%` } as React.CSSProperties} aria-label={t("sum.progress", { day: summary.day, total: MISSION_DAYS })} onClick={() => { sound.playClick(); onClose(); }}>
          <span className="daysum__go-text">{summary.day < MISSION_DAYS ? t("sum.next", { day: summary.day + 1 }) : t("sum.continue")}</span>
        </button>
        </footer>
      </div>
    </div>
  );
}
