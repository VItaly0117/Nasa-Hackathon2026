import type { Task } from "@/types";
import { t, tDynamic } from "@/i18n";
import { Avatar } from "./CrewPanel";
import { CREW } from "@/ui/crewData";
import { sound } from "@/audio/audio";
import "./TaskToast.css";

type Props = { tasks: Task[]; onClose: (id: string) => void };

export const TOAST_MS = 8000;

// Член экипажа сам просит о чём-то: портрет, имя, что сделать и зачем. Игру не останавливает
export function TaskToast({ tasks, onClose }: Props) {
  if (tasks.length === 0) return null;
  return (
    <div className="task-toasts" role="status" aria-live="polite">
      {tasks.map((task) => {
        const person = CREW.find((c) => c.id === task.giver)!;
        return (
          <section key={task.id} className="hud-panel task-toast">
            <Avatar id={person.id} mood={1} />
            <div className="task-toast__body">
              <span className="task-toast__who">
                {tDynamic(`crew.n${person.id}`)} · {tDynamic(`crew.r${person.id}`)}
              </span>
              <strong>{tDynamic(`task.${task.id}`)}</strong>
              <span className="task-toast__why">{tDynamic(`task.${task.id}.why`)}</span>
              <span className="task-toast__until">{t("tasks.until", { n: task.deadline })}</span>
            </div>
            <button className="task-toast__close" onClick={() => { sound.playClick(); onClose(task.id); }} aria-label={t("task.close")}>
              ×
            </button>
            <span className="task-toast__timer" aria-hidden="true">
              <span
                className="task-toast__timer-bar"
                style={{ animationDuration: `${TOAST_MS}ms` }}
                onAnimationEnd={() => onClose(task.id)}
              />
            </span>
          </section>
        );
      })}
    </div>
  );
}
