#!/usr/bin/env node

import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const E2E_MARKER = "maak_e2e_seed";
const DEFAULT_PROVIDER_EMAIL = "e2e-provider@maak.test";
const DEFAULT_CUSTOMER_EMAIL = "e2e-customer@maak.test";

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return;

  const content = fs.readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const match = trimmed.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (!match) continue;

    let value = match[2].trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    if (!(match[1] in process.env)) process.env[match[1]] = value;
  }
}

// Secrets stay local. The repo already ignores .env/.env.* except the committed production example.
loadEnvFile(path.join(ROOT, ".env.local"));
loadEnvFile(path.join(ROOT, ".env.development"));
loadEnvFile(path.join(ROOT, ".env"));

const args = new Set(process.argv.slice(2));
const cleanup = args.has("--cleanup");
const allowedArgs = new Set(["--cleanup"]);
const unknownArgs = process.argv.slice(2).filter((arg) => !allowedArgs.has(arg));
if (unknownArgs.length) {
  console.error(`Unknown argument(s): ${unknownArgs.join(", ")}`);
  process.exit(1);
}

const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const providerEmail = process.env.MAAK_E2E_PROVIDER_EMAIL || DEFAULT_PROVIDER_EMAIL;
const customerEmail = process.env.MAAK_E2E_CUSTOMER_EMAIL || DEFAULT_CUSTOMER_EMAIL;
const providerPassword = process.env.MAAK_E2E_PROVIDER_PASSWORD;
const customerPassword = process.env.MAAK_E2E_CUSTOMER_PASSWORD;

if (!supabaseUrl) {
  console.error("Missing SUPABASE_URL or VITE_SUPABASE_URL in the local environment.");
  process.exit(1);
}
if (!serviceRoleKey) {
  console.error("Missing SUPABASE_SERVICE_ROLE_KEY. Keep it only in a local ignored .env file.");
  process.exit(1);
}
if (!cleanup && (!providerPassword || !customerPassword)) {
  console.error("Seeding requires MAAK_E2E_PROVIDER_PASSWORD and MAAK_E2E_CUSTOMER_PASSWORD.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const MARKER = `[${E2E_MARKER}]`;

function assertOk(result, operation) {
  if (result.error) throw new Error(`${operation}: ${result.error.message}`);
  return result.data;
}

async function listAllUsers() {
  const users = [];
  let page = 1;
  const perPage = 1000;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw new Error(`list auth users: ${error.message}`);
    users.push(...data.users);
    if (data.users.length < perPage) break;
    page += 1;
  }

  return users;
}

async function findUserByEmail(email) {
  const users = await listAllUsers();
  return users.find((user) => user.email?.toLowerCase() === email.toLowerCase()) || null;
}

async function ensureE2EUser({ email, password, role, fullName, city }) {
  let user = await findUserByEmail(email);

  if (user && user.app_metadata?.[E2E_MARKER] !== true) {
    throw new Error(`Refusing to modify existing non-E2E account: ${email}`);
  }

  if (!user) {
    const created = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      app_metadata: { ...user?.app_metadata, [E2E_MARKER]: true, maak_e2e_role: role },
      user_metadata: { full_name: fullName, city, maak_e2e_role: role },
    });
    user = created.data.user;
    if (created.error || !user) {
      throw new Error(`create auth user ${email}: ${created.error?.message || "no user returned"}`);
    }
  } else {
    const updated = await supabase.auth.admin.updateUserById(user.id, {
      password,
      email_confirm: true,
      app_metadata: { ...user.app_metadata, [E2E_MARKER]: true, maak_e2e_role: role },
      user_metadata: { ...user.user_metadata, full_name: fullName, city, maak_e2e_role: role },
    });
    if (updated.error) throw new Error(`update auth user ${email}: ${updated.error.message}`);
    user = updated.data.user || user;
  }

  assertOk(
    await supabase.from("profiles").upsert(
      {
        id: user.id,
        role,
        full_name: fullName,
        phone: role === "provider" ? "+212600000001" : "+212600000002",
        city,
        account_status: "active",
      },
      { onConflict: "id" },
    ),
    `upsert profile ${email}`,
  );

  return user;
}

async function ensureProviderProfile(providerUser) {
  assertOk(
    await supabase.from("provider_profiles").upsert(
      {
        id: providerUser.id,
        profession: "سباك محترف",
        verification_status: "approved",
        service_category: "سباكة",
        bio: `${MARKER} مقدم خدمة مخصص لاختبارات E2E في منصة Maak.`,
        experience_years: 8,
        services: ["إصلاح التسربات", "تركيب الصنابير", "صيانة الأنابيب"],
        price_from: 100,
        service_radius_km: 25,
        profile_photo_public: false,
      },
      { onConflict: "id" },
    ),
    "upsert provider_profile",
  );
}

async function ensureProviderListing(providerUser) {
  const existing = assertOk(
    await supabase.from("providers").select("id").eq("provider_profile_id", providerUser.id).maybeSingle(),
    "find provider listing",
  );

  const payload = {
    name: "مزود E2E - Maak",
    job: "سباك محترف",
    city: "طنجة",
    distance: "2 km",
    price: "100 MAD",
    rating: "5.0",
    reviews: 0,
    image: null,
    available: true,
    services: ["إصلاح التسربات", "تركيب الصنابير", "صيانة الأنابيب"],
    experience: "8 سنوات",
    intro: `${MARKER} مزود خدمة مخصص للتحقق اليدوي من الحجز والشات.`,
    provider_profile_id: providerUser.id,
    listing_kind: "real",
    published_at: new Date().toISOString(),
  };

  if (existing?.id) {
    return assertOk(
      await supabase.from("providers").update(payload).eq("id", existing.id).select("*").single(),
      "update provider listing",
    );
  }

  return assertOk(
    await supabase.from("providers").insert(payload).select("*").single(),
    "insert provider listing",
  );
}

