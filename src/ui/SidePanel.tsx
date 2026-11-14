import type { GameState } from "../types";
import { MISSION_DAYS, NIGHT_START } from "../engine/engine";
import { nextScheduledEvent } from "../engine/events";
import { days, t } from "../i18n";
import { CollapseButton, startsCollapsed, useCollapsed } from "./Collapse";

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
function pickAlert(state: GameState): Alert | null {
  const pending = state.pending[0];
  if (pending) {
    return {
      kind: "warn",
      title: t("alert.pending.title"),
      text: t("alert.pending.text", { days: days(pending.inDays), reason: pending.reason }),
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

export function SidePanel({ state }: { state: GameState }) {
  const alert = pickAlert(state);
  const progress = Math.round((state.day / MISSION_DAYS) * 100);
  const [goalClosed, toggleGoal] = useCollapsed(startsCollapsed());
  const [tasksClosed, toggleTasks] = useCollapsed(startsCollapsed());
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
    </aside>
  );
}
