import { defineConfig } from "@playwright/test";

// Порт dev-сервера можно сменить (E2E_PORT=5199), если 5173 занят чужим сервером: Playwright переиспользует любой, что уже слушает порт
const PORT = Number(process.env.E2E_PORT ?? 5173);
const ORIGIN = `http://localhost:${PORT}`;

// Браузер: установленный Chrome (скачивать ничего не нужно). Игра запускается на dev-сервере Vite
export default defineConfig({
  testDir: "e2e",
  timeout: 120_000,
  reporter: "list",
  use: {
    baseURL: ORIGIN,
    channel: "chrome",
    viewport: { width: 1280, height: 800 },
    // тексты проверяем на русском: язык сохраняется в localStorage до загрузки страницы
    storageState: { cookies: [], origins: [{ origin: ORIGIN, localStorage: [{ name: "moonbase:lang", value: JSON.stringify("ru") }] }] },
  },
  webServer: [
    { command: `npm run dev -- --port ${PORT} --strictPort`, url: ORIGIN, reuseExistingServer: true, timeout: 60_000 },
    // сервер совместной игры (Vite проксирует на него /api)
    { command: "npm run server", port: 8787, reuseExistingServer: true, timeout: 30_000 },
  ],
});
