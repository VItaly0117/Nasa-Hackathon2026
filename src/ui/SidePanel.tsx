import type { GameState } from "../types";
import { MISSION_DAYS, NIGHT_START } from "../engine/engine";
import { nextScheduledEvent } from "../engine/events";
import { taskList } from "../engine/tasks";

type Alert = { title: string; text: string; kind: "flare" | "night" | "warn" };

const EVENT_ALERTS: Record<string, (inDays: number) => Alert> = {
  flare: (n) => ({
    kind: "flare",
    title: "Солнечная вспышка!",
    text: `Через ${n} дн. ожидается повышенный уровень радиации. Убежище защитит экипаж.`,
  }),
  breakdown: (n) => ({
    kind: "warn",
    title: "Износ фильтров",
    text: `Через ${n} дн. система жизнеобеспечения может сломаться. Держи запас воды и энергии на ремонт.`,
  }),
};

// Самое важное, о чём игрок должен узнать заранее
function pickAlert(state: GameState): Alert | null {
  const pending = state.pending[0];
  if (pending) {
    return { kind: "warn", title: "Последствия", text: `Через ${pending.inDays} дн.: ${pending.reason}` };
  }

  const event = nextScheduledEvent(state.day);
  if (event && event.inDays <= 3) return EVENT_ALERTS[event.id]?.(event.inDays) ?? null;

  const toNight = NIGHT_START - state.day;
  if (state.isNight) {
    return { kind: "night", title: "Лунная ночь", text: "Солнечные панели не дают энергии. База живёт на батареях и запасах." };
  }
  if (toNight > 0 && toNight <= 3) {
    return { kind: "night", title: "Скоро ночь", text: `Через ${toNight} дн. солнце сядет на 14 суток. Панели перестанут работать.` };
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

// Три ближайшие невыполненные задачи: больше сразу ребёнку не нужно
function Tasks({ state }: { state: GameState }) {
  const tasks = taskList(state);
  const open = tasks.filter((t) => !t.isDone);
  const doneCount = tasks.length - open.length;

  return (
    <section className="hud-panel tasks">
      <h2 className="hud-title">Задачи · {doneCount} / {tasks.length}</h2>
      <ul>
        {open.slice(0, 3).map((t) => (
          <li key={t.id} className={`task ${t.late ? "task--late" : ""}`}>
            <span className="task__mark" aria-hidden="true">{t.late ? "!" : "○"}</span>
            <span>
              <strong>{t.text}{t.deadline ? ` до дня ${t.deadline}` : ""}</strong>
              <span className="task__why">{t.why}</span>
            </span>
          </li>
        ))}
        {open.length === 0 && <li className="task">Все задачи выполнены. Продержись до конца миссии!</li>}
      </ul>
    </section>
  );
}

export function SidePanel({ state }: { state: GameState }) {
  const alert = pickAlert(state);
  const progress = Math.round((state.day / MISSION_DAYS) * 100);

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
        <h2 className="hud-title">
          <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
            <path d="M10 1 L12.6 7 L19 7.6 L14 11.8 L15.6 18.2 L10 14.8 L4.4 18.2 L6 11.8 L1 7.6 L7.4 7 Z" fill="#f5b83d" />
          </svg>
          Текущая цель
        </h2>
        <p>Продержаться {MISSION_DAYS} дней и сохранить экипаж</p>
        <div className="goal__row">
          <div className="goal__bar"><div style={{ width: `${progress}%` }} /></div>
          <span>{state.day} / {MISSION_DAYS}</span>
        </div>
      </section>

      <Tasks state={state} />

      <section className="hud-panel journal">
        <h2 className="hud-title">Журнал</h2>
        <ul>
          {state.log.slice(-4).reverse().map((entry, i) => (
            <li key={i}>
              <span className="muted">День {entry.day}</span> {entry.text}
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
}
