import { useEffect } from "react";
import { allTasksDone } from "@/engine";
import { t } from "@/i18n";
import { useGame, useSession } from "@/session/hooks";
import { useClockRunning } from "./useClockRunning";

// Пауза между «все задания выполнены» и досрочным концом дня
const WRAP_UP_MS = 2500;

// Все задания дня выполнены, а время ещё осталось: через пару секунд день завершается сам.
// Только в одиночной игре: в совместной действие nextDay сервер не принимает (его двигает tick ведущего)
export function WrapUp() {
  const session = useSession();
  const running = useClockRunning();
  const day = useGame((s) => s.day);
  const done = useGame(allTasksDone);
  const wrapUp = !session.online && running && done;

  useEffect(() => {
    if (!wrapUp) return;
    const timer = window.setTimeout(() => session.send({ type: "nextDay" }), WRAP_UP_MS);
    return () => window.clearTimeout(timer);
  }, [wrapUp, day, session]);

  return wrapUp ? (
    <div className="wrapup" role="status" aria-live="polite">
      {t("app.allDone")}
    </div>
  ) : null;
}
