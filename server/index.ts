// Сервер совместной игры. Только встроенный Node, без библиотек: npm run server
//
// Как устроено: движок игры детерминирован (всё случайное идёт от seed), поэтому сервер не считает игру сам.
// Он хранит для каждой комнаты seed и общий список действий по порядку и рассылает каждое новое действие всем.
// Каждый браузер применяет те же действия в том же порядке и получает ту же самую игру.
// Время дня (действие tick) присылает только ведущий игрок, иначе у каждого время шло бы по-своему.
//
//   POST /api/rooms/:name/join                         → { playerId, role, seed, actions, players, hostId }
//   GET  /api/rooms/:name/events?player=ID&from=N      → поток событий (Server-Sent Events): действия с номера N и состав игроков
//   POST /api/rooms/:name/actions  { player, action }  → добавить действие в общий список
//
// Комнаты живут в памяти: после перезапуска сервера игры начинаются заново.

import { randomBytes, randomInt } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import {
  ACTION_TYPES,
  ROLES,
  ROOM_NAME,
  type ActionBroadcast,
  type ActionRequest,
  type ActionResponse,
  type ErrorResponse,
  type JoinResponse,
  type OnlineAction,
  type Player,
  type PlayersBroadcast,
  type Role,
  type RoomEvent,
} from "../shared/protocol.ts";

const PORT = Number(process.env.PORT) || 8787;
const EMPTY_ROOM_TTL_MS = 10 * 60 * 1000;
const JOIN_TIMEOUT_MS = 30 * 1000;
const STREAM_PING_INTERVAL_MS = 15_000;
const RECONNECT_GRACE_PERIOD_MS = 5_000;
const ROOM_CLEANUP_INTERVAL_MS = 60 * 1000;
const MAX_BODY_LENGTH = 10_000;
const LOCALHOST_URL = "http://localhost";

type EventStreamResponse = ServerResponse<IncomingMessage>;

type RoomPlayer = Player & {
  streams: Set<EventStreamResponse>;
};

type Room = {
  name: string;
  seed: number;
  actions: OnlineAction[];
  players: Map<string, RoomPlayer>;
  hostId: string | null;
  emptySince: number | null;
};

type JsonResponse = JoinResponse | ActionResponse | ErrorResponse | { ok: true };
type ParsedActionRequest = Partial<ActionRequest>;

const rooms = new Map<string, Room>();

function getRoom(name: string): Room {
  const key = name.toUpperCase();
  let room = rooms.get(key);

  if (!room) {
    room = {
      name: key,
      seed: randomInt(2 ** 32),
      actions: [],
      players: new Map(),
      hostId: null,
      emptySince: null,
    };
    rooms.set(key, room);
  }

  return room;
}

// Случайная роль: сначала те, которых в комнате ещё нет, потом любые
function pickRole(room: Room): Role {
  const taken = new Set<Role>([...room.players.values()].map((player) => player.role));
  const free = ROLES.filter((role) => !taken.has(role));
  const pool = free.length ? free : ROLES;

  return pool[randomInt(pool.length)] as Role;
}

function playersOf(room: Room): Player[] {
  return [...room.players.values()].map(({ id, role }) => ({ id, role }));
}

function send(response: EventStreamResponse, payload: RoomEvent): void {
  response.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function broadcast(room: Room, payload: RoomEvent): void {
  for (const player of room.players.values()) {
    for (const response of player.streams) {
      send(response, payload);
    }
  }
}

function broadcastPlayers(room: Room): void {
  const payload: PlayersBroadcast = {
    type: "players",
    players: playersOf(room),
    hostId: room.hostId,
  };

  broadcast(room, payload);
}

function removePlayer(room: Room, playerId: string): void {
  if (!room.players.delete(playerId)) {
    return;
  }

  if (room.hostId === playerId) {
    room.hostId = room.players.keys().next().value ?? null;
  }

  if (room.players.size === 0) {
    room.emptySince = Date.now();
  }

  broadcastPlayers(room);
}

function json(response: ServerResponse, status: number, body: JsonResponse): void {
  response.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
  });
  response.end(JSON.stringify(body));
}

