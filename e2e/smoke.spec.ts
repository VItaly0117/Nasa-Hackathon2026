import { expect, test } from "@playwright/test";
import { startMission } from "./helpers";

test("игра запускается, идёт время, модуль строится, приходят задания", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await startMission(page);

  // экипаж просит о задании, и список заданий виден
  await expect(page.getByText("Поставь солнечные панели")).toBeVisible();
  await expect(page.getByText(/Задачи · 0 \/ \d+/)).toBeVisible();

  // таймер дня идёт
  const timer = page.getByRole("timer");
  const before = await timer.textContent();
  await page.waitForTimeout(2500);
  expect(await timer.textContent()).not.toBe(before);

  // строим: открыть меню, выбрать модуль, нажать «Построить», коснуться клетки
  await page.getByRole("button", { name: "Строительство", expanded: false }).click();
  await page.getByRole("button", { name: /^Солнечные панели/ }).click();
  await page.getByRole("button", { name: "Построить" }).click();
  await page.mouse.click(368, 528);
  await expect(page.getByText(/Строится: \d+%/)).toBeVisible();

  expect(errors).toEqual([]);
});
