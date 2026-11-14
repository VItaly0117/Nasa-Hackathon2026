import type { Action, Role } from "@/types";

// Связь с сервером совместной игры (server/index.mjs).
// В разработке Vite перенаправляет /api на сервер (vite.config.ts). Если сервер живёт по другому адресу,
// его можно задать при сборке: VITE_SERVER_URL=https://... npm run build
const BASE = `${import.meta.env.VITE_SERVER_URL ?? ""}/api/rooms`;

export const ROOM_NAME = /^[A-Za-z]{1,20}$/;

export type Player = { id: string; role: Role };

export type Session = {
  room: string;
  playerId: string;
  role: Role;
  seed: number;
  actions: Action[]; // всё, что уже случилось в комнате до входа: по ним восстанавливаем игру
  players: Player[];
  hostId: string | null;
};

export async function joinRoom(name: string): Promise<Session> {
  const room = name.toUpperCase();
  const res = await fetch(`${BASE}/${room}/join`, { method: "POST" });
  if (!res.ok) throw new Error(`join ${res.status}`);
  const data = await res.json();
  return { room, ...data };
}

export function sendAction(session: Session, action: Action) {
  // Действие применится, когда сервер разошлёт его всем, вместе со своим: так порядок у всех одинаковый
  return fetch(`${BASE}/${session.room}/actions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ player: session.playerId, action }),
  }).catch(() => {
    // потеря одного действия не страшна: состояние по-прежнему одно на всех, просто клик не сработал
  });
}

type Handlers = {
  onAction: (action: Action) => void;
  onPlayers: (players: Player[], hostId: string | null) => void;
  onConnection: (ok: boolean) => void;
};

// Поток событий комнаты. from: сколько действий уже применено, сервер пришлёт всё, что после них.
// Сам EventSource переподключается со старым адресом, и сервер прислал бы уже применённые действия ещё раз.
// Поэтому при обрыве закрываем поток и через пару секунд открываем новый с актуальным номером
export function openStream(session: Session, from: number, handlers: Handlers): () => void {
  let applied = from;
  let source: EventSource | null = null;
  let retry = 0;
  let stopped = false;

  const connect = () => {
    source = new EventSource(`${BASE}/${session.room}/events?player=${session.playerId}&from=${applied}`);
    source.onopen = () => handlers.onConnection(true);
    source.onerror = () => {
      source?.close();
      handlers.onConnection(false);
      if (!stopped) retry = window.setTimeout(connect, 2000);
    };
    source.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === "action") {
        applied += 1;
        handlers.onAction(msg.action as Action);
      } else if (msg.type === "players") {
        handlers.onPlayers(msg.players, msg.hostId);
      }
    };
  };
  connect();

  return () => {
    stopped = true;
    window.clearTimeout(retry);
    source?.close();
  };
}
