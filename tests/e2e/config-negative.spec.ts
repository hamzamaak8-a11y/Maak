import { test, expect } from "@playwright/test";

test.describe("@negative-config", () => {
  test("missing frontend Supabase configuration fails closed without contacting production", async ({ page }) => {
    const requestedUrls: string[] = [];
    page.on("request", (request) => requestedUrls.push(request.url()));

    await page.goto("/login");
    await expect(page.getByRole("alert")).toBeVisible();
    await expect(page.getByText(/Supabase frontend configuration is missing or invalid/i)).toBeVisible();

    expect(requestedUrls.some((url) => url.includes("pjvayowrmqkhmzvlhwex.supabase.co"))).toBe(false);
    expect(requestedUrls.some((url) => url.includes("supabase.co/rest/v1") || url.includes("supabase.co/auth/v1"))).toBe(false);
    expect(requestedUrls.some((url) => url.includes("sb_publishable_"))).toBe(false);
  });
});
