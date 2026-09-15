import { test, expect, type Page } from "@playwright/test";

async function noHorizontalOverflow(page: Page): Promise<void> {
  const metrics = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
}

async function screenshot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: `test-results/${name}.png`, fullPage: true });
}

test.describe("P0 visual/runtime recovery", () => {
  test("customer desktop uses the viewport instead of a phone-width island", async ({ page }) => {
    for (const viewport of [
      { width: 1280, height: 800, name: "1280x800" },
      { width: 1440, height: 900, name: "1440x900" },
      { width: 1904, height: 1044, name: "1904x1044" },
    ]) {
      await page.setViewportSize(viewport);
      await page.goto("/");
      await page.waitForLoadState("domcontentloaded");
      await expect(page.locator(".app:not(.provider-app)")).toBeVisible();
      await expect(page.locator(".desktop-nav")).toBeVisible();
      await expect(page.locator(".mobile-nav")).toBeHidden();

      const shell = await page.locator(".app:not(.provider-app)").boundingBox();
      const screen = await page.locator(".screen, .home").first().boundingBox();
      expect(shell?.width ?? 0).toBeGreaterThan(viewport.width * 0.9);
      expect(screen?.width ?? 0).toBeGreaterThan(900);
      await noHorizontalOverflow(page);
      await screenshot(page, `p0-home-${viewport.name}`);
    }
  });

  test("login and register remain stable on the real desktop viewport", async ({ page }) => {
    await page.setViewportSize({ width: 1904, height: 1044 });

    for (const route of ["/login", "/register"]) {
      await page.goto(route);
      await page.waitForLoadState("domcontentloaded");
      await expect(page.locator(".auth-main")).toBeVisible();
      const card = await page.locator(".auth-card").boundingBox();
      const authMain = await page.locator(".auth-main").boundingBox();
      expect(card?.width ?? 0).toBeGreaterThanOrEqual(380);
      expect(card?.height ?? 0).toBeGreaterThan(300);
      expect(card).not.toBeNull();
      expect(authMain).not.toBeNull();
      expect(card!.x).toBeGreaterThanOrEqual(authMain!.x - 1);
      expect(card!.x + card!.width).toBeLessThanOrEqual(authMain!.x + authMain!.width + 1);
      await noHorizontalOverflow(page);
      await screenshot(page, `p0-${route.slice(1)}-1904x1044`);
    }
  });

  test("home hero stays inside its desktop container", async ({ page }) => {
    await page.setViewportSize({ width: 1904, height: 1044 });
    await page.goto("/");
    const hero = page.locator(".home-intro");
    const heading = page.locator(".home-prompt");
    await expect(hero).toBeVisible();
    await expect(heading).toBeVisible();
    const heroBox = await hero.boundingBox();
    const headingBox = await heading.boundingBox();
    expect(heroBox).not.toBeNull();
    expect(headingBox).not.toBeNull();
    expect(headingBox!.x).toBeGreaterThanOrEqual(heroBox!.x - 1);
    expect(headingBox!.y).toBeGreaterThanOrEqual(heroBox!.y - 1);
    expect(headingBox!.x + headingBox!.width).toBeLessThanOrEqual(heroBox!.x + heroBox!.width + 1);
    expect(headingBox!.y + headingBox!.height).toBeLessThanOrEqual(heroBox!.y + heroBox!.height + 1);
    await screenshot(page, "p0-home-hero-1904x1044");
  });

  test("discover and bookings occupy deliberate desktop content space", async ({ page }) => {
    await page.setViewportSize({ width: 1904, height: 1044 });
    for (const route of ["/discover", "/bookings"]) {
      await page.goto(route);
      await expect(page.locator(".screen").first()).toBeVisible();
      const box = await page.locator(".screen").first().boundingBox();
      expect(box?.width ?? 0).toBeGreaterThan(900);
      await noHorizontalOverflow(page);
      await screenshot(page, `p0-${route.slice(1)}-1904x1044`);
    }
  });

  test("mobile navigation keeps all five actions inside the dock", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/");
    const nav = page.locator(".mobile-nav");
    await expect(nav).toBeVisible();
    const navBox = await nav.boundingBox();
    const items = nav.locator("button");
    await expect(items).toHaveCount(5);
    for (let index = 0; index < 5; index += 1) {
      const box = await items.nth(index).boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual((navBox?.x ?? 0) - 1);
      expect(box!.x + box!.width).toBeLessThanOrEqual((navBox?.x ?? 0) + (navBox?.width ?? 0) + 1);
    }
    await noHorizontalOverflow(page);
    await screenshot(page, "p0-home-mobile-390x844");
  });

  test("admin login direct load, refresh, and history navigation never render blank", async ({ page }) => {
    await page.setViewportSize({ width: 1904, height: 1044 });
    await page.goto("/admin/login");
    await expect(page.locator(".admin-auth-screen .auth-card")).toBeVisible();
    await page.reload();
    await expect(page.locator(".admin-auth-screen .auth-card")).toBeVisible();

    await page.goto("/login");
    await page.evaluate(() => {
      window.history.pushState({}, "", "/admin/login");
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    await expect(page.locator(".admin-auth-screen .auth-card")).toBeVisible();
    await page.goBack();
    await expect(page.locator(".auth-main .auth-card")).toBeVisible();
    await page.goForward();
    await expect(page.locator(".admin-auth-screen .auth-card")).toBeVisible();
    await screenshot(page, "p0-admin-login-1904x1044");
  });

  test("official brand images load and language direction follows the active locale", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/login");
    const brandedImages = page.locator("img.brand");
    await expect(brandedImages.first()).toBeVisible();
    const imageState = await brandedImages.evaluateAll((images) => images.map((image) => ({
      naturalWidth: image.naturalWidth,
      naturalHeight: image.naturalHeight,
      src: image.getAttribute("src") ?? "",
    })));
    expect(imageState.length).toBeGreaterThan(0);
    expect(imageState.every((image) => image.naturalWidth > 0 && image.naturalHeight > 0)).toBe(true);
    expect(imageState.every((image) => image.src.includes("maak-lockup-light") || image.src.includes("maak-icon"))).toBe(true);

    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await screenshot(page, "p0-login-rtl-390x844");

    await page.locator(".lang-toggle-btn").click();
    await expect(page.locator("html")).toHaveAttribute("lang", "fr");
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    await noHorizontalOverflow(page);
    await screenshot(page, "p0-login-ltr-390x844");
  });
});
