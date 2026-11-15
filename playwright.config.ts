import { defineConfig } from "@playwright/test";

// Браузер: установленный Chrome (скачивать ничего не нужно). Игра запускается на dev-сервере Vite
export default defineConfig({
  testDir: "e2e",
  timeout: 120_000,
  reporter: "list",
  use: {
    baseURL: "http://localhost:5173",
    channel: "chrome",
    viewport: { width: 1280, height: 800 },
    // тексты проверяем на русском: язык сохраняется в localStorage до загрузки страницы
    storageState: { cookies: [], origins: [{ origin: "http://localhost:5173", localStorage: [{ name: "moonbase:lang", value: JSON.stringify("ru") }] }] },
  },
  webServer: [
    { command: "npm run dev -- --port 5173 --strictPort", url: "http://localhost:5173", reuseExistingServer: true, timeout: 60_000 },
    // сервер совместной игры (Vite проксирует на него /api)
    { command: "npm run server", port: 8787, reuseExistingServer: true, timeout: 30_000 },
  ],
});
