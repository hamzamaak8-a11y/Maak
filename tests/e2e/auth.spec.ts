import { test, expect } from "@playwright/test";
import { loginCustomer, loginProvider } from "./helpers";

test.describe("authentication", () => {
  test("customer can sign in successfully", async ({ page }) => {
    await loginCustomer(page);
    await expect(page.getByRole("button", { name: /Account|الحساب|Compte/i })).toBeVisible();
  });

  test("provider can sign in and open provider workspace", async ({ page }) => {
    await loginProvider(page);
    await page.goto("/provider-mode");
    await expect(page).toHaveURL(/\/provider-mode\/?$/);
    await expect(page.getByText(/service requests|طلبات الخدمة|demandes de service/i).first()).toBeVisible();
    await expect(page.locator(".provider-side")).toBeVisible();
  });
});
