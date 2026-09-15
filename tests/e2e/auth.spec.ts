import { test, expect } from "@playwright/test";
import { loginCustomer, loginProvider } from "./helpers";

test.describe("authentication", () => {
  test("customer can sign in successfully", async ({ page }) => {
    await loginCustomer(page);
    await expect(page.getByText(/حسابي|Mon compte|Account|Compte/i).first()).toBeVisible();
  });

  test("provider can sign in and open provider workspace", async ({ page }) => {
    await loginProvider(page);
    await page.goto("/provider-mode");
    await expect(page).toHaveURL(/\/provider-mode\/?$/);
    await expect(page.locator(".provider-side")).toBeVisible();
    await expect(page.getByRole("heading", { name: /لوحة مقدم الخدمة|Tableau du prestataire|provider dashboard|tableau de bord/i })).toBeVisible();
    await expect(page.getByText(/آخر النشاطات|مواعيد|الخدمة|نشاطات|activité|rendez-vous|service/i).first()).toBeVisible();
  });
});
