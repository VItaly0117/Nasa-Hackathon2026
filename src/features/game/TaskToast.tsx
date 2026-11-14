import type { Task } from "@/types";
import { t, tDynamic } from "@/i18n";
import { Avatar } from "./CrewPanel";
import { CREW } from "@/ui/crewData";
import { sound } from "@/audio/audio";
import "./TaskToast.css";

type Props = { tasks: Task[]; onClose: () => void };

// Член экипажа сам просит о чём-то: портрет, имя, что сделать и зачем. Игру не останавливает
export function TaskToast({ tasks, onClose }: Props) {
  if (tasks.length === 0) return null;
  return (
    <div className="task-toasts" role="status" aria-live="polite">
      {tasks.map((task) => {
        const person = CREW.find((c) => c.id === task.giver)!;
        return (
          <section key={task.id} className="hud-panel task-toast">
            <Avatar skin={person.skin} hair={person.hair} long={person.long} mood={1} />
            <div className="task-toast__body">
              <span className="task-toast__who">
                {tDynamic(`crew.n${person.id}`)} · {tDynamic(`crew.r${person.id}`)}
              </span>
              <strong>{tDynamic(`task.${task.id}`)}</strong>
              <span className="task-toast__why">{tDynamic(`task.${task.id}.why`)}</span>
              <span className="task-toast__until">{t("tasks.until", { n: task.deadline })}</span>
            </div>
            <button className="task-toast__close" onClick={() => { sound.playClick(); onClose(); }} aria-label={t("task.close")}>
              ×
            </button>
          </section>
        );
      })}
    </div>
  );
}
