import { expect, test } from "@playwright/test";

test("итоги миссии: ускоренный прогон, ролик, оценка и разбор с фактами NASA", async ({ page }) => {
  test.setTimeout(90_000);
  await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
  await page.goto("/");
  await page.evaluate(async () => {
    const enginePath = "/src/engine/index.ts";
    const storagePath = "/src/session/storage.ts";
    const [{ initialState, DAY_MS }, { saveGame }] = await Promise.all([import(enginePath), import(storagePath)]);
    const seedState = initialState(901, "easy");
    // Keep the save deterministic and let the browser clock cross the final day boundary.
    saveGame({
      ...seedState,
      day: 20,
      clockMs: DAY_MS - 100,
      history: [
        { day: 3, kind: "built", module: "greenhouse" },
        { day: 6, kind: "choice", event: "breakdown", choice: "repair", unprotected: false },
        { day: 9, kind: "choice", event: "flare", choice: "hide", unprotected: false },
        { day: 15, kind: "shortage", resource: "food" },
      ],
    });
  });
  await page.reload();
  await page.getByRole("button", { name: /Продолжить/ }).click();
  await expect(page.getByRole("timer")).toBeVisible();

  const ending = page.locator(".ending-scene");
  await page.clock.fastForward(1000);
  if (!(await ending.isVisible())) await page.clock.fastForward(1000);
  await expect(ending).toBeVisible();
  await page.clock.fastForward(30_000);
  await page.getByRole("button", { name: "Пропустить" }).click();

  await expect(page.getByText(/^Оценка:/)).toBeVisible();
  await expect(page.getByRole("heading", { name: "Что помогло" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Что помешало" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Данные NASA" })).toBeVisible();
  await expect(page.locator(".results__card").filter({ hasText: "NASA" }).first()).toBeVisible();
});

test("меню и данные NASA переведены на русский, украинский и английский", async ({ page }) => {
  const languages = [
    {
      button: "Русский",
      title: "Лунная база",
      newGame: "Новая игра",
      sources: "Данные NASA",
      radlab: "RadLab: радиация в космосе",
      inGame: "Используется в игре",
      eclss: "ECLSS: сколько нужно человеку в космосе",
      close: "Закрыть",
    },
    {
      button: "Українська",
      title: "Місячна база",
      newGame: "Нова гра",
      sources: "Дані NASA",
      radlab: "RadLab: радіація в космосі",
      inGame: "Використовується в грі",
      eclss: "ECLSS: скільки потрібно людині в космосі",
      close: "Закрити",
    },
    {
      button: "English",
      title: "Lunar base",
      newGame: "New game",
      sources: "NASA data",
      radlab: "RadLab: space radiation",
      inGame: "Used in the game",
      eclss: "ECLSS: what a person needs in space",
      close: "Close",
    },
  ];

  await page.goto("/");
  for (const [index, language] of languages.entries()) {
    if (index > 0) {
      await page.getByRole("button", { name: /^(Язык|Мова|Language):/ }).click();
      await page.getByRole("button", { name: language.button, exact: true }).click();
    }

    await expect(page.getByRole("heading", { level: 1, name: language.title })).toBeVisible();
    await expect(page.getByRole("button", { name: language.newGame, exact: true })).toBeVisible();
    expect(await page.locator("body").innerText()).not.toMatch(/\bapp\.[\w.]+/);

    await page.getByRole("button", { name: language.sources, exact: true }).click();
    await expect(page.getByRole("heading", { name: language.sources })).toBeVisible();
    const radlab = page.locator(".results__card").filter({ hasText: "RadLab" });
    await expect(radlab).toContainText(language.radlab);
    await expect(radlab).toContainText(language.inGame);
    await expect(page.locator(".results__card").filter({ hasText: "ECLSS" })).toContainText(language.eclss);
    expect(await page.locator("body").innerText()).not.toMatch(/\bapp\.[\w.]+/);
    await page.getByRole("button", { name: language.close, exact: true }).click();
  }
});
