import { useEffect, useState } from "react";
import { useGame } from "../../session/react";
import { TaskToast } from "../../ui/TaskToast";

// Новые задания от экипажа: карточка с портретом на несколько секунд
export function TaskToasts() {
  const tasks = useGame((s) => s.tasks);
  const day = useGame((s) => s.day);
  const [ids, setIds] = useState<string[]>([]);

  useEffect(() => {
    const fresh = tasks.filter((x) => x.issuedDay === day && x.status === "open").map((x) => x.id);
    setIds(fresh);
    if (fresh.length === 0) return;
    const timer = window.setTimeout(() => setIds([]), 9000);
    return () => window.clearTimeout(timer);
  }, [tasks, day]);

  return <TaskToast tasks={tasks.filter((x) => ids.includes(x.id))} onClose={() => setIds([])} />;
}
