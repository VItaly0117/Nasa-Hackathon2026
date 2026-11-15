import { expect, test } from "@playwright/test";
import { startMission } from "./helpers";

const SECONDS = Number(process.env.PERF_SECONDS ?? 60);

// Замер плавности: кадры через requestAnimationFrame, долгие задачи через PerformanceObserver.
// Пороги из docs/NIGHT_PLAN.md: средний FPS ≥ 55, кадров дольше 33 мс ≤ 3%, долгих задач (>50 мс) после загрузки 0
test(`плавность: ${SECONDS} с игры`, async ({ page }) => {
  test.setTimeout((SECONDS + 60) * 1000);
  await startMission(page);

  await page.evaluate(() => {
    const w = window as unknown as { __perf: { frames: number; slow: number; max: number; long: number; stop: boolean } };
    w.__perf = { frames: 0, slow: 0, max: 0, long: 0, stop: false };
    new PerformanceObserver((list) => (w.__perf.long += list.getEntries().length)).observe({ entryTypes: ["longtask"] });
    let last = performance.now();
    const loop = (now: number) => {
      const d = now - last;
      last = now;
      w.__perf.frames++;
      if (d > 33) w.__perf.slow++;
      w.__perf.max = Math.max(w.__perf.max, d);
      if (!w.__perf.stop) requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  });
  await page.waitForTimeout(SECONDS * 1000);
  const r = await page.evaluate(() => {
    const w = window as unknown as { __perf: { frames: number; slow: number; max: number; long: number; stop: boolean } };
    w.__perf.stop = true;
    return w.__perf;
  });

  const fps = r.frames / SECONDS;
  const slowPct = (100 * r.slow) / r.frames;
  console.log(`FPS ${fps.toFixed(1)}, кадров дольше 33 мс ${slowPct.toFixed(1)}%, самый долгий кадр ${Math.round(r.max)} мс, долгих задач ${r.long}`);
  expect(fps).toBeGreaterThanOrEqual(55);
  expect(slowPct).toBeLessThanOrEqual(3);
  expect(r.long).toBe(0);
});
