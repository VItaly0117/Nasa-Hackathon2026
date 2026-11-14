import { once } from "node:events";
import { readFileSync } from "node:fs";
import { spawn } from "node:child_process";
import { randomInt } from "node:crypto";

// Проверяем публичный контракт совместной комнаты без браузера:
// роли участников, право ведущего проматывать время и валидацию действий.
const port = randomInt(20_000, 40_000);
const baseUrl = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, ["server/index.mjs"], {
  env: { ...process.env, PORT: String(port) },
  stdio: ["ignore", "pipe", "pipe"],
});

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function waitForServer() {
  let output = "";
  server.stdout.on("data", (chunk) => {
    output += chunk;
  });
  server.stderr.on("data", (chunk) => {
    output += chunk;
  });

  const deadline = Date.now() + 5_000;
  while (Date.now() < deadline) {
    if (output.includes("Сервер совместной игры")) return;
    if (server.exitCode !== null) throw new Error(`Онлайн-сервер завершился раньше запуска: ${output}`);
    await new Promise((resolve) => setTimeout(resolve, 25));
  }
  throw new Error(`Онлайн-сервер не запустился за 5 секунд: ${output}`);
}

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, options);
  const body = await response.json();
  return { response, body };
}

async function join(room) {
  const { response, body } = await request(`/api/rooms/${room}/join`, { method: "POST" });
  assert(response.status === 200, `Не удалось войти в комнату: ${response.status}`);
  return body;
}

async function action(player, type) {
  return request("/api/rooms/SMOKE/actions", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ player, action: { type } }),
  });
}

try {
  await waitForServer();
  const players = await Promise.all([join("SMOKE"), join("SMOKE"), join("SMOKE"), join("SMOKE")]);
  const validRoles = new Set(["engineer", "scientist", "doctor", "technician"]);

  assert(players.every((player) => validRoles.has(player.role)), `В комнату выдана неподдерживаемая роль: ${players.map((p) => p.role).join(", ")}`);
  assert(new Set(players.map((player) => player.role)).size === 4, `Четыре игрока должны получить четыре разные роли: ${players.map((p) => p.role).join(", ")}`);
  assert(players.every((player) => player.seed === players[0].seed), "Игроки одной комнаты получили разные seed");
  assert(players[0].hostId === players[0].playerId, "Первый игрок должен быть ведущим комнаты");

  const hostTick = await action(players[0].playerId, "tick");
  assert(hostTick.response.status === 200, `Ведущий не смог промотать время: ${hostTick.response.status}`);
  const guestTick = await action(players[1].playerId, "tick");
  assert(guestTick.response.status === 409 && guestTick.body.error === "not host", "Обычный игрок не должен проматывать время");
  const guestRepair = await action(players[1].playerId, "repair");
  assert(guestRepair.response.status === 200, `Игрок не смог отправить разрешённое действие: ${guestRepair.response.status}`);
  const research = await action(players[1].playerId, "research");
  assert(research.response.status === 200, `Сервер не пропустил действие research: ${research.response.status}`);
  const badAction = await action(players[1].playerId, "inventModule");
  assert(badAction.response.status === 400, "Сервер должен отклонять неизвестное действие");

  // Каждое действие движка должно быть разрешено на сервере, иначе в совместной игре кнопка молча не сработает.
  // Исключение nextDay: пропускать день онлайн нельзя
  const typesSource = readFileSync("src/types.ts", "utf8").split("\n");
  const start = typesSource.findIndex((line) => line.startsWith("export type Action"));
  const block = [];
  for (let i = start + 1; i < typesSource.length && typesSource[i].startsWith(" "); i++) block.push(typesSource[i]);
  const engineActions = new Set([...block.join("\n").matchAll(/type: "(\w+)"/g)].map((m) => m[1]));
  engineActions.delete("nextDay");
  const serverSource = readFileSync("server/index.mjs", "utf8");
  const serverActions = new Set([...serverSource.match(/ACTION_TYPES = new Set\(\[(.*?)\]\)/)[1].matchAll(/"(\w+)"/g)].map((m) => m[1]));
  const missing = [...engineActions].filter((a) => !serverActions.has(a));
  const extra = [...serverActions].filter((a) => !engineActions.has(a));
  assert(engineActions.size >= 5, `Не удалось прочитать список действий из types.ts: ${[...engineActions].join(", ")}`);
  assert(missing.length === 0 && extra.length === 0, `Действия движка и сервера разошлись. Нет на сервере: ${missing.join(", ") || "—"}. Лишние на сервере: ${extra.join(", ") || "—"}`);

  console.log("✓ Онлайн-комната: роли, ведущий и валидация действий работают");
  console.log(`✓ Сервер пропускает все действия движка: ${[...engineActions].join(", ")}`);
} finally {
  if (server.exitCode === null) {
    server.kill();
    await once(server, "exit");
  }
}
