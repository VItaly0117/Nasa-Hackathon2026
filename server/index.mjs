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

import { createServer } from "node:http";
import { randomBytes, randomInt } from "node:crypto";

const PORT = Number(process.env.PORT) || 8787;
const ROLES = ["engineer", "technician", "doctor", "scientist"];
const NAME_RE = /^[A-Za-z]{1,20}$/;
const ACTION_TYPES = new Set(["tick", "build", "resolveEvent", "repair"]);
const EMPTY_ROOM_TTL_MS = 10 * 60 * 1000; // пустая комната живёт 10 минут: можно обновить страницу и вернуться
const JOIN_TIMEOUT_MS = 30 * 1000;        // зашёл, но не подключился к потоку: место освобождается

/** @type {Map<string, { name: string, seed: number, actions: object[], players: Map<string, { id: string, role: string, streams: Set<import("node:http").ServerResponse> }>, hostId: string | null, emptySince: number | null }>} */
const rooms = new Map();

function getRoom(name) {
  const key = name.toUpperCase();
  let room = rooms.get(key);
  if (!room) {
    room = { name: key, seed: randomInt(2 ** 32), actions: [], players: new Map(), hostId: null, emptySince: null };
    rooms.set(key, room);
  }
  return room;
}

// Случайная роль: сначала те, которых в комнате ещё нет, потом любые
function pickRole(room) {
  const taken = new Set([...room.players.values()].map((p) => p.role));
  const free = ROLES.filter((r) => !taken.has(r));
  const pool = free.length ? free : ROLES;
  return pool[randomInt(pool.length)];
}

function playersOf(room) {
  return [...room.players.values()].map(({ id, role }) => ({ id, role }));
}

function send(res, payload) {
  res.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function broadcast(room, payload) {
  for (const player of room.players.values()) for (const res of player.streams) send(res, payload);
}

function broadcastPlayers(room) {
  broadcast(room, { type: "players", players: playersOf(room), hostId: room.hostId });
}

function removePlayer(room, playerId) {
  if (!room.players.delete(playerId)) return;
  if (room.hostId === playerId) room.hostId = room.players.keys().next().value ?? null;
  if (room.players.size === 0) room.emptySince = Date.now();
  broadcastPlayers(room);
}

function json(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
  res.end(JSON.stringify(body));
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
      if (raw.length > 10_000) req.destroy(); // действия маленькие, большое тело — ошибка или атака
    });
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve(null);
      }
    });
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  const match = url.pathname.match(/^\/api\/rooms\/([^/]+)\/(join|events|actions)$/);

  if (req.method === "OPTIONS") {
    res.writeHead(204, {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST",
      "Access-Control-Allow-Headers": "Content-Type",
    });
    return res.end();
  }
  if (!match) return json(res, 404, { error: "not found" });

  const [, rawName, what] = match;
  const name = decodeURIComponent(rawName);
  if (!NAME_RE.test(name)) return json(res, 400, { error: "bad name" });
  const room = getRoom(name);

  if (what === "join" && req.method === "POST") {
    const id = randomBytes(8).toString("hex");
    const player = { id, role: pickRole(room), streams: new Set() };
    room.players.set(id, player);
    room.hostId ??= id;
    room.emptySince = null;
    // Если игрок так и не подключился к потоку, через полминуты освобождаем его место
    setTimeout(() => {
      if (room.players.get(id)?.streams.size === 0) removePlayer(room, id);
    }, JOIN_TIMEOUT_MS);
    broadcastPlayers(room);
    return json(res, 200, {
      playerId: id,
      role: player.role,
      seed: room.seed,
      actions: room.actions,
      players: playersOf(room),
      hostId: room.hostId,
    });
  }

  if (what === "events" && req.method === "GET") {
    const player = room.players.get(url.searchParams.get("player") ?? "");
    if (!player) return json(res, 403, { error: "join first" });
    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "Access-Control-Allow-Origin": "*",
    });
    // Всё, что случилось после входа игрока, и только потом новое: так ни одно действие не теряется
    const from = Math.max(0, Number(url.searchParams.get("from")) || 0);
    for (const action of room.actions.slice(from)) send(res, { type: "action", action });
    send(res, { type: "players", players: playersOf(room), hostId: room.hostId });
    player.streams.add(res);
    const ping = setInterval(() => res.write(": ping\n\n"), 15000);
    req.on("close", () => {
      clearInterval(ping);
      player.streams.delete(res);
      // Страницу могли просто обновить: ждём немного, прежде чем считать игрока ушедшим
      setTimeout(() => {
        if (player.streams.size === 0) removePlayer(room, player.id);
      }, 5000);
    });
    return;
  }

  if (what === "actions" && req.method === "POST") {
    const body = await readBody(req);
    const player = room.players.get(body?.player ?? "");
    const action = body?.action;
    if (!player) return json(res, 403, { error: "join first" });
    if (!action || !ACTION_TYPES.has(action.type)) return json(res, 400, { error: "bad action" });
    // Время дня двигает только ведущий
    if (action.type === "tick" && player.id !== room.hostId) return json(res, 409, { error: "not host" });
    room.actions.push(action);
    broadcast(room, { type: "action", action });
    return json(res, 200, { ok: true });
  }

  return json(res, 405, { error: "method not allowed" });
});

// Пустые комнаты убираем, чтобы память не росла
setInterval(() => {
  const now = Date.now();
  for (const [key, room] of rooms) {
    if (room.emptySince !== null && now - room.emptySince > EMPTY_ROOM_TTL_MS) rooms.delete(key);
  }
}, 60 * 1000);

server.listen(PORT, () => {
  console.log(`Сервер совместной игры: http://localhost:${PORT}`);
});
