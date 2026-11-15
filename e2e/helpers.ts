import { expect } from "@playwright/test";
import type { Page } from "@playwright/test";

// Меню → «Новая игра» → режим → пропустить пролог → «Начать миссию»: на экране игра
export async function startMission(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Новая игра" }).click();
  await page.getByRole("button", { name: /Обычный/ }).click(); // выбор режима сложности
  await page.getByRole("button", { name: "Пропустить" }).click();
  await page.getByRole("button", { name: "Начать миссию" }).click();
  await expect(page.getByRole("timer")).toBeVisible();
}
