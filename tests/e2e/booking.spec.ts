import { test, expect } from "@playwright/test";
import { createBookingAsCustomer, getState, loginProvider } from "./helpers";

test("customer selects an available slot, submits a booking, and provider accepts it", async ({ page, browser }) => {
  const state = getState();

  await createBookingAsCustomer(page);
  await expect(page.locator(".booking-success")).toContainText(/pending|معلّق|قيد الانتظار|en attente/i);

  const providerContext = await browser.newContext();
  const providerPage = await providerContext.newPage();
  try {
    await loginProvider(providerPage);
    await providerPage.goto("/provider-mode");
    await expect(providerPage.locator(".request-row").filter({ hasText: "طنجة - E2E Test Location" }).first()).toBeVisible();
    const request = providerPage.locator(".request-row").filter({ hasText: "طنجة - E2E Test Location" }).first();
    const acceptButton = request.locator("button.primary").first();
    await expect(acceptButton).toBeVisible();
    await acceptButton.click();
    await expect(providerPage.getByRole("status").first()).toBeVisible();
    await expect(request).toHaveCount(0);
  } finally {
    await providerContext.close();
  }

  await page.goto("/bookings");
  const booking = page.locator(".booking-card").filter({ hasText: "طنجة - E2E Test Location" }).first();
  await expect(booking).toBeVisible();
  await expect(booking).toContainText(/accepted|مقبول|تم القبول|acceptée/i);
  expect(state.provider.listingId).toBeGreaterThan(0);
});