async function ensureAvailability(providerId) {
  const rows = [];
  for (let day = 0; day <= 6; day += 1) {
    rows.push({
      provider_id: providerId,
      day_of_week: day,
      start_time: "09:00:00",
      end_time: "17:00:00",
      is_available: true,
    });
  }

  // Replace this E2E provider's weekly schedule deterministically and keep one active window per day.
  assertOk(
    await supabase.from("provider_availability").delete().eq("provider_id", providerId),
    "clear provider availability",
  );
  assertOk(await supabase.from("provider_availability").insert(rows), "insert provider availability");
}

async function ensureConversation(providerUser, customerUser) {
  const participantRows = assertOk(
    await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .in("user_id", [providerUser.id, customerUser.id]),
    "find E2E conversation",
  );

  const conversationIds = [...new Set((participantRows || []).map((row) => row.conversation_id))];
  let conversation = null;

  for (const conversationId of conversationIds) {
    const participants = assertOk(
      await supabase.from("conversation_participants").select("user_id").eq("conversation_id", conversationId),
      "check conversation participants",
    );
    const ids = new Set((participants || []).map((row) => row.user_id));
    if (ids.has(providerUser.id) && ids.has(customerUser.id) && ids.size === 2) {
      conversation = { id: conversationId };
      break;
    }
  }

  if (!conversation) {
    const inserted = assertOk(
      await supabase.from("conversations").insert({ booking_id: null }).select("id").single(),
      "create E2E conversation",
    );
    conversation = inserted;
    assertOk(
      await supabase.from("conversation_participants").insert([
        { conversation_id: conversation.id, user_id: providerUser.id },
        { conversation_id: conversation.id, user_id: customerUser.id },
      ]),
      "create E2E participants",
    );
  }

  assertOk(
    await supabase.from("messages").delete().eq("conversation_id", conversation.id).like("body", `${MARKER}%`),
    "reset E2E seed messages",
  );

  assertOk(
    await supabase.from("messages").insert([
      { conversation_id: conversation.id, sender_id: customerUser.id, body: `${MARKER} مرحباً، أريد التأكد من توفر الموعد.` },
      { conversation_id: conversation.id, sender_id: providerUser.id, body: `${MARKER} مرحباً! الموعد ظاهر لدي ويمكننا المتابعة.` },
      { conversation_id: conversation.id, sender_id: customerUser.id, body: `${MARKER} ممتاز، هذا اختبار E2E ناجح.` },
    ]),
    "insert E2E seed messages",
  );

  return conversation.id;
}

async function cleanup() {
  const provider = await findUserByEmail(providerEmail);
  const customer = await findUserByEmail(customerEmail);

  for (const user of [provider, customer].filter(Boolean)) {
    if (user.app_metadata?.[E2E_MARKER] !== true) {
      throw new Error(`Refusing cleanup for non-E2E account: ${user.email}`);
    }
  }

  const userIds = [provider?.id, customer?.id].filter(Boolean);
  if (!userIds.length) {
    console.log("No E2E accounts found. Cleanup is already complete.");
    return;
  }

  const providerRows = provider
    ? assertOk(
        await supabase.from("providers").select("id").eq("provider_profile_id", provider.id),
        "find E2E provider listings",
      )
    : [];
  const providerIds = (providerRows || []).map((row) => row.id);

  if (providerIds.length) {
    assertOk(await supabase.from("provider_availability").delete().in("provider_id", providerIds), "delete E2E availability");
  }

  const participantRows = assertOk(
    await supabase.from("conversation_participants").select("conversation_id").in("user_id", userIds),
    "find E2E conversations",
  );
  const conversationIds = [...new Set((participantRows || []).map((row) => row.conversation_id))];

  if (conversationIds.length) {
    assertOk(await supabase.from("messages").delete().in("conversation_id", conversationIds), "delete E2E messages");
    assertOk(await supabase.from("conversation_participants").delete().in("conversation_id", conversationIds), "delete E2E participants");
    assertOk(await supabase.from("conversations").delete().in("id", conversationIds), "delete E2E conversations");
  }

  if (providerIds.length) {
    assertOk(await supabase.from("providers").delete().in("id", providerIds), "delete E2E provider listings");
  }

  for (const userId of userIds) {
    const deleted = await supabase.auth.admin.deleteUser(userId);
    if (deleted.error) throw new Error(`delete E2E auth user ${userId}: ${deleted.error.message}`);
  }

  console.log("E2E cleanup complete.");
}

async function seed() {
  const providerUser = await ensureE2EUser({
    email: providerEmail,
    password: providerPassword,
    role: "provider",
    fullName: "مزود E2E - Maak",
    city: "طنجة",
  });

  const customerUser = await ensureE2EUser({
    email: customerEmail,
    password: customerPassword,
    role: "customer",
    fullName: "عميل E2E - Maak",
    city: "طنجة",
  });

  await ensureProviderProfile(providerUser);
  const providerListing = await ensureProviderListing(providerUser);
  await ensureAvailability(providerListing.id);
  const conversationId = await ensureConversation(providerUser, customerUser);

  const summary = {
    provider: { email: providerEmail, user_id: providerUser.id, listing_id: providerListing.id },
    customer: { email: customerEmail, user_id: customerUser.id },
    availability: "09:00-17:00, every day",
    conversation_id: conversationId,
  };

  console.log("E2E seed complete:");
  console.log(JSON.stringify(summary, null, 2));
  console.log("Passwords are not printed. Use the local MAAK_E2E_*_PASSWORD values to sign in.");
}

try {
  if (cleanup) {
    await cleanup();
  } else {
    await seed();
  }
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
