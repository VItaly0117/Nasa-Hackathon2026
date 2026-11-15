import { expect, test } from "@playwright/test";

// Два игрока входят в одну комнату: у обоих видна комната и два игрока, время общее (его двигает ведущий)
test("совместная игра: двое в одной комнате видят одно и то же время", async ({ browser }) => {
  test.setTimeout(90_000);
  const room = "CLOCKSYNCQA";
  const appUrl = `http://localhost:${process.env.E2E_PORT ?? 5199}`;
  const state = { cookies: [], origins: [{ origin: appUrl, localStorage: [{ name: "moonbase:lang", value: JSON.stringify("ru") }] }] };
  const errors: string[] = [];

  async function join() {
    const ctx = await browser.newContext({ baseURL: appUrl, storageState: state, viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/");
    await page.getByRole("button", { name: "Играть с друзьями" }).click();
    await page.getByLabel("Название сервера").fill(room);
    await page.getByRole("button", { name: "Войти" }).click();
    await expect(page.getByRole("timer")).toBeVisible();
    return { ctx, page };
  }

  const a = await join();
  const b = await join();

  try {
    for (const { page } of [a, b]) {
      await expect(page.getByText(new RegExp(`Сервер ${room}`, "i"))).toBeVisible();
      await expect(page.getByText("Игроков: 2")).toBeVisible();
    }

    const read = async (p: typeof a.page) => (await p.getByRole("timer").textContent()) ?? "";
    const toSec = (t: string) => {
      const m = /(\d+):(\d+)/.exec(t);
      return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
    };
    const a0 = toSec(await read(a.page));
    await a.page.waitForTimeout(3000);
    const a1 = toSec(await read(a.page));
    const b1 = toSec(await read(b.page));
    expect(a1).toBeLessThan(a0);
    expect(Math.abs(a1 - b1)).toBeLessThanOrEqual(2);
    expect(errors).toEqual([]);
  } finally {
    await a.ctx.close();
    await b.ctx.close();
  }
});

test("совместная игра: после потери связи действия не применяются повторно", async ({ browser }) => {
  test.setTimeout(90_000);
  const room = "RECONNECTQA";
  const appUrl = `http://localhost:${process.env.E2E_PORT ?? 5199}`;
  const state = { cookies: [], origins: [{ origin: appUrl, localStorage: [{ name: "moonbase:lang", value: JSON.stringify("ru") }] }] };
  const ctx = await browser.newContext({ baseURL: appUrl, storageState: state, viewport: { width: 1280, height: 800 } });
  const page = await ctx.newPage();
  const eventUrls: string[] = [];
  await page.addInitScript(() => {
    const trackedWindow = window as Window & {
      __moonbaseActionMessages?: string[];
      __moonbaseEventSources?: EventSource[];
    };
    trackedWindow.__moonbaseActionMessages = [];
    trackedWindow.__moonbaseEventSources = [];
    const NativeEventSource = window.EventSource;
    window.EventSource = class extends NativeEventSource {
      constructor(url: string | URL, options?: EventSourceInit) {
        super(url, options);
        trackedWindow.__moonbaseEventSources?.push(this);
        this.addEventListener("message", (event) => {
          const message = JSON.parse((event as MessageEvent).data);
          if (message.type === "action") trackedWindow.__moonbaseActionMessages?.push(message.action.type);
        });
      }
    } as typeof EventSource;
  });
  page.on("request", (request) => {
    if (request.url().includes("/events?")) eventUrls.push(request.url());
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Играть с друзьями" }).click();
  await page.getByLabel("Название сервера").fill(room);
  await page.getByRole("button", { name: "Войти" }).click();
  await expect(page.getByRole("timer")).toBeVisible();

  try {
    const badge = (await page.locator(".online-badge").textContent()) ?? "";
    const role = /ты:\s*(.+?)(?:\s+·|$)/.exec(badge)?.[1];
    expect(role).toBeTruthy();
    const buildByRole: Record<string, string> = {
      Инженер: "Солнечные панели",
      Учёный: "Теплица",
      Врач: "Медпункт",
      Техник: "Жилой модуль",
    };
    const moduleName = buildByRole[role!];

    const moduleCountBeforeBuild = await page.locator(".module-art").count();
    await page.getByRole("button", { name: "Строительство", expanded: false }).click();
    await page.getByRole("button", { name: new RegExp(`^${moduleName}`) }).click();
    const spot = await page.evaluate(() => {
      for (const el of document.querySelectorAll(".tile-ok")) {
        const bounds = el.getBoundingClientRect();
        const x = bounds.x + bounds.width / 2;
        const y = bounds.y + bounds.height / 2;
        if (x > 330 && x < 880 && y > 430 && y < 620) return { x, y };
      }
      return null;
    });
    expect(spot, "нет доступной клетки для постройки").not.toBeNull();
    await page.mouse.click(spot!.x, spot!.y);
    await expect(page.locator(".module-art")).toHaveCount(moduleCountBeforeBuild + 1);
    await page.getByRole("button", { name: "Правила" }).click();
    await expect(page.getByRole("dialog")).toBeVisible();
    const actionsBeforeDisconnect = await page.evaluate(
      () => (window as Window & { __moonbaseActionMessages?: string[] }).__moonbaseActionMessages ?? [],
    );
    expect(actionsBeforeDisconnect.length).toBeGreaterThan(0);

    await page.route("**/api/**", (route) => route.abort());
    await page.evaluate(() => {
      const trackedWindow = window as Window & { __moonbaseEventSources?: EventSource[] };
      for (const source of trackedWindow.__moonbaseEventSources ?? []) source.dispatchEvent(new Event("error"));
    });
    await expect(page.getByRole("alert").filter({ hasText: "Связь с сервером потеряна" })).toBeVisible();
    await page.unroute("**/api/**");
    await expect(page.getByRole("alert").filter({ hasText: "Связь с сервером потеряна" })).toBeHidden();

    const actionsAfterReconnect = await page.evaluate(
      () => (window as Window & { __moonbaseActionMessages?: string[] }).__moonbaseActionMessages ?? [],
    );
    expect(actionsAfterReconnect.slice(0, actionsBeforeDisconnect.length)).toEqual(actionsBeforeDisconnect);
    expect(new URL(eventUrls.at(-1)!).searchParams.get("from")).toBe(String(actionsBeforeDisconnect.length));
    expect(await page.locator(".module-art").count()).toBe(moduleCountBeforeBuild + 1);
    expect(actionsAfterReconnect.filter((action) => action === "build")).toHaveLength(1);
  } finally {
    await ctx.close();
  }
});
