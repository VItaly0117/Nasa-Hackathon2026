import { once } from "node:events";
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
  const validRoles = new Set(["engineer", "scientist", "technician"]);

  assert(players.every((player) => validRoles.has(player.role)), `В комнату выдана неподдерживаемая роль: ${players.map((p) => p.role).join(", ")}`);
  assert(new Set(players.slice(0, 3).map((player) => player.role)).size === 3, "Первые три игрока должны получить разные роли");
  assert(players.every((player) => player.seed === players[0].seed), "Игроки одной комнаты получили разные seed");
  assert(players[0].hostId === players[0].playerId, "Первый игрок должен быть ведущим комнаты");

  const hostTick = await action(players[0].playerId, "tick");
  assert(hostTick.response.status === 200, `Ведущий не смог промотать время: ${hostTick.response.status}`);
  const guestTick = await action(players[1].playerId, "tick");
  assert(guestTick.response.status === 409 && guestTick.body.error === "not host", "Обычный игрок не должен проматывать время");
  const guestRepair = await action(players[1].playerId, "repair");
  assert(guestRepair.response.status === 200, `Игрок не смог отправить разрешённое действие: ${guestRepair.response.status}`);
  const badAction = await action(players[1].playerId, "inventModule");
  assert(badAction.response.status === 400, "Сервер должен отклонять неизвестное действие");

  console.log("✓ Онлайн-комната: роли, ведущий и валидация действий работают");
} finally {
  if (server.exitCode === null) {
    server.kill();
    await once(server, "exit");
  }
}
