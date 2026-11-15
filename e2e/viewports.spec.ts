import { expect, test } from "@playwright/test";
import type { Page, TestInfo } from "@playwright/test";
import type { GameState } from "../src/types";

const viewports = [
  { name: "phone-390x844", width: 390, height: 844 },
  { name: "phone-430x932", width: 430, height: 932 },
  { name: "phone-landscape-844x390", width: 844, height: 390 },
  { name: "phone-landscape-932x430", width: 932, height: 430 },
  { name: "phone-landscape-667x375", width: 667, height: 375 },
  { name: "tablet-820x1180", width: 820, height: 1180 },
  { name: "tablet-1180x820", width: 1180, height: 820 },
] as const;

async function checkLayout(page: Page, stage: string): Promise<string[]> {
  return page.evaluate((stageName) => {
    const width = window.innerWidth;
    const height = window.innerHeight;
    const issues: string[] = [];
    if (document.documentElement.scrollWidth > width) {
      issues.push(`${stageName}: horizontal page overflow (${document.documentElement.scrollWidth}px > ${width}px)`);
    }

    const selector = (element: Element) => {
      const html = element as HTMLElement;
      const identity = html.id ? `#${html.id}` : "";
      const classes = typeof html.className === "string" && html.className.trim()
        ? `.${html.className.trim().split(/\s+/).join(".")}`
        : "";
      return `${element.tagName.toLowerCase()}${identity}${classes}`;
    };
    const activeLayer = [...document.querySelectorAll(
      ".overlay > .modal, .overlay > .daysum, .ending-scene, .mm--sources",
    )].reverse().find((element) => element instanceof HTMLElement && element.checkVisibility());
    const clippedByScrollArea = (element: Element, rect: DOMRect) => {
      let ancestor = element.parentElement;
      while (ancestor) {
        const style = getComputedStyle(ancestor);
        const bounds = ancestor.getBoundingClientRect();
        const clipsX = /auto|scroll|hidden|clip/.test(style.overflowX);
        const clipsY = /auto|scroll|hidden|clip/.test(style.overflowY);
        if (
          (clipsX && (rect.left < bounds.left || rect.right > bounds.right)) ||
          (clipsY && (rect.top < bounds.top || rect.bottom > bounds.bottom))
        ) return true;
        ancestor = ancestor.parentElement;
      }
      return false;
    };
    const targets = new Set(document.querySelectorAll(
      'button, a[href], input, select, textarea, [tabindex]:not([tabindex="-1"]), [role="button"], [role="timer"], .resource',
    ));

    for (const element of targets) {
      if (!(element instanceof HTMLElement) || !element.checkVisibility({ checkOpacity: true })) continue;
      if (activeLayer && !activeLayer.contains(element)) continue;
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0 || rect.right <= 0 || rect.bottom <= 0 || rect.left >= width || rect.top >= height) continue;

      const target = selector(element);
      const clipped = clippedByScrollArea(element, rect);
      if (!clipped && (rect.left < 0 || rect.top < 0 || rect.right > width || rect.bottom > height)) {
        issues.push(`${stageName}: ${target} outside viewport (${Math.round(rect.left)},${Math.round(rect.top)} ${Math.round(rect.width)}x${Math.round(rect.height)})`);
      }

      if (element.matches("button, a[href], input, select, textarea, [role='button']") && (rect.width < 44 || rect.height < 44)) {
        issues.push(`${stageName}: ${target} smaller than 44x44 (${Math.round(rect.width)}x${Math.round(rect.height)})`);
      }

      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;
      if (!clipped && centerX >= 0 && centerX < width && centerY >= 0 && centerY < height) {
        const hit = document.elementFromPoint(centerX, centerY);
        if (!hit || !(hit === element || element.contains(hit))) {
          issues.push(`${stageName}: ${target} covered at center by ${hit ? selector(hit) : "nothing"}`);
        }
      }
    }

    for (const element of document.querySelectorAll("body *")) {
      if (!(element instanceof HTMLElement) || element.getAttribute("aria-hidden") === "true") continue;
      if (activeLayer && !activeLayer.contains(element)) continue;
      if (!element.checkVisibility({ checkOpacity: true })) continue;
      const hasOwnText = [...element.childNodes].some(
        (node) => node.nodeType === Node.TEXT_NODE && !!node.textContent?.trim(),
      );
      if (!hasOwnText) continue;
      const fontSize = Number.parseFloat(getComputedStyle(element).fontSize);
      if (fontSize < 12) issues.push(`${stageName}: ${selector(element)} text below 12px (${fontSize}px)`);
    }

    const visible = (selectorText: string) => [...document.querySelectorAll(selectorText)]
      .filter((element) => element instanceof HTMLElement && element.checkVisibility({ checkOpacity: true }));
    const modalOpen = activeLayer !== undefined;
    const panels = modalOpen ? [] : visible(".base-badge, .resources, .crew, .side, .build, .build-dock, .zoom, .task-toast");
    if (!modalOpen) {
      for (let i = 0; i < panels.length; i++) {
        const a = panels[i].getBoundingClientRect();
        for (let j = i + 1; j < panels.length; j++) {
          const b = panels[j].getBoundingClientRect();
          if (a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top) {
            issues.push(`${stageName}: ${selector(panels[i])} (${Math.round(a.x)},${Math.round(a.y)} ${Math.round(a.width)}x${Math.round(a.height)}) overlaps ${selector(panels[j])} (${Math.round(b.x)},${Math.round(b.y)} ${Math.round(b.width)}x${Math.round(b.height)})`);
          }
        }
      }
    }

    if (!modalOpen) {
      const timer = document.querySelector('[role="timer"]')?.getBoundingClientRect();
      const resources = visible(".resource").map((element) => element.getBoundingClientRect());
      const taskCards = visible(".tasks__list .task, .task-toast");
      for (const task of taskCards) {
        const taskRect = task.getBoundingClientRect();
        if (timer && taskRect.left < timer.right && taskRect.right > timer.left && taskRect.top < timer.bottom && taskRect.bottom > timer.top) {
          issues.push(`${stageName}: ${selector(task)} overlaps the day timer`);
        }
        resources.forEach((resource, index) => {
          if (taskRect.left < resource.right && taskRect.right > resource.left && taskRect.top < resource.bottom && taskRect.bottom > resource.top) {
            issues.push(`${stageName}: ${selector(task)} overlaps resource badge ${index + 1}`);
          }
        });
      }
    }

    return issues;
  }, stage);
}

