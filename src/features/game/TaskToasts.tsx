import { useEffect, useMemo, useState } from "react";
import { useGame } from "@/session/hooks";
import { TaskToast } from "./TaskToast";

// Новые задания от экипажа: карточка с портретом на несколько секунд. Показываем задания сегодняшнего дня, которые ещё открыты
// и которые игрок или время не скрыли
export function TaskToasts() {
  const tasks = useGame((s) => s.tasks);
  const day = useGame((s) => s.day);
  const [closed, setClosed] = useState<string[]>([]);

  const fresh = useMemo(() => tasks.filter((x) => x.issuedDay === day && x.status === "open"), [tasks, day]);

  // Ключ по id, а не по массиву: иначе таймер сбрасывается при любом обновлении состояния игры
  const idsKey = fresh.map((x) => x.id).join("|");
  useEffect(() => {
    if (!idsKey) return;
    const ids = idsKey.split("|");
    const timer = window.setTimeout(() => setClosed((prev) => [...prev, ...ids]), 8000);
    return () => window.clearTimeout(timer);
  }, [idsKey]);

  return <TaskToast tasks={fresh.filter((x) => !closed.includes(x.id))} onClose={() => setClosed((prev) => [...prev, ...fresh.map((x) => x.id)])} />;
}
