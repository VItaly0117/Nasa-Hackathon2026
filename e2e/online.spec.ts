import { expect, test } from "@playwright/test";

// Два игрока входят в одну комнату: у обоих видна комната и два игрока, время общее (его двигает ведущий)
test("совместная игра: двое в одной комнате видят одно и то же время", async ({ browser }) => {
  test.setTimeout(90_000);
  const room = `QA${Math.random().toString(36).replace(/[^a-z]/g, "").slice(0, 8)}`;
  const state = { cookies: [], origins: [{ origin: "http://localhost:5173", localStorage: [{ name: "moonbase:lang", value: JSON.stringify("ru") }] }] };
  const errors: string[] = [];

  async function join() {
    const ctx = await browser.newContext({ storageState: state, viewport: { width: 1280, height: 800 } });
    const page = await ctx.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto("/");
    await page.getByRole("button", { name: "Сервер" }).click();
    await page.getByLabel("Название сервера").fill(room);
    await page.getByRole("button", { name: "Войти" }).click();
    await expect(page.getByRole("timer")).toBeVisible();
    return { ctx, page };
  }

  const a = await join();
  const b = await join();

  // у обоих видна комната и два игрока
  for (const { page } of [a, b]) {
    await expect(page.getByText(new RegExp(`Сервер ${room}`, "i"))).toBeVisible();
    await expect(page.getByText("Игроков: 2")).toBeVisible();
  }

  // время общее: за пару секунд таймер у обоих сдвинулся и они показывают почти одно и то же
  const read = async (p: typeof a.page) => (await p.getByRole("timer").textContent()) ?? "";
  const toSec = (t: string) => {
    const m = /(\d+):(\d+)/.exec(t);
    return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
  };
  const a0 = toSec(await read(a.page));
  await a.page.waitForTimeout(3000);
  const a1 = toSec(await read(a.page));
  const b1 = toSec(await read(b.page));
  expect(a1).toBeLessThan(a0); // таймер идёт (обратный отсчёт дня)
  expect(Math.abs(a1 - b1)).toBeLessThanOrEqual(2); // у обоих одно и то же время

  expect(errors).toEqual([]);
  await a.ctx.close();
  await b.ctx.close();
});
