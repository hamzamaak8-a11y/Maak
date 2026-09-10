import { test, expect } from "@playwright/test";
import { getState, loginAdmin } from "./helpers";

test("admin opens the dashboard and can see hidden reviews", async ({ page }) => {
  const state = getState();

  await loginAdmin(page);
  await expect(page.getByRole("heading", { name: /Maak Control Center\./i })).toBeVisible();

  await page.getByRole("button", { name: /^Reviews$/i }).click();
  await expect(page.getByRole("heading", { name: /Review moderation/i })).toBeVisible();

  const reviewRow = page.locator("tbody tr").filter({ hasText: "[maak_e2e_seed]" }).first();
  await expect(reviewRow).toBeVisible();
  await expect(reviewRow).toContainText("[maak_e2e_seed] هذا تقييم مخفي للاختبار الآلي.");
  await expect(reviewRow.getByRole("button", { name: "Show" })).toBeVisible();
  await expect(page.getByText(state.hiddenReview.reviewId.slice(0, 8))).toHaveCount(0);
});
