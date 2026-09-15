import { test, expect, type Page } from "@playwright/test";
import { loginAdmin } from "./helpers";

const DESKTOP_1904 = { width: 1904, height: 1044 };
const DESKTOP_1440 = { width: 1440, height: 900 };
const MOBILE_390 = { width: 390, height: 844 };

async function noHorizontalOverflow(page: Page): Promise<void> {
  const metrics = await page.evaluate(() => ({ scrollWidth: document.documentElement.scrollWidth, clientWidth: document.documentElement.clientWidth }));
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);
}

async function noCriticalClipping(page: Page, selectors: string[]): Promise<void> {
  const issues = await page.evaluate((inputSelectors) => {
    const found: string[] = [];
    for (const selector of inputSelectors) {
      const element = document.querySelector(selector) as HTMLElement | null;
      if (!element) continue;
      const child = element.getBoundingClientRect();
      let parent = element.parentElement;
      while (parent) {
        const parentRect = parent.getBoundingClientRect();
        const style = getComputedStyle(parent);
        const clips = [style.overflow, style.overflowX, style.overflowY].some((value) => value === "hidden" || value === "clip");
        if (clips && (child.left < parentRect.left - 1 || child.right > parentRect.right + 1 || child.top < parentRect.top - 1 || child.bottom > parentRect.bottom + 1)) {
          found.push(`${selector} clipped by ${parent.className || parent.tagName}`);
          break;
        }
        parent = parent.parentElement;
      }
    }
    return found;
  }, selectors);
  expect(issues).toEqual([]);
}

function watchBrandResponses(page: Page): string[] {
  const failures: string[] = [];
  page.on("response", (response) => {
    const url = response.url();
    if (/(maak-|icon-192|icon-512|manifest\.webmanifest)/i.test(url) && response.status() >= 400) failures.push(`${response.status()} ${url}`);
  });
  return failures;
}

async function screenshot(page: Page, name: string): Promise<void> {
  await page.screenshot({ path: `test-results/${name}.png`, fullPage: true });
}

async function verifyBrandRuntime(page: Page): Promise<void> {
  const images = page.locator("img.brand");
  await expect(images.first()).toBeVisible();
  const states = await images.evaluateAll((nodes) => nodes.map((image) => {
    const box = image.getBoundingClientRect();
    return { src: image.getAttribute("src") ?? "", naturalWidth: image.naturalWidth, naturalHeight: image.naturalHeight, renderedWidth: box.width, renderedHeight: box.height };
  }));
  expect(states.length).toBeGreaterThan(0);
  expect(states.every((image) => image.naturalWidth > 0 && image.naturalHeight > 0)).toBe(true);
  expect(states.every((image) => /maak-(lockup-light|lockup-dark|icon)/.test(image.src))).toBe(true);
  for (const image of states) {
    expect(Math.abs(image.naturalWidth / image.naturalHeight - image.renderedWidth / image.renderedHeight)).toBeLessThan(0.08);
  }
}

async function verifyPwaAssets(page: Page): Promise<void> {
  const links = await page.locator('link[rel="icon"], link[rel="apple-touch-icon"], link[rel="manifest"]').evaluateAll((nodes) => nodes.map((node) => node.getAttribute("href") ?? ""));
  expect(links.some((href) => href.includes("icon-192.png"))).toBe(true);
  expect(links.some((href) => href.includes("manifest.webmanifest"))).toBe(true);
  for (const path of ["/icon-192.png", "/icon-512.png", "/manifest.webmanifest"]) {
    const response = await page.request.get(new URL(path, page.url()).toString());
    expect(response.status(), path).toBe(200);
  }
}

async function assertNavContained(page: Page): Promise<void> {
  const nav = page.locator(".desktop-nav");
  await expect(nav).toBeVisible();
  const navBox = await nav.boundingBox();
  expect(navBox).not.toBeNull();
  const children = nav.locator("a,button");
  const count = await children.count();
  for (let index = 0; index < count; index += 1) {
    const box = await children.nth(index).boundingBox();
    if (!box) continue;
    expect(box.x).toBeGreaterThanOrEqual(navBox!.x - 1);
    expect(box.x + box.width).toBeLessThanOrEqual(navBox!.x + navBox!.width + 1);
  }
}

