import { test, expect } from "@playwright/test";
import { createBookingAsCustomer, getState, acceptAndCompleteLatestBooking } from "./helpers";

const locationText = "طنجة - E2E Review Test";
const reviewComment = "[maak_e2e_test] مراجعة تلقائية للحجز المكتمل.";

test("customer rates a completed booking and the review appears on the provider page", async ({ page, browser }) => {
  const state = getState();

  await createBookingAsCustomer(page, locationText);

  const providerContext = await browser.newContext();
  const providerPage = await providerContext.newPage();
  try {
    await acceptAndCompleteLatestBooking(providerPage, locationText);
  } finally {
    await providerContext.close();
  }

  await page.goto("/bookings");
  const booking = page.locator(".booking-card").filter({ hasText: locationText }).first();
  await expect(booking).toBeVisible();
  await expect(booking).toContainText(/completed|مكتمل|تم إكمال|terminée/i);

  const rateButton = booking.getByRole("button", { name: /Rate service|تقييم الخدمة|Évaluation du service/i });
  await expect(rateButton).toBeVisible();
  await rateButton.click();

  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "5/5" }).click();
  await page.locator("#review-comment").fill(reviewComment);
  await page.getByRole("button", { name: /Submit review|إرسال التقييم|Envoyer l’avis/i }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.goto(`/provider/${state.provider.listingId}`);
  await expect(page.getByText(reviewComment)).toBeVisible();
  await expect(page.locator(".review-stars").first()).toContainText("★");
});
