import { expect, type Page } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

export type E2EState = {
  provider: { email: string; userId: string; listingId: number };
  customer: { email: string; userId: string };
  admin: { email: string; userId: string };
  hiddenReview: { bookingId: string; reviewId: string };
};

const STATE_PATH = path.resolve(process.env.MAAK_E2E_STATE_FILE || "test-results/e2e-state.json");

export function getState(): E2EState {
  if (!fs.existsSync(STATE_PATH)) throw new Error(`Missing E2E state file: ${STATE_PATH}`);
  return JSON.parse(fs.readFileSync(STATE_PATH, "utf8")) as E2EState;
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}. See the Task #17 E2E environment contract.`);
  return value;
}

export function credentials(role: "customer" | "provider" | "admin"): { email: string; password: string } {
  if (role === "customer") return { email: requiredEnv("MAAK_E2E_CUSTOMER_EMAIL"), password: requiredEnv("MAAK_E2E_CUSTOMER_PASSWORD") };
  if (role === "provider") return { email: requiredEnv("MAAK_E2E_PROVIDER_EMAIL"), password: requiredEnv("MAAK_E2E_PROVIDER_PASSWORD") };
  return { email: requiredEnv("MAAK_E2E_ADMIN_EMAIL"), password: requiredEnv("MAAK_E2E_ADMIN_PASSWORD") };
}

export async function login(page: Page, role: "customer" | "provider" | "admin"): Promise<void> {
  const authPath = role === "admin" ? "/admin/login" : "/login";
  const { email, password } = credentials(role);
  await page.goto(authPath);
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('button[type="submit"]').click();
  if (role === "admin") {
    await expect(page).toHaveURL(/\/admin\/?$/);
    await expect(page.getByRole("heading", { name: /Maak Control Center\./i })).toBeVisible();
  } else {
    await expect(page).not.toHaveURL(/\/login\/?$/);
  }
}

export async function loginCustomer(page: Page): Promise<void> {
  await login(page, "customer");
}

export async function loginProvider(page: Page): Promise<void> {
  await login(page, "provider");
}

export async function loginAdmin(page: Page): Promise<void> {
  await login(page, "admin");
}

export async function createBookingAsCustomer(page: Page): Promise<void> {
  const state = getState();
  await loginCustomer(page);
  await page.goto(`/provider/${state.provider.listingId}/booking`);
  await expect(page.locator(".service-chip-opt").first()).toBeVisible();

  const continueButton = page.getByRole("button", { name: /Continue|استمرار|Suivant|متابعة/i }).last();
  await page.locator(".service-chip-opt").first().click();
  await continueButton.click();
  await expect(page.locator("textarea.booking-native")).toBeVisible();
  await continueButton.click();

  // Tomorrow is deliberately used so the fixed 09:00 slot is always in the future.
  await expect(page.getByRole("tab").nth(1)).toBeVisible();
  await page.getByRole("tab").nth(1).click();
  const availableSlot = page.locator("button.slot-option:not([disabled])").first();
  await expect(availableSlot).toBeVisible();
  await availableSlot.click();

  await page.locator('input.booking-native').fill("طنجة - E2E Test Location");
  await continueButton.click();
  await expect(page.getByRole("heading", { name: /review|مراجعة|r[eé]capitulatif/i })).toBeVisible();

  const submitButton = page.getByRole("button", { name: /Submit|إرسال الطلب|Envoyer la demande|طلب الخدمة|إرسال/i }).last();
  await submitButton.click();
  await expect(page.locator(".booking-success")).toBeVisible();
}

async function providerTab(page: Page, expression: RegExp): Promise<void> {
  await page.locator(".provider-side").getByRole("button", { name: expression }).first().click();
}

export async function acceptAndCompleteLatestBooking(page: Page): Promise<void> {
  await loginProvider(page);
  await page.goto("/provider-mode");

  const request = page.locator(".request-row").filter({ hasText: "طنجة - E2E Test Location" }).first();
  await expect(request).toBeVisible();

  const acceptButton = request.locator("button.primary").first();
  await expect(acceptButton).toBeVisible();
  await acceptButton.click();
  await expect(page.getByRole("status").first()).toBeVisible();

  await providerTab(page, /Accepted|Acceptées|مقبول|المقبولة/i);
  const acceptedRequest = page.locator(".request-row").filter({ hasText: "طنجة - E2E Test Location" }).first();
  await expect(acceptedRequest).toBeVisible();
  const startButton = acceptedRequest.getByRole("button", { name: /Start|Démarrer|بدء/i }).first();
  await expect(startButton).toBeVisible();
  await startButton.click();

  await providerTab(page, /In progress|En cours|قيد التنفيذ|جارية/i);
  const activeRequest = page.locator(".request-row").filter({ hasText: "طنجة - E2E Test Location" }).first();
  await expect(activeRequest).toBeVisible();
  const completeButton = activeRequest.getByRole("button", { name: /Complete|Terminer|إتمام|إكمال/i }).first();
  await expect(completeButton).toBeVisible();
  await completeButton.click();
  await expect(page.getByRole("status").first()).toBeVisible();
}
