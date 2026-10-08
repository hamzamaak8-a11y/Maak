import type { Env } from "./types";

/**
 * Admin-only endpoints that need the Supabase service-role key (creating Auth users, generating recovery links).
 * Every request must carry the caller's Supabase access token; it is verified against Supabase and the caller must be
 * an ACTIVE admin (profiles.role = 'admin'). The service-role key never leaves this Worker.
 */

const TIMEOUT_MS = 15_000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

type ProviderInput = {
  profession?: string; category?: string; bio?: string; experienceYears?: number | null;
  services?: string[]; priceFrom?: number | null; radiusKm?: number | null;
};
export type NewUserInput = {
  email?: string; fullName?: string; phone?: string; city?: string; role?: string;
  mode?: "invite" | "password"; password?: string; provider?: ProviderInput;
};
export type CreatedUser = { email: string; ok: boolean; id?: string; password?: string; error?: string };

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) { super(message); this.status = status; }
}

function svcHeaders(env: Env, extra?: Record<string, string>): Record<string, string> {
  return { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "application/json", ...extra };
}

async function call(env: Env, path: string, init: RequestInit = {}): Promise<Response> {
  return fetch(`${env.SUPABASE_URL}${path}`, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
}

export async function requireAdmin(env: Env, req: Request): Promise<{ id: string }> {
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "").trim();
  if (!token) throw new HttpError(401, "not_authenticated");
  const who = await call(env, "/auth/v1/user", { headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${token}` } });
  if (!who.ok) throw new HttpError(401, "not_authenticated");
  const user = (await who.json()) as { id?: string };
  if (!user.id) throw new HttpError(401, "not_authenticated");
  const prof = await call(env, `/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=role,account_status`, { headers: svcHeaders(env) });
  const rows = prof.ok ? ((await prof.json()) as Array<{ role: string; account_status: string }>) : [];
  if (rows[0]?.role !== "admin" || rows[0]?.account_status !== "active") throw new HttpError(403, "forbidden");
  return { id: user.id };
}

function randomPassword(): string {
  const alphabet = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
  const bytes = crypto.getRandomValues(new Uint8Array(14));
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("") + "7";
}

function clean(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function validate(input: NewUserInput) {
  const email = clean(input.email, 254).toLowerCase();
  const fullName = clean(input.fullName, 120);
  const role = input.role === "provider" ? "provider" : input.role === "customer" ? "customer" : "";
  if (!EMAIL_RE.test(email)) throw new HttpError(400, "invalid_email");
  if (fullName.length < 2) throw new HttpError(400, "invalid_name");
  if (!role) throw new HttpError(400, "invalid_role");
  const mode = input.mode === "invite" ? "invite" : "password";
  const password = clean(input.password, 72);
  if (mode === "password" && password && password.length < 8) throw new HttpError(400, "weak_password");
  let provider: Required<Pick<ProviderInput, "profession" | "category" | "bio" | "services">> & ProviderInput | null = null;
  if (role === "provider") {
    const p = input.provider ?? {};
    const services = (Array.isArray(p.services) ? p.services : []).map((s) => clean(s, 60)).filter(Boolean).slice(0, 15);
    const profession = clean(p.profession, 80);
    const category = clean(p.category, 60);
    const bio = clean(p.bio, 1000);
    if (!profession || !category || !bio || services.length === 0) throw new HttpError(400, "invalid_provider");
    const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : null);
    provider = { profession, category, bio, services, experienceYears: num(p.experienceYears), priceFrom: num(p.priceFrom), radiusKm: num(p.radiusKm) };
  }
  return { email, fullName, role, mode, password, phone: clean(input.phone, 30), city: clean(input.city, 80), provider };
}

async function createOne(env: Env, adminId: string, input: NewUserInput): Promise<CreatedUser> {
  let v;
  try { v = validate(input); } catch (e) { return { email: clean(input.email, 254), ok: false, error: e instanceof HttpError ? e.message : "invalid_input" }; }

  let id: string | undefined;
  let password: string | undefined;
  try {
    if (v.mode === "invite") {
      const res = await call(env, "/auth/v1/invite", { method: "POST", headers: svcHeaders(env), body: JSON.stringify({ email: v.email, data: { full_name: v.fullName } }) });
      if (!res.ok) throw new Error(res.status === 422 || res.status === 400 ? "email_exists" : `invite_failed_${res.status}`);
      id = ((await res.json()) as { id?: string }).id;
    } else {
      password = v.password || randomPassword();
      const res = await call(env, "/auth/v1/admin/users", {
        method: "POST", headers: svcHeaders(env),
        body: JSON.stringify({ email: v.email, password, email_confirm: true, user_metadata: { full_name: v.fullName, created_by: "admin" } }),
      });
      if (!res.ok) throw new Error(res.status === 422 || res.status === 400 ? "email_exists" : `create_failed_${res.status}`);
      id = ((await res.json()) as { id?: string }).id;
    }
    if (!id) throw new Error("create_failed");

    // The profile row is created by a database trigger; wait for it, then complete it.
    let found = false;
    for (let i = 0; i < 6 && !found; i++) {
      const r = await call(env, `/rest/v1/profiles?id=eq.${id}&select=id`, { headers: svcHeaders(env) });
      found = r.ok && ((await r.json()) as unknown[]).length > 0;
      if (!found) await new Promise((r2) => setTimeout(r2, 300));
    }
    if (!found) throw new Error("profile_not_created");

    const patch = await call(env, `/rest/v1/profiles?id=eq.${id}`, {
      method: "PATCH", headers: svcHeaders(env, { Prefer: "return=minimal" }),
      body: JSON.stringify({ full_name: v.fullName, phone: v.phone || null, city: v.city || null, ...(v.role === "provider" ? { role: "provider" } : {}) }),
    });
    if (!patch.ok) throw new Error("profile_update_failed");

    if (v.provider) {
      const p = v.provider;
      const up = await call(env, "/rest/v1/provider_profiles?on_conflict=id", {
        method: "POST", headers: svcHeaders(env, { Prefer: "resolution=merge-duplicates,return=minimal" }),
        body: JSON.stringify({
          id, profession: p.profession, service_category: p.category, bio: p.bio, experience_years: p.experienceYears ?? null,
          services: p.services, price_from: p.priceFrom ?? null, service_radius_km: p.radiusKm ?? null, verification_status: "approved",
        }),
      });
      if (!up.ok) throw new Error("provider_profile_failed");
    }

    await call(env, "/rest/v1/admin_audit_log", {
      method: "POST", headers: svcHeaders(env, { Prefer: "return=minimal" }),
      body: JSON.stringify({ admin_id: adminId, action: "user_created_by_admin", target_type: "profile", target_id: id, metadata: { email: v.email, role: v.role, mode: v.mode } }),
    });
    return { email: v.email, ok: true, id, password: v.mode === "password" ? password : undefined };
  } catch (e) {
    return { email: v.email, ok: false, id, error: e instanceof Error ? e.message : "failed" };
  }
}

export async function createUser(env: Env, adminId: string, input: NewUserInput): Promise<CreatedUser> {
  return createOne(env, adminId, input);
}

export async function createUsersBulk(env: Env, adminId: string, users: NewUserInput[]): Promise<CreatedUser[]> {
  if (!Array.isArray(users) || users.length === 0) throw new HttpError(400, "empty_batch");
  if (users.length > 100) throw new HttpError(400, "batch_too_large");
  const out: CreatedUser[] = [];
  for (const u of users) out.push(await createOne(env, adminId, u)); // sequential: keeps Auth rate limits happy
  return out;
}

export async function recoveryLink(env: Env, adminId: string, userId: string, redirectTo: string | undefined): Promise<{ link: string }> {
  if (!/^[0-9a-f-]{36}$/i.test(userId)) throw new HttpError(400, "invalid_user");
  const who = await call(env, `/auth/v1/admin/users/${userId}`, { headers: svcHeaders(env) });
  if (!who.ok) throw new HttpError(404, "not_found");
  const email = ((await who.json()) as { email?: string }).email;
  if (!email) throw new HttpError(404, "not_found");
  const res = await call(env, "/auth/v1/admin/generate_link", {
    method: "POST", headers: svcHeaders(env),
    body: JSON.stringify({ type: "recovery", email, ...(redirectTo ? { redirect_to: redirectTo } : {}) }),
  });
  if (!res.ok) throw new HttpError(502, "link_failed");
  const link = ((await res.json()) as { action_link?: string }).action_link;
  if (!link) throw new HttpError(502, "link_failed");
  await call(env, "/rest/v1/admin_audit_log", {
    method: "POST", headers: svcHeaders(env, { Prefer: "return=minimal" }),
    body: JSON.stringify({ admin_id: adminId, action: "recovery_link_generated", target_type: "profile", target_id: userId, metadata: {} }),
  });
  return { link };
}
