import { defineConfig } from "@playwright/test";
import baseConfig from "../playwright.config";

const port = Number(process.env.E2E_PORT ?? 5199);
const appUrl = `http://localhost:${port}`;

export default defineConfig({
  ...baseConfig,
  testDir: ".",
  use: {
    ...baseConfig.use,
    baseURL: appUrl,
    storageState: {
      cookies: [],
      origins: [{
        origin: appUrl,
        localStorage: [{ name: "moonbase:lang", value: JSON.stringify("ru") }],
      }],
    },
  },
  webServer: [
    {
      command: `npm run dev -- --port ${port} --strictPort`,
      url: appUrl,
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: "npm run server",
      port: 8787,
      reuseExistingServer: true,
      timeout: 30_000,
    },
  ],
});
