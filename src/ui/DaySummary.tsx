import type { DaySummary as Summary } from "../engine/daySummary";
import type { ResourceKey } from "../types";
import { t } from "../i18n";
import { ResourceIcon } from "./icons";

const SHOWN: ResourceKey[] = ["oxygen", "water", "food", "energy", "health", "materials"];
const STARS = { ahead: 3, onTrack: 2, behind: 1 } as const;
const MAX_LEFT = 3;

function Star({ on }: { on: boolean }) {
  return (
    <svg className={`daysum__star${on ? " is-on" : ""}`} viewBox="0 0 24 24" width="48" height="48" aria-hidden="true">
      <path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3 6.1 20.6l1.3-6.6L2.5 9.4l6.6-.8z" strokeLinejoin="round" />
    </svg>
  );
}

// Окно «Итоги дня» для детей 7–12: звёзды, иконки ресурсов со стрелками, 1–3 задачи на завтра
export function DaySummary({ summary, onClose }: { summary: Summary; onClose: () => void }) {
  const { verdict } = summary;

  const doneCount = summary.built.length + summary.tasksDone.length + summary.decisions.length;
  const problems = [
    ...summary.shortages.map((key) => t(`res.${key}`)),
    ...(summary.blackout ? [t("sum.blackout")] : []),
  ];
  const changed = SHOWN.filter((key) => summary.deltas[key] !== 0);

  const left = summary.left.slice(0, MAX_LEFT);
  const more = summary.left.length - left.length;

  return (
    <div className="overlay">
      <div className={`modal daysum daysum--${verdict}`} role="dialog" aria-labelledby="daysum-title">
        <header className="daysum__head">
          <h2 id="daysum-title">{t("sum.title", { day: summary.day })}</h2>
          <div className="daysum__stars" aria-hidden="true">
            {[1, 2, 3].map((n) => (
              <Star key={n} on={n <= STARS[verdict]} />
            ))}
          </div>
          <p className="daysum__verdict">{t(`sum.verdict.${verdict}`)}</p>
        </header>

        <p className="daysum__done">
          <span className="daysum__check" aria-hidden="true">✓</span>
          <span>{t("sum.done.title")}:</span>
          <strong>{doneCount}</strong>
        </p>

        {changed.length > 0 && (
          <ul className="daysum__res">
            {changed.map((key) => {
              const n = summary.deltas[key];
              const up = n > 0;
              return (
                <li key={key} className={up ? "is-up" : "is-down"} aria-label={`${t(`res.${key}`)}: ${n}`}>
                  <ResourceIcon type={key} size={40} />
                  <strong>{up ? "▲" : "▼"} {Math.abs(n)}</strong>
                  <span>{t(`res.${key}`)}</span>
                </li>
              );
            })}
          </ul>
        )}

        {problems.length > 0 && <p className="daysum__problems">⚠ {problems.join(", ")}</p>}

        {summary.tasksMissed.length > 0 && (
          <section className="daysum__missed" aria-label={t("sum.missed.title")}>
            <p className="daysum__missed-title">✕ {t("sum.missed.title")}:</p>
            <ul>
              {summary.tasksMissed.map((id) => (
                <li key={id}>{t(`task.${id}`)}</li>
              ))}
            </ul>
          </section>
        )}

        {summary.left.length > 0 && (
          <section className="daysum__left" aria-label={t("sum.left.title", { n: summary.left.length })}>
            <h3>{t("sum.left.title", { n: summary.left.length })}</h3>
            <ul>
              {left.map(({ task, late }) => (
                <li key={task.id} className={late ? "is-late" : ""}>
                  <i aria-hidden="true" />
                  {t(`task.${task.id}`)}
                </li>
              ))}
              {more > 0 && <li className="daysum__more">+{more}</li>}
            </ul>
          </section>
        )}

        <button className="btn btn--primary daysum__go" autoFocus onClick={onClose}>{t("sum.continue")}</button>
      </div>
    </div>
  );
}
