import { test, expect } from "@playwright/test";
import { getState, loginAdmin } from "./helpers";

test("admin opens the dashboard and can see hidden reviews", async ({ page }) => {
  const state = getState();

  await loginAdmin(page);
  await expect(page.getByRole("heading", { name: /Maak Control Center\./i })).toBeVisible();

  await page.getByRole("button", { name: /^Reviews$/i }).click();
  await expect(page.getByRole("heading", { name: /Review moderation/i })).toBeVisible();
  await expect(page.getByText(state.hiddenReview.reviewId.slice(0, 8))).toHaveCount(0);
  await expect(page.getByText("[maak_e2e_seed] هذا تقييم مخفي للاختبار الآلي.")).toBeVisible();
  await expect(page.getByText("Hide").or(page.getByText("Show"))).toBeVisible();
  await expect(page.locator("tbody tr").filter({ hasText: "[maak_e2e_seed]" }).first()).toBeVisible();
});
