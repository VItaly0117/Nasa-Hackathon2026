import { expect, test } from "@playwright/test";
import { clickFreeTile, startMission } from "./helpers";

test("игра запускается, идёт время, модуль строится, приходят задания", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await startMission(page);

  // экипаж просит о задании, и список заданий виден
  await expect(page.getByText("Поставь солнечные панели")).toBeVisible();
  await expect(page.getByText(/Следующие шаги · 0 \/ \d+/)).toBeVisible();

  // таймер дня идёт
  const timer = page.getByRole("timer");
  const before = await timer.textContent();
  await expect(timer).not.toHaveText(before ?? "", { timeout: 8000 });

  // строим: открыть меню, нажать на модуль, коснуться клетки
  await page.getByRole("button", { name: "Строительство", expanded: false }).click();
  // клик по карточке модуля сразу включает выбор места на карте
  await page.getByRole("button", { name: /^Солнечные панели/ }).click();
  // клик по подсвеченной клетке, не закрытой панелями и карточками
  await clickFreeTile(page);
  await expect(page.getByText(/Строится: \d+%/)).toBeVisible();

  expect(errors).toEqual([]);
});
