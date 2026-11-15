import type { GameState } from "@/types";
import { MISSION_DAYS, nextScheduledEvent, NIGHT_START } from "@/engine";
import { days, t, tDynamic } from "@/i18n";
import { formatMsg } from "@/i18n/messages";
import { CollapseButton } from "@/ui/Collapse";
import { useScrollMore } from "@/ui/useScrollMore";
import { startsCollapsed, useCollapsed } from "@/ui/useCollapsed";

// Что панели нужно от игры (не всё состояние, чтобы она не перерисовывалась на каждый tick)
export type SideState = Pick<GameState, "day" | "isNight" | "pending" | "tasks" | "research" | "log"> & { hasBattery: boolean };

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

export function SidePanel({ state }: {
  state: SideState;
  onResearch: (answer: "shield" | "brush") => void;
  surveyingIce: boolean;
  onStartIceSurvey: () => void;
  onCancelIceSurvey: () => void;
}) {
  const alert = pickAlert(state);
  const progress = Math.round((state.day / MISSION_DAYS) * 100);
  const scrollRef = useScrollMore<HTMLElement>();
  const [goalClosed, toggleGoal] = useCollapsed(startsCollapsed());
  // Открытые задания экипажа: самые срочные сверху
  const openTasks = state.tasks.filter((task) => task.status === "open").sort((a, b) => a.deadline - b.deadline);
  const nextTasks = openTasks.slice(0, 2);
  const doneCount = state.tasks.filter((task) => task.status === "done").length;

  return (
    <aside ref={scrollRef} className="side scroll-more">
      {alert && (
        <section className={`hud-panel alert alert--${alert.kind}`} role="status">
          <div className="alert__text">
            <h2 className="hud-title">{alert.title}</h2>
            <p>{alert.text}</p>
          </div>
          <AlertIcon kind={alert.kind} />
        </section>
      )}

      {/* Одна карточка: цель + 1–2 ближайших шага */}
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
            <h3 className="hud-title">
              {t("goal.next")} · {doneCount} / {state.tasks.length}
            </h3>
            <ul className="tasks__list">
              {nextTasks.map((task) => (
                <li key={task.id} className={`task ${state.day >= task.deadline ? "task--late" : ""}`}>
                  <span className="task__mark" aria-hidden="true">{state.day >= task.deadline ? "!" : "○"}</span>
                  <span>
                    <strong>
                      {tDynamic(`task.${task.id}`)} {t("tasks.until", { n: task.deadline })}
                    </strong>
                    <span className="task__why">{tDynamic(`crew.n${task.giver}`)}: {tDynamic(`task.${task.id}.why`)}</span>
                  </span>
                </li>
              ))}
              {nextTasks.length === 0 && (
                <li className="task">
                  <span className="task__mark" aria-hidden="true">💡</span>
                  <span>{state.hasBattery ? t("goal.hint.none") : t("goal.hint.energy")}</span>
                </li>
              )}
            </ul>
          </>
        )}
      </section>
    </aside>
  );
}
