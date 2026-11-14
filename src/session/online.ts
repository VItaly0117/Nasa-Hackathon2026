import { initialState, reduce } from "@/engine";
import { openStream, sendAction } from "@/net/online";
import type { Session as RoomSession } from "@/net/online";
import { createStore, createValueStore } from "./store";
import type { GameSession, SessionMeta } from "./types";

// Время дня ведущий отправляет на сервер пачками, а не 10 раз в секунду
const ONLINE_TICK_MS = 500;

// Совместная игра: та же игра получается из seed комнаты и всех действий, что уже случились до входа.
// Действие уходит на сервер и применяется, когда сервер разошлёт его всем: так у всех игроков один порядок действий
export function createOnlineSession(room: RoomSession): GameSession {
  const store = createStore(room.actions.reduce(reduce, initialState(room.seed)), reduce);
  const meta = createValueStore<SessionMeta>({ connected: true, players: room.players, hostId: room.hostId, record: null });
  let tickAcc = 0;
  // Сколько действий уже применено: повторный start() (StrictMode) продолжает с этого места, а не с начала
  let applied = room.actions.length;

  return {
    store,
    meta,
    online: { room: room.room, role: room.role, playerId: room.playerId },
    send: (action) => void sendAction(room, action),
    tick(ms) {
      tickAcc += ms;
      if (tickAcc < ONLINE_TICK_MS) return;
      void sendAction(room, { type: "tick", ms: tickAcc });
      tickAcc = 0;
    },
    canTick: () => meta.get().hostId === room.playerId && meta.get().connected,
    save: () => {},
    start: () =>
      openStream(room, applied, {
        onAction: (action) => {
          applied += 1;
          store.dispatch(action);
        },
        onPlayers: (players, hostId) => meta.set((m) => ({ ...m, players, hostId })),
        onConnection: (connected) => meta.set((m) => ({ ...m, connected })),
      }),
  };
}
