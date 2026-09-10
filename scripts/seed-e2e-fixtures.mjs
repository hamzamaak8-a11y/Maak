#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MARKER = "[maak_e2e_seed]";
const ADMIN_EMAIL = process.env.MAAK_E2E_ADMIN_EMAIL || "e2e-admin@maak.test";
const ADMIN_PASSWORD = process.env.MAAK_E2E_ADMIN_PASSWORD;
const PROVIDER_EMAIL = process.env.MAAK_E2E_PROVIDER_EMAIL || "e2e-provider@maak.test";
const CUSTOMER_EMAIL = process.env.MAAK_E2E_CUSTOMER_EMAIL || "e2e-customer@maak.test";
const STATE_FILE = process.env.MAAK_E2E_STATE_FILE || path.join(ROOT, "test-results", "e2e-state.json");

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match || match[1] in process.env) continue;
    let value = match[2].trim();
    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    process.env[match[1]] = value;
  }
}

loadEnvFile(path.join(ROOT, ".env.local"));
loadEnvFile(path.join(ROOT, ".env.development"));
loadEnvFile(path.join(ROOT, ".env"));

const cleanupMode = process.argv.includes("--cleanup");
const unknownArgs = process.argv.slice(2).filter((arg) => arg !== "--cleanup");
if (unknownArgs.length) {
  console.error(`Unknown argument(s): ${unknownArgs.join(", ")}`);
  process.exit(1);
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  console.error("E2E fixtures require SUPABASE_URL (or VITE_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY in the local environment.");
  process.exit(1);
}
if (!cleanupMode && !ADMIN_PASSWORD) {
  console.error("E2E fixtures require MAAK_E2E_ADMIN_PASSWORD in the local environment.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function assertOk(result, operation) {
  if (result.error) throw new Error(`${operation}: ${result.error.message}`);
  return result.data;
}

async function listAllUsers() {
  const users = [];
  for (let page = 1; ; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error(`list auth users: ${error.message}`);
    users.push(...data.users);
    if (data.users.length < 1000) return users;
  }
}

async function findUserByEmail(email) {
  const users = await listAllUsers();
  return users.find((user) => user.email?.toLowerCase() === email.toLowerCase()) || null;
}

async function ensureAdmin() {
  let user = await findUserByEmail(ADMIN_EMAIL);
  if (user && user.app_metadata?.maak_e2e_seed !== true) throw new Error(`Refusing to modify existing non-E2E admin account: ${ADMIN_EMAIL}`);

  if (!user) {
    const created = await supabase.auth.admin.createUser({
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      email_confirm: true,
      app_metadata: { maak_e2e_seed: true, maak_e2e_role: "admin" },
      user_metadata: { full_name: "E2E Admin - Maak", maak_e2e_role: "admin" },
    });
    if (created.error || !created.data.user) throw new Error(`create E2E admin: ${created.error?.message || "no user returned"}`);
    user = created.data.user;
  } else {
    const updated = await supabase.auth.admin.updateUserById(user.id, {
      password: ADMIN_PASSWORD,
      email_confirm: true,
      app_metadata: { ...user.app_metadata, maak_e2e_seed: true, maak_e2e_role: "admin" },
      user_metadata: { ...user.user_metadata, full_name: "E2E Admin - Maak", maak_e2e_role: "admin" },
    });
    if (updated.error) throw new Error(`update E2E admin: ${updated.error.message}`);
    user = updated.data.user || user;
  }

  assertOk(
    await supabase.from("profiles").upsert(
      { id: user.id, role: "admin", full_name: "E2E Admin - Maak", phone: "+212600000003", city: "طنجة", account_status: "active" },
      { onConflict: "id" },
    ),
    "upsert E2E admin profile",
  );
  return user;
}

async function ensureHiddenReview(providerId, customerId, listingId) {
  const description = `${MARKER} hidden review fixture`;
  const existing = assertOk(
    await supabase.from("bookings").select("id").eq("service_description", description).eq("customer_id", customerId).eq("provider_id", providerId).maybeSingle(),
    "find hidden review booking",
  );
  if (existing?.id) {
    assertOk(await supabase.from("reviews").delete().eq("booking_id", existing.id), "reset hidden review");
    assertOk(await supabase.from("bookings").delete().eq("id", existing.id), "reset hidden review booking");
  }

  const booking = assertOk(
    await supabase.from("bookings").insert({
      customer_id: customerId,
      provider_id: providerId,
      provider_listing_id: listingId,
      service_category: "سباكة",
      service_description: description,
      service_date: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
      location_text: "طنجة",
      customer_note: `${MARKER} fixture`,
      provider_note: `${MARKER} fixture`,
      status: "completed",
      customer_name: "عميل E2E - Maak",
      accepted_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
      started_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000 + 60 * 60 * 1000).toISOString(),
      completed_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    }).select("id").single(),
    "create hidden review booking",
  );

  const review = assertOk(
    await supabase.from("reviews").insert({
      booking_id: booking.id,
      customer_id: customerId,
      provider_id: providerId,
      rating: 4,
      comment: `${MARKER} هذا تقييم مخفي للاختبار الآلي.`,
      is_hidden: true,
    }).select("id").single(),
    "create hidden review",
  );

  return { bookingId: booking.id, reviewId: review.id };
}

async function writeState(state) {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf8");
}

async function seed() {
  const provider = await findUserByEmail(PROVIDER_EMAIL);
  const customer = await findUserByEmail(CUSTOMER_EMAIL);
  if (!provider || !customer) throw new Error("Run scripts/seed-e2e.mjs before seeding E2E fixtures.");

  const listing = assertOk(
    await supabase.from("providers").select("id").eq("provider_profile_id", provider.id).single(),
    "find E2E provider listing",
  );
  const admin = await ensureAdmin();
  const hiddenReview = await ensureHiddenReview(provider.id, customer.id, listing.id);

  await writeState({
    provider: { email: PROVIDER_EMAIL, userId: provider.id, listingId: listing.id },
    customer: { email: CUSTOMER_EMAIL, userId: customer.id },
    admin: { email: ADMIN_EMAIL, userId: admin.id },
    hiddenReview,
  });

  console.log("E2E fixtures ready.");
}

async function cleanup() {
  const admin = await findUserByEmail(ADMIN_EMAIL);
  const provider = await findUserByEmail(PROVIDER_EMAIL);
  const customer = await findUserByEmail(CUSTOMER_EMAIL);
  for (const user of [admin, provider, customer].filter(Boolean)) {
    if (user.app_metadata?.maak_e2e_seed !== true) throw new Error(`Refusing cleanup for non-E2E account: ${user.email}`);
  }

  const userIds = [admin?.id, provider?.id, customer?.id].filter(Boolean);
  if (userIds.length) {
    assertOk(await supabase.from("reviews").delete().or(`customer_id.in.(${userIds.join(",")}),provider_id.in.(${userIds.join(",")})`), "delete E2E reviews");
    assertOk(await supabase.from("bookings").delete().or(`customer_id.in.(${userIds.join(",")}),provider_id.in.(${userIds.join(",")})`), "delete E2E bookings");
  }

  if (fs.existsSync(STATE_FILE)) fs.rmSync(STATE_FILE);
  if (admin) {
    const deleted = await supabase.auth.admin.deleteUser(admin.id);
    if (deleted.error) throw new Error(`delete E2E admin: ${deleted.error.message}`);
  }
  console.log("E2E fixture cleanup complete.");
}

try {
  await (cleanupMode ? cleanup() : seed());
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