test.describe("P0 visual proof matrix", () => {
  test("required responsive viewport matrix is real-browser green", async ({ page }) => {
    const viewports = [
      { width: 360, height: 800, name: "360x800" }, { width: 390, height: 844, name: "390x844" }, { width: 430, height: 932, name: "430x932" },
      { width: 768, height: 1024, name: "768x1024" }, { width: 1280, height: 800, name: "1280x800" }, { width: 1440, height: 900, name: "1440x900" }, { width: 1904, height: 1044, name: "1904x1044" },
    ];
    for (const viewport of viewports) {
      await page.setViewportSize(viewport);
      await page.goto("/");
      await expect(page.locator(".app")).toBeVisible();
      await noHorizontalOverflow(page);
      await noCriticalClipping(page, [".home", ".home-intro", ".home-prompt", ".desktop-nav", ".mobile-nav"]);
      if (viewport.width <= 430) {
        await expect(page.locator(".mobile-nav")).toBeVisible();
        await expect(page.locator(".desktop-nav")).toBeHidden();
      } else {
        await expect(page.locator(".desktop-nav")).toBeVisible();
        await expect(page.locator(".mobile-nav")).toBeHidden();
      }
      if (viewport.name === "1904x1044") await screenshot(page, "p0-customer-home-1904x1044");
      if (viewport.name === "1440x900") await screenshot(page, "p0-customer-home-1440x900");
      if (viewport.name === "390x844") await screenshot(page, "p0-customer-home-390x844");
      if (viewport.name === "768x1024") await screenshot(page, "p0-tablet-768x1024");
    }
  });

  test("desktop discover and bookings use the viewport instead of a phone island", async ({ page }) => {
    await page.setViewportSize(DESKTOP_1904);
    for (const route of ["/discover", "/bookings"]) {
      await page.goto(route);
      await expect(page.locator(".screen").first()).toBeVisible();
      const box = await page.locator(".screen").first().boundingBox();
      expect(box?.width ?? 0).toBeGreaterThan(900);
      await noHorizontalOverflow(page);
      await noCriticalClipping(page, [".screen", ".desktop-nav"]);
      await screenshot(page, route === "/discover" ? "p0-discover-desktop-1904x1044" : "p0-bookings-desktop-1904x1044");
    }
  });

  test("auth layouts stay wide on desktop and usable on mobile", async ({ page }) => {
    await page.setViewportSize(DESKTOP_1904);
    for (const route of ["/login", "/register"]) {
      await page.goto(route);
      await expect(page.locator(".auth-main")).toBeVisible();
      const card = await page.locator(".auth-card").boundingBox();
      expect(card?.width ?? 0).toBeGreaterThanOrEqual(380);
      expect(card?.height ?? 0).toBeGreaterThan(300);
      expect(Math.abs(((card?.x ?? 0) + (card?.width ?? 0) / 2) - DESKTOP_1904.width / 2)).toBeLessThan(140);
      await noHorizontalOverflow(page);
      await noCriticalClipping(page, [".auth-main", ".auth-card"]);
      await screenshot(page, route === "/login" ? "p0-login-fr-ltr-desktop-1904x1044" : "p0-register-desktop-1904x1044");
    }
    await page.setViewportSize(MOBILE_390);
    await page.goto("/register");
    await expect(page.locator(".auth-main .auth-card")).toBeVisible();
    const mobileCard = await page.locator(".auth-card").boundingBox();
    expect(mobileCard?.width ?? 0).toBeLessThanOrEqual(MOBILE_390.width - 24);
    await noHorizontalOverflow(page);
    await screenshot(page, "p0-register-mobile-390x844");
    await page.goto("/login");
    await expect(page.locator("html")).toHaveAttribute("lang", "ar");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await screenshot(page, "p0-login-ar-rtl-390x844");
    await page.locator(".lang-toggle-btn").click();
    await expect(page.locator("html")).toHaveAttribute("lang", "fr");
    await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
    await noHorizontalOverflow(page);
  });

  test("branding, favicon, manifest, PWA icons, and legacy placeholder are clean", async ({ page }) => {
    const failures = watchBrandResponses(page);
    await page.setViewportSize(DESKTOP_1904);
    await page.goto("/login");
    await verifyBrandRuntime(page);
    await verifyPwaAssets(page);
    await expect(page.locator("body")).not.toContainText("m / maak.");
    await page.goto("/");
    await expect(page.locator(".desktop-nav")).toBeVisible();
    await assertNavContained(page);
    const bodyText = await page.locator("body").innerText();
    expect(bodyText).not.toContain("m / maak.");
    expect(failures).toEqual([]);
  });

  test("admin login direct/refresh and browser history never render blank", async ({ page }) => {
    const failures = watchBrandResponses(page);
    await page.setViewportSize(DESKTOP_1904);
    await page.goto("/admin/login");
    await expect(page.locator(".admin-auth-screen .auth-card")).toBeVisible();
    await verifyBrandRuntime(page);
    await page.reload();
    await expect(page.locator(".admin-auth-screen .auth-card")).toBeVisible();
    await page.goto("/login");
    await page.goto("/admin/login");
    await expect(page.locator(".admin-auth-screen .auth-card")).toBeVisible();
    await page.goBack();
    await expect(page.locator(".auth-main .auth-card")).toBeVisible();
    await page.goForward();
    await expect(page.locator(".admin-auth-screen .auth-card")).toBeVisible();
    await noHorizontalOverflow(page);
    expect(failures).toEqual([]);
    await screenshot(page, "p0-admin-login-1904x1044");
  });

  test("admin dashboard and sidebar use official artwork and stay contained", async ({ page }) => {
    await page.setViewportSize(DESKTOP_1904);
    await loginAdmin(page);
    await expect(page.locator(".m2-shell")).toBeVisible();
    await expect(page.getByRole("heading", { name: /Maak Control Center\./i })).toBeVisible();
    await noHorizontalOverflow(page);
    await noCriticalClipping(page, [".m2-shell", ".m2-sidebar", ".m2-main", ".m2-hero"]);
    const backgroundImage = await page.locator(".m2-brand-row").evaluate((element) => getComputedStyle(element, "::before").backgroundImage);
    expect(backgroundImage).toMatch(/maak-lockup-dark|maak-icon/);
    await expect(page.locator(".m2-brand-row")).not.toContainText("maak.");
    await screenshot(page, "p0-admin-dashboard-1904x1044");
    await page.locator(".m2-sidebar").screenshot({ path: "test-results/p0-admin-sidebar-branding-1904x1044.png" });
  });

  test("blank route renders a real NotFound surface, not a blank page", async ({ page }) => {
    await page.setViewportSize(DESKTOP_1440);
    await page.goto("/this-route-does-not-exist");
    await expect(page.locator("#not-found-title")).toBeVisible();
    await expect(page.locator("#not-found-title")).toContainText("الصفحة غير موجودة");
    await noHorizontalOverflow(page);
  });
});
