import { test, expect } from "@playwright/test";

test.describe("production runtime gates", () => {
  test("anonymous visitors see the bookings authentication gate", async ({ page }) => {
    await page.goto("/bookings");
    await expect(page.locator(".auth-gate")).toBeVisible();
    await expect(page.locator(".auth-gate").getByRole("button", { name: /sign in|تسجيل الدخول|connexion/i })).toBeVisible();
  });

  test("anonymous visitors are redirected from chat to login", async ({ page }) => {
    await page.goto("/chat");
    await expect(page).toHaveURL(/\/login\/?$/);
  });

  test("unknown routes render a real not-found surface", async ({ page }) => {
    await page.goto("/definitely-not-a-real-maak-route");
    await expect(page.getByRole("heading", { name: /الصفحة غير موجودة/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /العودة للرئيسية/i })).toBeVisible();
  });
});
