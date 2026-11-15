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