async function hidePortraitHintForLayoutInspection(page: Page) {
  await page.addStyleTag({ content: ".rotate-hint { display: none !important; }" });
}

async function snapshot(page: Page, testInfo: TestInfo, viewportName: string, stage: string): Promise<string[]> {
  const issues = await checkLayout(page, stage);
  const screenshotPath = testInfo.outputPath(`${viewportName}-${stage}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true, animations: "disabled" });
  await testInfo.attach(`${viewportName}-${stage}`, { path: screenshotPath, contentType: "image/png" });
  return issues.map((issue) => `${viewportName}: ${issue}`);
}

async function resumeWithState(page: Page, updates: Partial<GameState>) {
  await page.evaluate(async (stateUpdates) => {
    const enginePath = "/src/engine/index.ts";
    const storagePath = "/src/session/storage.ts";
    const [{ initialState }, { saveGame }] = await Promise.all([
      import(enginePath),
      import(storagePath),
    ]);
    saveGame({ ...initialState(901, "normal"), ...stateUpdates });
  }, updates);
  await page.reload();
  await hidePortraitHintForLayoutInspection(page);
  const continueButton = page.getByRole("button", { name: /Продолжить игру/ });
  await expect(continueButton).toBeVisible();
  await continueButton.tap();
  await expect(page.getByRole("timer")).toBeVisible();
}

test.describe("responsive viewport journeys", () => {
  test.use({ isMobile: true, hasTouch: true });

  for (const viewport of viewports) {
    test(`menu through placement at ${viewport.name}`, async ({ page }, testInfo) => {
      test.setTimeout(60_000);
      await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/");
      await hidePortraitHintForLayoutInspection(page);

      const issues: string[] = [];
      issues.push(...await snapshot(page, testInfo, viewport.name, "menu"));

      await page.getByRole("button", { name: "Данные NASA" }).tap();
      await expect(page.getByRole("heading", { name: "Данные NASA" })).toBeVisible();
      issues.push(...await snapshot(page, testInfo, viewport.name, "nasa-data"));
      await page.getByRole("button", { name: "Закрыть" }).tap();

      await page.getByRole("button", { name: "Новая игра" }).tap();
      await page.getByRole("button", { name: /Обычный/ }).tap();
      await expect(page.getByRole("button", { name: "Пропустить" })).toBeVisible();
      issues.push(...await snapshot(page, testInfo, viewport.name, "prologue"));

      await page.getByRole("button", { name: "Пропустить" }).tap();
      await expect(page.getByRole("heading", { name: "Как играть" })).toBeVisible();
      issues.push(...await snapshot(page, testInfo, viewport.name, "rules"));

      await page.getByRole("button", { name: "Начать миссию" }).tap();
      await expect(page.getByRole("timer")).toBeVisible();
      issues.push(...await snapshot(page, testInfo, viewport.name, "mission"));

      await page.getByRole("button", { name: "Строительство" }).tap();
      const moduleList = page.locator(".build__list");
      issues.push(...await snapshot(page, testInfo, viewport.name, "build-menu"));
      await expect(page.locator(".build-toggle")).toHaveAttribute("aria-expanded", "true");
      await expect(page.getByRole("region", { name: "Строительство" })).toBeVisible();

      const scrollMetrics = await moduleList.evaluate((element) => ({
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        touchAction: getComputedStyle(element).touchAction,
      }));
      if (viewport.width <= 900 || viewport.height <= 620) {
        expect(scrollMetrics.scrollWidth).toBeGreaterThan(scrollMetrics.clientWidth);
        expect(scrollMetrics.touchAction).toBe("pan-x");
        const bounds = await moduleList.boundingBox();
        if (!bounds) throw new Error("The module list is not measurable");
        const cdp = await page.context().newCDPSession(page);
        try {
          const x = bounds.x + bounds.width - 12;
          const y = bounds.y + bounds.height / 2;
          await cdp.send("Input.dispatchTouchEvent", {
            type: "touchStart",
            touchPoints: [{ id: 1, x, y, radiusX: 4, radiusY: 4, force: 1 }],
          });
          await cdp.send("Input.dispatchTouchEvent", {
            type: "touchMove",
            touchPoints: [{ id: 1, x: x - Math.min(140, bounds.width / 2), y, radiusX: 4, radiusY: 4, force: 1 }],
          });
          await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
          await expect.poll(() => moduleList.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
        } finally {
          await cdp.detach();
        }
        await moduleList.evaluate((element) => { element.scrollLeft = 0; });
      }

      await page.getByRole("button", { name: /^Солнечные панели/ }).tap();
      await expect(page.getByRole("button", { name: "Отменить постройку" })).toBeVisible();
      if (viewport.width <= 900 || viewport.height <= 620) {
        await expect(page.locator(".detail")).toBeHidden();
      }
      issues.push(...await snapshot(page, testInfo, viewport.name, "location-selection"));
      expect(issues, `${viewport.name} layout`).toEqual([]);

      const modulesBeforePlace = await page.locator(".map-svg .module-art").count();
      const tilePoint = await page.locator(".tile-ok").evaluateAll((tiles) => {
        for (const tile of tiles) {
          const bounds = tile.getBoundingClientRect();
          const x = bounds.left + bounds.width / 2;
          const y = bounds.top + bounds.height / 2;
          if (x < 0 || y < 0 || x >= innerWidth || y >= innerHeight) continue;
          const hit = document.elementFromPoint(x, y);
          if (hit?.tagName.toLowerCase() === "polygon" && !hit.classList.contains("tile-ok")) return { x, y };
        }
        return null;
      });
      if (!tilePoint) throw new Error("No unobstructed build tile is visible for the double-tap check");
      await page.touchscreen.tap(tilePoint.x, tilePoint.y);
      await page.touchscreen.tap(tilePoint.x, tilePoint.y);
      await expect(page.locator(".map-svg .module-art")).toHaveCount(modulesBeforePlace + 1);
      await expect(page.locator(".tile-ok")).toHaveCount(0);
    });

    test(`event layout at ${viewport.name}`, async ({ page }, testInfo) => {
      await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/");
      await hidePortraitHintForLayoutInspection(page);
      await resumeWithState(page, { day: 9, activeEvent: "flare" });
      await expect(page.locator(".modal--event")).toBeVisible();
      const issues = await snapshot(page, testInfo, viewport.name, "event");
      expect(issues, `${viewport.name} event layout`).toEqual([]);
    });

    test(`daily summary layout at ${viewport.name}`, async ({ page }, testInfo) => {
      await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/");
      await hidePortraitHintForLayoutInspection(page);
      await resumeWithState(page, { day: 1, clockMs: 119_900 });
      await page.clock.fastForward(1_000);
      if (!(await page.locator(".daysum").isVisible())) await page.clock.fastForward(1_000);
      await expect(page.locator(".daysum")).toBeVisible();
      await page.locator(".daysum").evaluate(async (element) => {
        await Promise.all(element.getAnimations().map((animation) => animation.finished));
      });
      const issues = await snapshot(page, testInfo, viewport.name, "daily-summary");
      expect(issues, `${viewport.name} daily summary layout`).toEqual([]);
    });

    test(`final layout at ${viewport.name}`, async ({ page }, testInfo) => {
      await page.clock.install({ time: new Date("2026-01-01T00:00:00Z") });
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.goto("/");
      await hidePortraitHintForLayoutInspection(page);
      await resumeWithState(page, { day: 20, clockMs: 119_900 });
      await page.clock.fastForward(1_000);
      if (!(await page.locator(".ending-scene").isVisible())) await page.clock.fastForward(1_000);
      await expect(page.locator(".ending-scene")).toBeVisible();
      for (let frame = 0; frame < 20 && !(await page.locator(".end-sub").isVisible()); frame++) {
        await page.clock.fastForward(60_000);
      }
      await expect(page.locator(".end-sub")).toBeVisible();
      const issues = await snapshot(page, testInfo, viewport.name, "final");
      expect(issues, `${viewport.name} ending layout`).toEqual([]);
    });
  }
});

test("portrait phone keeps the rotate-device hint", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => localStorage.setItem("moonbase:lang", JSON.stringify("uk")));
  await page.goto("/");
  await expect(page.getByRole("alert").getByText("Поверни пристрій горизонтально")).toBeVisible();
});
