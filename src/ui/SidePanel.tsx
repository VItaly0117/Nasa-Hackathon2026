import type { GameState } from "../types";
import { MISSION_DAYS, nextScheduledEvent, NIGHT_START } from "../engine";
import { days, t } from "../i18n";
import { formatMsg } from "../i18n/messages";
import { CollapseButton, startsCollapsed, useCollapsed } from "./Collapse";

// Что панели нужно от игры (не всё состояние, чтобы она не перерисовывалась на каждый tick)
export type SideState = Pick<GameState, "day" | "isNight" | "pending" | "tasks" | "research" | "log">;

type Alert = { title: string; text: string; kind: "flare" | "night" | "warn" };

const EVENT_ALERTS: Record<string, (inDays: number) => Alert> = {
  flare: (n) => ({
    kind: "flare",
    title: t("alert.flare.title"),
    text: t("alert.flare.text", { days: days(n) }),
  }),
  breakdown: (n) => ({
    kind: "warn",
    title: t("alert.breakdown.title"),
    text: t("alert.breakdown.text", { days: days(n) }),
  }),
};

// Самое важное, о чём игрок должен узнать заранее
function pickAlert(state: SideState): Alert | null {
  const pending = state.pending[0];
  if (pending) {
    return {
      kind: "warn",
      title: t("alert.pending.title"),
      text: t("alert.pending.text", { days: days(pending.inDays), reason: formatMsg(pending.reason) }),
    };
  }

  const event = nextScheduledEvent(state.day);
  if (event && event.inDays <= 3) return EVENT_ALERTS[event.id]?.(event.inDays) ?? null;

  const toNight = NIGHT_START - state.day;
  if (state.isNight) {
    return { kind: "night", title: t("alert.night.title"), text: t("alert.night.text") };
  }
  if (toNight > 0 && toNight <= 3) {
    return { kind: "night", title: t("alert.soon.title"), text: t("alert.soon.text", { days: days(toNight) }) };
  }
  return null;
}

