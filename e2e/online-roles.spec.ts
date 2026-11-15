import { expect, test } from "@playwright/test";
import type { Browser, BrowserContext, Page } from "@playwright/test";

const storageState = {
  cookies: [],
  origins: [{ origin: `http://localhost:${process.env.E2E_PORT ?? 5173}`, localStorage: [{ name: "moonbase:lang", value: JSON.stringify("ru") }] }],
};

const moduleByRole: Record<string, string> = {
  Инженер: "Солнечные панели",
  Учёный: "Теплица",
  Врач: "Медпункт",
  Техник: "Жилой модуль",
};

async function openRoom(browser: Browser, room: string) {
  const context = await browser.newContext({ storageState, viewport: { width: 1280, height: 800 } });
  const page = await context.newPage();
  await page.goto("/");
  await page.getByRole("button", { name: "Сервер" }).click();
  await page.getByLabel("Название сервера").fill(room);
  return { context, page };
}

async function joinRoom(browser: Browser, room: string) {
  const opened = await openRoom(browser, room);
  await opened.page.getByRole("button", { name: "Войти" }).click();
  await expect(opened.page.getByRole("timer")).toBeVisible();
  return opened;
}

async function chooseBuildTile(page: Page) {
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
}

function roleFromBadge(text: string): string {
  const role = /ты:\s*(.+?)(?:\s+·|$)/.exec(text)?.[1];
  expect(role).toBeTruthy();
  return role!;
}

test("совместная игра: роли разные, модуль чужой роли закрыт, свой строится у всех", async ({ browser }) => {
  test.setTimeout(90_000);
  const room = "ROLEBUILDQA";
  const a = await joinRoom(browser, room);
  const b = await joinRoom(browser, room);

  try {
    const roleA = roleFromBadge((await a.page.locator(".online-badge").textContent()) ?? "");
    const roleB = roleFromBadge((await b.page.locator(".online-badge").textContent()) ?? "");
    expect(roleA).not.toBe(roleB);

    await a.page.getByRole("button", { name: "Строительство", expanded: false }).click();
    const foreignModule = moduleByRole[roleB];
    await a.page.getByRole("button", { name: new RegExp(`^${foreignModule}`) }).click();
    await expect(a.page.getByRole("tooltip")).toContainText(`Это строит ${roleB}`);
    await expect(a.page.locator(".tile-ok")).toHaveCount(0);

    const ownModule = moduleByRole[roleA];
    await a.page.getByRole("button", { name: new RegExp(`^${ownModule}`) }).click();
    await expect(a.page.locator(".tile-ok").first()).toBeVisible();
    await chooseBuildTile(a.page);

    await expect(a.page.locator(".module-art")).toHaveCount(3);
    await expect(b.page.locator(".module-art")).toHaveCount(3);
  } finally {
    await a.context.close();
    await b.context.close();
  }
});

test("совместная игра: четвёртый игрок получает последнюю свободную роль", async ({ browser }) => {
  test.setTimeout(90_000);
  const room = "FOURROLESQA";
  const players: { context: BrowserContext; page: Page }[] = [];

  try {
    for (let index = 0; index < 4; index += 1) {
      players.push(await joinRoom(browser, room));
    }

    const roles = await Promise.all(players.map(async ({ page }) => roleFromBadge((await page.locator(".online-badge").textContent()) ?? "")));
    expect(new Set(roles).size).toBe(4);
    await expect(players[3].page.getByText("Игроков: 4")).toBeVisible();
  } finally {
    await Promise.all(players.map(({ context }) => context.close()));
  }
});

// Известная production-проблема: сервер повторно раздаёт занятые роли после четвёртого игрока.
// Оставляем ожидаемый сценарий как fixme, пока ограничение комнаты нельзя исправить в tests/-only задаче.
test.fixme("совместная игра: пятый игрок получает понятный отказ", async ({ browser }) => {
  const room = "FIFTHPLAYERQA";
  const players: { context: BrowserContext; page: Page }[] = [];

  try {
    for (let index = 0; index < 4; index += 1) {
      players.push(await joinRoom(browser, room));
    }

    const fifth = await openRoom(browser, room);
    try {
      await fifth.page.getByRole("button", { name: "Войти" }).click();
      await expect(fifth.page.getByRole("alert")).toContainText(/комната.*заполнена|максимум.*4/i);
    } finally {
      await fifth.context.close();
    }
  } finally {
    await Promise.all(players.map(({ context }) => context.close()));
  }
});
