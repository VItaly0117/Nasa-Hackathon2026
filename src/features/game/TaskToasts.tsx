import { useEffect, useMemo, useRef, useState } from "react";
import { useGame } from "@/session/hooks";
import { TaskToast } from "./TaskToast";

// Уже показанные карточки живут дольше экрана игры: после выхода в меню и возврата они не появляются снова
const shown = new Set<string>();

// Новые задания от экипажа: карточка с портретом на несколько секунд. Показываем задания сегодняшнего дня, которые ещё открыты
// и которые игрок или время не скрыли
export function TaskToasts() {
  const tasks = useGame((s) => s.tasks);
  const day = useGame((s) => s.day);
  const seed = useGame((s) => s.seed);
  const [closed, setClosed] = useState<string[]>([]);
  // что уже было показано до открытия этого экрана
  const before = useRef<Set<string>>(new Set(shown));

  const key = (id: string) => `${seed}:${id}`;
  const fresh = useMemo(
    () => tasks.filter((x) => x.issuedDay === day && x.status === "open" && !before.current.has(key(x.id))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [tasks, day, seed],
  );

  useEffect(() => {
    fresh.forEach((x) => shown.add(key(x.id)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fresh]);

  // Каждая карточка сама закрывается по окончании анимации полосы времени
  return <TaskToast tasks={fresh.filter((x) => !closed.includes(x.id))} onClose={(id) => setClosed((prev) => (prev.includes(id) ? prev : [...prev, id]))} />;
}