function AlertIcon({ kind }: { kind: Alert["kind"] }) {
  if (kind === "flare") {
    return (
      <svg viewBox="0 0 48 48" width="48" height="48" aria-hidden="true">
        <circle cx="24" cy="24" r="22" fill="#ff8a3d" opacity="0.25" />
        <circle cx="24" cy="24" r="12" fill="#ffb347" />
        <circle cx="24" cy="24" r="8" fill="#ffd98a" />
      </svg>
    );
  }
  if (kind === "night") {
    return (
      <svg viewBox="0 0 48 48" width="48" height="48" aria-hidden="true">
        <circle cx="24" cy="24" r="22" fill="#5b6bd6" opacity="0.25" />
        <path d="M30 10 A 14 14 0 1 0 38 30 A 11 11 0 1 1 30 10 Z" fill="#c9d3ff" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 48 48" width="48" height="48" aria-hidden="true">
      <path d="M24 6 L 44 40 H 4 Z" fill="#f5b83d" />
      <path d="M24 18 v 11 M24 34 v 1" stroke="#3b2a00" strokeWidth="4" strokeLinecap="round" />
    </svg>
  );
}

export function SidePanel({ state, onResearch, surveyingIce, onStartIceSurvey, onCancelIceSurvey }: {
  state: SideState;
  onResearch: (answer: "shield" | "brush") => void;
  surveyingIce: boolean;
  onStartIceSurvey: () => void;
  onCancelIceSurvey: () => void;
}) {
  const alert = pickAlert(state);
  const progress = Math.round((state.day / MISSION_DAYS) * 100);
  const [goalClosed, toggleGoal] = useCollapsed(startsCollapsed());
  const [tasksClosed, toggleTasks] = useCollapsed(startsCollapsed());
  const [journalClosed, toggleJournal] = useCollapsed(startsCollapsed());
  // Открытые задания экипажа: самые срочные сверху
  const openTasks = state.tasks.filter((task) => task.status === "open").sort((a, b) => a.deadline - b.deadline);
  const doneCount = state.tasks.filter((task) => task.status === "done").length;

  return (
    <aside className="side">
      {alert && (
        <section className={`hud-panel alert alert--${alert.kind}`} role="status">
          <div className="alert__text">
            <h2 className="hud-title">{alert.title}</h2>
            <p>{alert.text}</p>
          </div>
          <AlertIcon kind={alert.kind} />
        </section>
      )}

      <section className="hud-panel goal">
        <div className="panel-head">
          <h2 className="hud-title">
            <svg viewBox="0 0 20 20" width="22" height="22" aria-hidden="true">
              <path d="M10 1 L12.6 7 L19 7.6 L14 11.8 L15.6 18.2 L10 14.8 L4.4 18.2 L6 11.8 L1 7.6 L7.4 7 Z" fill="#f5b83d" />
            </svg>
            {t("goal.title")}
          </h2>
          <CollapseButton collapsed={goalClosed} onClick={toggleGoal} />
        </div>
        {!goalClosed && (
          <>
            <p>{t("goal.text", { days: days(MISSION_DAYS) })}</p>
            <div className="goal__row">
              <div className="goal__bar"><div style={{ width: `${progress}%` }} /></div>
              <span>{state.day} / {MISSION_DAYS}</span>
            </div>
          </>
        )}
      </section>

      <section className="hud-panel research-card" aria-labelledby="research-title">
        <div className="panel-head">
          <h2 className="hud-title" id="research-title">{t("research.title")}</h2>
          {state.research?.includes("moonDust") && <span aria-label={t("research.completed")}>✓</span>}
        </div>
        {state.research?.includes("moonDust") ? (
          <p>{state.research.includes("moonDust:shield")
            ? t("research.moonDust.resultShield")
            : state.research.includes("moonDust:brush")
              ? t("research.moonDust.resultBrush")
              : t("research.completedText")}</p>
        ) : (
          <>
            <p><strong>{t("research.moonDust.title")}</strong></p>
            <p>{t("research.moonDust.evidence")}</p>
            <p className="muted">{t("research.moonDust.question")}</p>
            <div className="research-card__choices">
              <button className="btn btn--choice" onClick={() => onResearch("shield")}>
                {t("research.moonDust.shield")}
              </button>
              <button className="btn btn--choice" onClick={() => onResearch("brush")}>
                {t("research.moonDust.brush")}
              </button>
            </div>
            <small className="muted"><a href="https://www.nasa.gov/learning-resources/for-kids-and-students/nasa-knows-what-is-lunar-regolith-grades-5-8/" target="_blank" rel="noreferrer">{t("research.source")}</a></small>
          </>
        )}
        <hr />
        {state.research?.includes("iceScout") ? (
          <div>
            <p><strong>{t("research.iceScout.title")}</strong></p>
            <p>{state.research.includes("iceScout:ice")
              ? t("research.iceScout.resultIce")
              : state.research.includes("iceScout:rock")
                ? t("research.iceScout.resultRock")
                : t("research.iceScout.completed")}</p>
          </div>
        ) : (
          <div>
            <p><strong>{t("research.iceScout.title")}</strong></p>
            <p>{t("research.iceScout.evidence")}</p>
            {surveyingIce ? (
              <div className="research-card__choices">
                <p className="muted">{t("research.iceScout.pick")}</p>
                <button className="btn btn--ghost" onClick={onCancelIceSurvey}>{t("research.iceScout.cancel")}</button>
              </div>
            ) : (
              <button className="btn btn--choice" onClick={onStartIceSurvey}>{t("research.iceScout.start")}</button>
            )}
            <small className="muted"><a href="https://science.nasa.gov/mission/viper/" target="_blank" rel="noreferrer">{t("research.iceScout.source")}</a></small>
          </div>
        )}
      </section>

      {/* Список завдань */}
      <section className="hud-panel tasks">
        <div className="panel-head">
          <h2 className="hud-title">
            {t("tasks.title", { done: doneCount, total: state.tasks.length })}
          </h2>
          <CollapseButton collapsed={tasksClosed} onClick={toggleTasks} />
        </div>
        {!tasksClosed && (
          <ul className="tasks__list">
            {openTasks.map((task) => (
              <li key={task.id} className={`task ${state.day >= task.deadline ? "task--late" : ""}`}>
                <span className="task__mark" aria-hidden="true">{state.day >= task.deadline ? "!" : "○"}</span>
                <span>
                  <strong>
                    {t(`task.${task.id}`)} {t("tasks.until", { n: task.deadline })}
                  </strong>
                  <span className="task__why">{t(`crew.n${task.giver}`)}: {t(`task.${task.id}.why`)}</span>
                </span>
              </li>
            ))}
            {openTasks.length === 0 && <li className="task">{t("tasks.allDone")}</li>}
          </ul>
        )}
      </section>

      <section className="hud-panel journal">
        <div className="panel-head">
          <h2 className="hud-title">{t("journal.title")}</h2>
          <CollapseButton collapsed={journalClosed} onClick={toggleJournal} />
        </div>
        {!journalClosed && (
          <ul>
            {state.log.slice(-4).reverse().map((entry, i) => (
              <li key={i}>
                <span className="muted">{t("journal.day", { n: entry.day })}</span> {formatMsg(entry)}
              </li>
            ))}
          </ul>
        )}
      </section>
    </aside>
  );
}