function readBody(request: IncomingMessage): Promise<unknown> {
  return new Promise((resolve) => {
    let raw = "";

    request.on("data", (chunk: Buffer) => {
      raw += chunk;
      if (raw.length > MAX_BODY_LENGTH) {
        request.destroy();
      }
    });

    request.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve(null);
      }
    });
  });
}

function isActionType(value: unknown): value is OnlineAction["type"] {
  return typeof value === "string" && ACTION_TYPES.includes(value as OnlineAction["type"]);
}

const server = createServer(async (request, response) => {
  const url = new URL(request.url ?? "/", LOCALHOST_URL);
  const match = url.pathname.match(/^\/api\/rooms\/([^/]+)\/(join|events|actions)$/);

  if (request.method === "OPTIONS") {
    response.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    return response.end();
  }

  if (!match) {
    return json(response, 404, { error: "not found" });
  }

  const [, rawName, what] = match;
  const name = decodeURIComponent(rawName);

  if (!ROOM_NAME.test(name)) {
    return json(response, 400, { error: "bad name" });
  }

  const room = getRoom(name);

  if (what === "join" && request.method === "POST") {
    const id = randomBytes(8).toString("hex");
    const player: RoomPlayer = {
      id,
      role: pickRole(room),
      streams: new Set(),
    };

    room.players.set(id, player);
    room.hostId ??= id;
    room.emptySince = null;

    // Если игрок так и не подключился к потоку, через полминуты освобождаем его место
    setTimeout(() => {
      if (room.players.get(id)?.streams.size === 0) {
        removePlayer(room, id);
      }
    }, JOIN_TIMEOUT_MS);

    broadcastPlayers(room);

    const body: JoinResponse = {
      playerId: id,
      role: player.role,
      seed: room.seed,
      actions: room.actions,
      players: playersOf(room),
      hostId: room.hostId,
    };

    return json(response, 200, body);
  }

  if (what === "events" && request.method === "GET") {
    const playerId = url.searchParams.get("player") ?? "";
    const player = room.players.get(playerId);

    if (!player) {
      return json(response, 403, { error: "join first" });
    }

    response.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });

    // Всё, что случилось после входа игрока, и только потом новое: так ни одно действие не теряется
    const from = Math.max(0, Number(url.searchParams.get("from")) || 0);

    for (const action of room.actions.slice(from)) {
      const payload: ActionBroadcast = { type: "action", action };
      send(response, payload);
    }

    send(response, {
      type: "players",
      players: playersOf(room),
      hostId: room.hostId,
    });

    player.streams.add(response);

    const ping = setInterval(() => {
      response.write(": ping\n\n");
    }, STREAM_PING_INTERVAL_MS);

    request.on("close", () => {
      clearInterval(ping);
      player.streams.delete(response);

      // Страницу могли просто обновить: ждём немного, прежде чем считать игрока ушедшим
      setTimeout(() => {
        if (player.streams.size === 0) {
          removePlayer(room, player.id);
        }
      }, RECONNECT_GRACE_PERIOD_MS);
    });

    return;
  }

  if (what === "actions" && request.method === "POST") {
    const body = (await readBody(request)) as ParsedActionRequest | null;
    const player = room.players.get((body?.player ?? "") as string);
    const action = body?.action;

    if (!player) {
      return json(response, 403, { error: "join first" });
    }

    if (!action || !isActionType((action as { type?: unknown }).type)) {
      return json(response, 400, { error: "bad action" });
    }

    // Время дня двигает только ведущий
    if (action.type === "tick" && player.id !== room.hostId) {
      return json(response, 409, { error: "not host" });
    }

    room.actions.push(action);
    broadcast(room, { type: "action", action });

    return json(response, 200, { ok: true });
  }

  return json(response, 405, { error: "method not allowed" });
});

// Пустые комнаты убираем, чтобы память не росла
setInterval(() => {
  const now = Date.now();

  for (const [key, room] of rooms) {
    if (room.emptySince !== null && now - room.emptySince > EMPTY_ROOM_TTL_MS) {
      rooms.delete(key);
    }
  }
}, ROOM_CLEANUP_INTERVAL_MS);

server.listen(PORT, () => {
  console.log(`Сервер совместной игры: http://localhost:${PORT}`);
});
