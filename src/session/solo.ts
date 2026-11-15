import { initialState, reduce } from "@/engine";
import type { GameMode, GameState } from "@/types";
import { clearSave, loadRecords, recordFrom, saveGame, saveRecord } from "./storage";
import { createStore, createValueStore } from "./store";
import type { GameSession, SessionMeta } from "./types";

// Одиночную игру сохраняем не чаще, чем раз в столько мс: время идёт непрерывно
const SAVE_EVERY_MS = 2000;

// Одиночная игра: новая или продолженная из сохранения. Сохраняет ход игры и записывает рекорд в конце
export function createSoloSession(resume: GameState | null, difficulty: GameMode = "normal"): GameSession {
  const store = createStore(resume ?? initialState(undefined, difficulty), reduce);
  const meta = createValueStore<SessionMeta>({ connected: true, players: [], hostId: null, record: null });

  const save = () => {
    const state = store.getState();
    if (state.status === "playing") saveGame(state);
  };

  return {
    store,
    meta,
    online: null,
    send: store.dispatch,
    tick: (ms) => store.dispatch({ type: "tick", ms }),
    canTick: () => true,
    save,
    start() {
      let lastSave = 0;
      let recorded = meta.get().record !== null;

      const unsubscribe = store.subscribe(() => {
        const state = store.getState();
        if (state.status !== "playing") {
          clearSave();
          // миссия закончилась: записываем результат один раз и запоминаем, лучший ли он
          if (!recorded) {
            recorded = true;
            const mine = recordFrom(state);
            const hadBefore = loadRecords().length > 0;
            const better = saveRecord(mine);
            meta.set((m) => ({ ...m, record: { best: loadRecords()[0] ?? mine, isNew: better && hadBefore } }));
          }
          return;
        }
        const now = Date.now();
        if (now - lastSave >= SAVE_EVERY_MS) {
          saveGame(state);
          lastSave = now;
        }
      });

      // «Продолжить игру» в меню начнёт с последнего места: сохраняем и при закрытии вкладки, и при выходе в меню
      window.addEventListener("beforeunload", save);

      return () => {
        save();
        unsubscribe();
        window.removeEventListener("beforeunload", save);
      };
    },
  };
}
