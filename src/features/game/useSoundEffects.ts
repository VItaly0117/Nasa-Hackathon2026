import { useEffect } from "react";
import { NIGHT_START } from "@/engine";
import type { GameState } from "@/types";
import { sound } from "@/audio/audio";
import { useSession } from "@/session/hooks";

const freshTaskIds = (s: GameState) => s.tasks.filter((x) => x.issuedDay === s.day && x.status === "open").map((x) => x.id);
const buildingCount = (s: GameState) => s.modules.filter((m) => m.build).length;

// Звуки игры. Подписка на хранилище, а не React-состояние: звук не должен перерисовывать экран
export function useSoundEffects() {
  const { store } = useSession();

  useEffect(() => {
    let prev = store.getState();
    let prevEvent: string | null = null;
    let prevFresh: string[] = [];

    // Звуки при входе в игру (продолжение сохранения с днём больше первого, событие, ночь)
    const announceDay = (s: GameState) => {
      if (s.day === 1) return;
      if (s.day === NIGHT_START) sound.playNightfall();
      else sound.playDayChange();
    };
    const announceTasks = (s: GameState) => {
      const fresh = freshTaskIds(s);
      if (fresh.length > 0 && fresh.some((id) => !prevFresh.includes(id))) sound.playTaskToast();
      prevFresh = fresh;
    };
    const announceEvent = (s: GameState) => {
      if (s.activeEvent && s.activeEvent !== prevEvent) sound.playAlarm(s.activeEvent as "flare" | "breakdown" | "illness");
      prevEvent = s.activeEvent;
    };

    announceDay(prev);
    announceTasks(prev);
    announceEvent(prev);

    const unsubscribe = store.subscribe(() => {
      const s = store.getState();
      if (s === prev) return;
      if (s.day !== prev.day) announceDay(s);
      if (s.tasks !== prev.tasks || s.day !== prev.day) announceTasks(s);
      if (buildingCount(prev) > buildingCount(s)) sound.playBuildComplete();
      announceEvent(s);
      if (prev.status === "playing" && s.status !== "playing") {
        if (s.status === "won") sound.playVictory();
        else if (s.status === "lost") sound.playDefeat();
      }
      prev = s;
    });

    return () => {
      unsubscribe();
    };
  }, [store]);
}
