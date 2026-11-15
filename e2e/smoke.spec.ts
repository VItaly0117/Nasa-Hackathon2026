import { expect, test } from "@playwright/test";
import { startMission } from "./helpers";

test("игра запускается, идёт время, модуль строится, приходят задания", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));

  await startMission(page);

  // экипаж просит о задании, и список заданий виден
  await expect(page.getByText("Поставь солнечные панели")).toBeVisible();
  await expect(page.getByText(/до дня \d+/).first()).toBeVisible();

  // таймер дня идёт
  const timer = page.getByRole("timer");
  const before = await timer.textContent();
  await expect(timer).not.toHaveText(before ?? "", { timeout: 8000 });

  // строим: открыть меню, нажать на модуль, коснуться клетки
  await page.getByRole("button", { name: "Строительство", expanded: false }).click();
  // клик по карточке модуля сразу включает выбор места на карте
  await page.getByRole("button", { name: /^Солнечные панели/ }).click();
  // выбираем подсвеченную клетку в свободной от панелей части экрана (координаты не зашиваем: карта может сдвигаться; ниже карточек заданий, чтобы клик не попал в них)
  const spot = await page.evaluate(() => {
    for (const el of document.querySelectorAll(".tile-ok")) {
      const r = el.getBoundingClientRect();
      const x = r.x + r.width / 2;
      const y = r.y + r.height / 2;
      if (x > 330 && x < 880 && y > 430 && y < 620) return { x, y };
    }
    return null;
  });
  expect(spot, "нет подсвеченной клетки в центре экрана").not.toBeNull();
  await page.mouse.click(spot!.x, spot!.y);
  await expect(page.getByText(/Строится: \d+%/)).toBeVisible();

  expect(errors).toEqual([]);
});
