import { useMemo, useState } from "react";
import { useGame } from "@/session/hooks";
import { TaskToast } from "./TaskToast";

// Новые задания от экипажа: карточка с портретом на несколько секунд. Показываем задания сегодняшнего дня, которые ещё открыты
// и которые игрок или время не скрыли
export function TaskToasts() {
  const tasks = useGame((s) => s.tasks);
  const day = useGame((s) => s.day);
  const [closed, setClosed] = useState<string[]>([]);

  const fresh = useMemo(() => tasks.filter((x) => x.issuedDay === day && x.status === "open"), [tasks, day]);

  // Каждая карточка сама закрывается по окончании анимации полосы времени
  return <TaskToast tasks={fresh.filter((x) => !closed.includes(x.id))} onClose={(id) => setClosed((prev) => (prev.includes(id) ? prev : [...prev, id]))} />;
}
