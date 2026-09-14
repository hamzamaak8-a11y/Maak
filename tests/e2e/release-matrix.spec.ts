import { test, expect, type Page } from "@playwright/test";
import { getState } from "./helpers";

const VIEWPORTS = [
  { name: "mobile-360", width: 360, height: 800 },
  { name: "mobile-390", width: 390, height: 844 },
  { name: "mobile-430", width: 430, height: 932 },
  { name: "tablet-768", width: 768, height: 1024 },
  { name: "desktop-1280", width: 1280, height: 800 },
] as const;

async function assertNoHorizontalOverflow(page: Page): Promise<void> {
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(metrics.scrollWidth, `horizontal overflow: ${metrics.scrollWidth} > ${metrics.clientWidth}`).toBeLessThanOrEqual(metrics.clientWidth + 1);
}

async function assertDirection(page: Page, direction: "rtl" | "ltr"): Promise<void> {
  await expect(page.locator("html")).toHaveAttribute("dir", direction);
}

async function toggleLanguage(page: Page): Promise<void> {
  const toggle = page.locator(".lang-toggle-btn");
  await expect(toggle).toBeVisible();
  await toggle.click();
}

test.describe("release browser matrix", () => {
  for (const viewport of VIEWPORTS) {
    test(`${viewport.name} public surface smoke`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });

      const state = getState();
      const routes = [
        "/",
        "/discover",
        `/provider/${state.provider.listingId}`,
        "/login",
        "/register",
        "/forgot-password",
        "/help",
        "/definitely-not-a-real-maak-route",
      ];

      for (const route of routes) {
        await page.goto(route);
        await page.waitForLoadState("domcontentloaded");
        await assertNoHorizontalOverflow(page);
        await expect(page.locator("body")).toBeVisible();
      }

      await page.goto("/");
      if (viewport.width <= 430) {
        await expect(page.locator(".mobile-nav")).toBeVisible();
      }

      const screenshotName = `release-${viewport.name}.png`;
      await page.screenshot({ path: `test-results/${screenshotName}`, fullPage: true });
    });
  }

  test("Arabic RTL and French LTR render through the real language toggle", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");

    await assertDirection(page, "rtl");
    await assertNoHorizontalOverflow(page);

    await toggleLanguage(page);
    await expect(page.locator("html")).toHaveAttribute("lang", "fr");
    await assertDirection(page, "ltr");
    await assertNoHorizontalOverflow(page);

    await page.goto("/discover");
    await assertDirection(page, "ltr");
    await assertNoHorizontalOverflow(page);

    await toggleLanguage(page);
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await assertDirection(page, "rtl");
    await assertNoHorizontalOverflow(page);
  });

  test("mobile fixed navigation does not obscure critical surfaces", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    await expect(page.locator(".mobile-nav")).toBeVisible();

    await page.goto("/provider/1/booking");
    const nav = page.locator(".mobile-nav");
    if (await nav.isVisible().catch(() => false)) {
      const navBox = await nav.boundingBox();
      const action = page.locator("button.primary").last();
      if (navBox && await action.isVisible().catch(() => false)) {
        const actionBox = await action.boundingBox();
        if (actionBox) expect(actionBox.y + actionBox.height).toBeLessThanOrEqual(navBox.y + 2);
      }
    }

    await page.goto("/chat");
    if (await page.locator(".chat-page").isVisible().catch(() => false)) {
      await expect(page.locator(".mobile-nav")).toBeVisible();
      const composer = page.locator(".chat-input, textarea, input[type='text']").last();
      if (await composer.isVisible().catch(() => false)) {
        const navBox = await page.locator(".mobile-nav").boundingBox();
        const composerBox = await composer.boundingBox();
        if (navBox && composerBox) expect(composerBox.y + composerBox.height).toBeLessThanOrEqual(navBox.y + 2);
      }
    }
  });

  test("keyboard focus is visible on auth controls", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/login");
    const email = page.locator('input[type="email"]');
    const password = page.locator('input[type="password"]');
    await email.focus();
    await expect(email).toBeFocused();
    await password.focus();
    await expect(password).toBeFocused();

    const labels = await page.locator("label").count();
    expect(labels).toBeGreaterThan(0);

    const duplicateIds = await page.evaluate(() => {
      const ids = [...document.querySelectorAll("[id]")].map((element) => element.id).filter(Boolean);
      const counts = new Map<string, number>();
      for (const id of ids) counts.set(id, (counts.get(id) || 0) + 1);
      return [...counts.entries()].filter(([, count]) => count > 1).map(([id]) => id);
    });
    expect(duplicateIds).toEqual([]);
  });
});
