import { useGame, useMeta, useSession } from "@/session/hooks";
import { useGameUi } from "./ui-state";

// Время дня идёт, только пока игрок ничем не занят: ни события, ни правил, ни выбора места, ни итогов дня.
// В совместной игре время общее: его двигает только ведущий и останавливает только событие
export function useClockRunning(): boolean {
  const session = useSession();
  const ui = useGameUi();
  const playing = useGame((s) => s.status === "playing");
  const noEvent = useGame((s) => s.activeEvent === null);
  const canTick = useMeta((m) => (session.online ? m.hostId === session.online.playerId && m.connected : true));
  return session.online ? canTick && playing && noEvent : playing && noEvent && !ui.summary && !ui.rulesOpen && ui.buildType === null;
}
