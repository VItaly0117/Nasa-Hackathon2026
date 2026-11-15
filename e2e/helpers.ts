import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import type { GameState } from "../src/types";

// Меню → «Новая игра» → режим → пропустить пролог → «Начать миссию»: на экране игра
export async function startMission(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Новая игра" }).click();
  await page.getByRole("button", { name: /Обычный/ }).click(); // выбор режима сложности
  await page.getByRole("button", { name: "Пропустить" }).click();
  await page.getByRole("button", { name: "Начать миссию" }).click();
  await expect(page.getByRole("timer")).toBeVisible();
}

export async function continueFromSavedState(page: Page, updates: Partial<GameState>) {
  await startMission(page);
  await page.getByRole("button", { name: "Меню" }).click();
  const continueButton = page.getByRole("button", { name: /Продолжить игру/ });
  await expect(continueButton).toBeVisible();
  await page.evaluate((stateUpdates) => {
    const raw = localStorage.getItem("moonbase:save");
    if (!raw) throw new Error("The mission save was not written before opening the menu");
    const saved = JSON.parse(raw);
    saved.state = { ...saved.state, ...stateUpdates };
    localStorage.setItem("moonbase:save", JSON.stringify(saved));
  }, updates);
  await page.reload();
  await continueButton.click();
}

// Нажимает на подсвеченную клетку карты, которая не закрыта панелями или карточками (проверяем, что в центре клетки именно карта)
export async function clickFreeTile(page: Page) {
  const spot = await page.evaluate(() => {
    for (const el of document.querySelectorAll(".tile-ok")) {
      const r = el.getBoundingClientRect();
      const x = r.x + r.width / 2;
      const y = r.y + r.height / 2;
      if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) continue;
      const hit = document.elementFromPoint(x, y);
      if (hit && hit.closest(".map-frame")) return { x, y };
    }
    return null;
  });
  expect(spot, "нет свободной клетки для постройки").not.toBeNull();
  await page.mouse.click(spot!.x, spot!.y);
}

/** Уникальное имя комнаты: сервер хранит комнаты между прогонами, а имя — только латиница до 20 символов. */
export function uniqueRoom(prefix: string): string {
  const letters = "abcdefghijklmnopqrstuvwxyz";
  let suffix = "";
  for (let i = 0; i < 6; i += 1) suffix += letters[Math.floor(Math.random() * letters.length)];
  return `${prefix}${suffix}`.slice(0, 20);
}
