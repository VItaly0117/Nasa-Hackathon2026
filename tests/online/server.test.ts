import { once } from "node:events";
import { readFileSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ACTION_TYPES, ROLES } from "../../shared/protocol.ts";

const TEST_DIRECTORY = dirname(fileURLToPath(import.meta.url));
const PROJECT_DIRECTORY = resolve(TEST_DIRECTORY, "../..");
const SERVER_PATH = resolve(PROJECT_DIRECTORY, "server/index.ts");
const TYPES_PATH = resolve(PROJECT_DIRECTORY, "src/types.ts");
const STARTUP_TIMEOUT_MS = 5_000;
const ROOM_PREFIX = "Room";
const INVALID_ROOM_NAME = "not-a-valid-room-name";
const MAX_ROOM_NAME_LENGTH = 20;
let roomSequence = 0;

type JoinedPlayer = {
  playerId: string;
  role: (typeof ROLES)[number];
  seed: number;
  hostId: string;
};

let serverProcess: ReturnType<typeof import("node:child_process").spawn> | undefined;
let baseUrl = "";

function uniqueRoomName(): string {
  return `${ROOM_PREFIX}${String.fromCharCode(65 + (roomSequence++ % 26))}`.slice(0, MAX_ROOM_NAME_LENGTH);
}

async function findAvailablePort(): Promise<number> {
  const temporaryServer = createServer();

  temporaryServer.listen(0, "127.0.0.1");
  await once(temporaryServer, "listening");

  const address = temporaryServer.address();

  if (!address || typeof address === "string") {
    throw new Error("Could not reserve a test port");
  }

  await new Promise<void>((resolveClose, rejectClose) => {
    temporaryServer.close((error) => {
      if (error) {
        rejectClose(error);
        return;
      }

      resolveClose();
    });
  });

  return address.port;
}

async function waitForStartup(
  child: ReturnType<typeof import("node:child_process").spawn>,
): Promise<void> {
  await new Promise<void>((resolveStartup, rejectStartup) => {
    const timeout = setTimeout(() => {
      cleanup();
      rejectStartup(new Error(`Server did not start within ${STARTUP_TIMEOUT_MS}ms`));
    }, STARTUP_TIMEOUT_MS);

    const onOutput = (chunk: Buffer): void => {
      if (!chunk.toString().includes("Сервер совместной игры:")) {
        return;
      }

      cleanup();
      resolveStartup();
    };

    const onError = (error: Error): void => {
      cleanup();
      rejectStartup(error);
    };

    const onExit = (code: number | null): void => {
      cleanup();
      rejectStartup(new Error(`Server exited before startup with code ${code}`));
    };

    const cleanup = (): void => {
      clearTimeout(timeout);
      child.stdout?.off("data", onOutput);
      child.off("error", onError);
      child.off("exit", onExit);
    };

    child.stdout?.on("data", onOutput);
    child.once("error", onError);
    child.once("exit", onExit);
  });
}

async function joinRoom(roomName: string): Promise<JoinedPlayer> {
  const response = await fetch(`${baseUrl}/api/rooms/${roomName}/join`, {
    method: "POST",
  });

  expect(response.status).toBe(200);
  return (await response.json()) as JoinedPlayer;
}

async function postAction(
  roomName: string,
  playerId: string,
  action: { type: string },
): Promise<Response> {
  return fetch(`${baseUrl}/api/rooms/${roomName}/actions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ player: playerId, action }),
  });
}

function engineActionTypes(): string[] {
  const source = readFileSync(TYPES_PATH, "utf8");
  const lines = source.split("\n");
  const start = lines.findIndex((line) => line.startsWith("export type Action ="));
  const actionDeclaration = lines.slice(start + 1).filter((line) => line.startsWith("  |")).join("\n");

  if (!actionDeclaration) {
    throw new Error("Could not find the Action type declaration");
  }

  const actionTypes = [...actionDeclaration.matchAll(/type:\s*"([^"]+)"/g)]
    .map((match) => match[1])
    .filter((type) => type !== "nextDay");

  return [...new Set(actionTypes)].sort();
}

beforeAll(async () => {
  const port = await findAvailablePort();
  baseUrl = `http://localhost:${port}`;

  const { spawn } = await import("node:child_process");
  serverProcess = spawn(process.execPath, [SERVER_PATH], {
    cwd: PROJECT_DIRECTORY,
    env: { ...process.env, PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"],
  });

  await waitForStartup(serverProcess);
});

afterAll(async () => {
  if (!serverProcess || serverProcess.exitCode !== null) {
    return;
  }

  const exited = once(serverProcess, "exit");
  serverProcess.kill();
  await exited;
});

describe("HTTP room server", () => {
  it("Онлайн-комната: роли, ведущий и валидация действий работают", async () => {
    const roomName = uniqueRoomName();
    const players: JoinedPlayer[] = [];
    for (let index = 0; index < ROLES.length; index += 1) {
      players.push(await joinRoom(roomName));
    }

    expect(new Set(players.map((player) => player.role))).toEqual(new Set(ROLES));
    expect(new Set(players.map((player) => player.seed)).size).toBe(1);
    expect(players[0].hostId).toBe(players[0].playerId);

    const guestTickResponse = await postAction(roomName, players[1].playerId, {
      type: "tick",
    });
    expect(guestTickResponse.status).toBe(409);

    const hostTickResponse = await postAction(roomName, players[0].playerId, {
      type: "tick",
    });
    expect(hostTickResponse.status).toBe(200);
  });

  it("Сервер пропускает все действия движка: tick, build, repair, research, resolveEvent", async () => {
    const roomName = uniqueRoomName();
    const host = await joinRoom(roomName);

    for (const type of ACTION_TYPES) {
      const response = await postAction(roomName, host.playerId, { type });
      expect(response.status).toBe(200);
    }
  });

  it("rejects unknown actions with a bad action response", async () => {
    const roomName = uniqueRoomName();
    const host = await joinRoom(roomName);

    const response = await postAction(roomName, host.playerId, {
      type: "unknownAction",
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "bad action" });
  });

  it("rejects invalid room names", async () => {
    const response = await fetch(
      `${baseUrl}/api/rooms/${INVALID_ROOM_NAME}/join`,
      { method: "POST" },
    );

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "bad name" });
  });

  it("keeps online action types synchronized with the engine action union", () => {
    expect([...ACTION_TYPES].sort()).toEqual(engineActionTypes());
  });
});
