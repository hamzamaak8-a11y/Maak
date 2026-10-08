import type { Env, Provider, ProviderPortfolioImage } from "./types";

const UPSTREAM_TIMEOUT_MS = 10_000;
const UPSTREAM_TIMEOUT_SIGNAL = () => AbortSignal.timeout(UPSTREAM_TIMEOUT_MS);

function headers(env: Env): Record<string, string> {
  return {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: "Bearer " + env.SUPABASE_SERVICE_ROLE_KEY,
    Accept: "application/json",
  };
}

// Public marketplace visibility: only real, published, provider-linked listings.
const PUBLISHED_FILTER = "listing_kind=eq.real&published_at=not.is.null&provider_profile_id=not.is.null";
const PORTFOLIO_BUCKET = "provider-portfolio";
const PORTFOLIO_URL_TTL_SECONDS = 3600;

async function getJson<T>(env: Env, url: URL | string, what: string): Promise<T> {
  const res = await fetch(url, { headers: headers(env), signal: UPSTREAM_TIMEOUT_SIGNAL() });
  if (!res.ok) throw new Error(`supabase ${what} failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/** Optional lookups must never take the whole listing down: a failure just means "unknown". */
async function getJsonOrEmpty<T>(env: Env, url: string, what: string): Promise<T[]> {
  try { return await getJson<T[]>(env, url, what); } catch (error) { console.error(`[maak-worker] ${what} unavailable`, error); return []; }
}

/**
 * Re-checks, with the same rule as the public RLS policy, that every listing belongs to an APPROVED provider with an ACTIVE
 * account (the Worker reads with the service-role key, which bypasses RLS, so `published_at` alone is not trusted), then adds:
 *  - category, and the live rating / review count computed from visible reviews;
 *  - `verified` (only ever true for approved providers - unapproved ones are not returned at all);
 *  - `currency` of the provider's active price list (null when unknown or mixed);
 *  - `available`: the provider has not paused the listing AND has at least one working-hours window.
 */
async function enrich(env: Env, providers: Provider[]): Promise<Provider[]> {
  const ids = Array.from(new Set(providers.map((p) => p.provider_profile_id).filter((id): id is string => !!id)));
  if (ids.length === 0) return [];

  const categories = new Map<string, string | null>();
  const approved = new Set<string>();
  const stats = new Map<string, { sum: number; count: number }>();
  const currencies = new Map<string, Set<string>>();
  const withHours = new Set<number>();

  await Promise.all(
    chunk(ids, 50).map(async (group) => {
      const list = `(${group.join(",")})`;
      const [profiles, accounts, reviews, services] = await Promise.all([
        getJson<Array<{ id: string; service_category: string | null; verification_status: string | null }>>(
          env,
          `${env.SUPABASE_URL}/rest/v1/provider_profiles?select=id,service_category,verification_status&id=in.${list}`,
          "category lookup",
        ),
        getJson<Array<{ id: string; account_status: string | null }>>(env, `${env.SUPABASE_URL}/rest/v1/profiles?select=id,account_status&id=in.${list}`, "account lookup"),
        getJson<Array<{ provider_id: string; rating: number }>>(
          env,
          `${env.SUPABASE_URL}/rest/v1/reviews?select=provider_id,rating&is_hidden=eq.false&provider_id=in.${list}&limit=5000`,
          "rating lookup",
        ),
        getJsonOrEmpty<{ provider_id: string; currency: string | null }>(
          env,
          `${env.SUPABASE_URL}/rest/v1/provider_services?select=provider_id,currency&is_active=eq.true&provider_id=in.${list}&limit=5000`,
          "currency lookup",
        ),
      ]);
      const active = new Set(accounts.filter((a) => a.account_status === "active").map((a) => a.id));
      for (const row of profiles) {
        categories.set(row.id, row.service_category);
        if (row.verification_status === "approved" && active.has(row.id)) approved.add(row.id);
      }
      for (const row of reviews) {
        const current = stats.get(row.provider_id) ?? { sum: 0, count: 0 };
        current.sum += Number(row.rating);
        current.count += 1;
        stats.set(row.provider_id, current);
      }
      for (const row of services) {
        if (!row.currency) continue;
        const set = currencies.get(row.provider_id) ?? new Set<string>();
        set.add(row.currency);
        currencies.set(row.provider_id, set);
      }
    }),
  );

  const listingIds = providers.filter((p) => p.provider_profile_id && approved.has(p.provider_profile_id)).map((p) => p.id);
  await Promise.all(
    chunk(listingIds, 50).map(async (group) => {
      const rows = await getJsonOrEmpty<{ provider_id: number }>(
        env,
        `${env.SUPABASE_URL}/rest/v1/provider_availability?select=provider_id&is_available=eq.true&provider_id=in.(${group.join(",")})&limit=5000`,
        "availability lookup",
      );
      for (const row of rows) withHours.add(Number(row.provider_id));
    }),
  );

  return providers
    .filter((provider) => !!provider.provider_profile_id && approved.has(provider.provider_profile_id))
    .map((provider) => {
      const id = provider.provider_profile_id as string;
      const stat = stats.get(id);
      const cur = currencies.get(id);
      return {
        ...provider,
        category: categories.get(id) ?? null,
        rating: stat && stat.count > 0 ? (stat.sum / stat.count).toFixed(1) : provider.rating,
        reviews: stat && stat.count > 0 ? stat.count : provider.reviews,
        verified: true,
        currency: cur && cur.size === 1 ? [...cur][0] : null,
        available: provider.available !== false && withHours.has(provider.id),
      };
    });
}

export async function listProviders(env: Env): Promise<Provider[]> {
  const providers = await getJson<Provider[]>(env, env.SUPABASE_URL + "/rest/v1/providers?order=id.asc&" + PUBLISHED_FILTER, "list");
  return enrich(env, providers);
}

export async function findProvider(env: Env, id: number): Promise<Provider | null> {
  const arr = await getJson<Provider[]>(env, env.SUPABASE_URL + "/rest/v1/providers?id=eq." + id + "&" + PUBLISHED_FILTER, "get");
  if (arr.length === 0) return null;
  return (await enrich(env, [arr[0]]))[0] ?? null;
}

async function signPortfolioObject(env: Env, path: string): Promise<string> {
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  const res = await fetch(`${env.SUPABASE_URL}/storage/v1/object/sign/${PORTFOLIO_BUCKET}/${encodedPath}`, {
    method: "POST",
    headers: { ...headers(env), "Content-Type": "application/json" },
    body: JSON.stringify({ expiresIn: PORTFOLIO_URL_TTL_SECONDS }),
    signal: UPSTREAM_TIMEOUT_SIGNAL(),
  });
  if (!res.ok) throw new Error("supabase portfolio sign failed: " + res.status);
  const body = (await res.json()) as { signedURL?: string };
  if (!body.signedURL) throw new Error("supabase portfolio sign returned no url");
  return body.signedURL.startsWith("http") ? body.signedURL : `${env.SUPABASE_URL}/storage/v1${body.signedURL}`;
}

export async function getProviderPortfolio(env: Env, id: number): Promise<ProviderPortfolioImage[]> {
  const provider = await findProvider(env, id);
  if (!provider?.provider_profile_id) return [];

  const prefix = provider.provider_profile_id + "/";
  const listRes = await fetch(`${env.SUPABASE_URL}/storage/v1/object/list/${PORTFOLIO_BUCKET}`, {
    method: "POST",
    headers: { ...headers(env), "Content-Type": "application/json" },
    body: JSON.stringify({ prefix, limit: 100, offset: 0, sortBy: { column: "name", order: "asc" } }),
    signal: UPSTREAM_TIMEOUT_SIGNAL(),
  });
  if (!listRes.ok) throw new Error("supabase portfolio list failed: " + listRes.status);

  const rows = (await listRes.json()) as Array<{ name?: string; id?: string; created_at?: string; updated_at?: string; metadata?: { mimetype?: string; size?: number } }>;
  const files = rows.filter((row) => !!row.name && !!row.id).map((row) => ({
    id: String(row.id),
    path: prefix + String(row.name),
    created_at: row.created_at ?? null,
    content_type: row.metadata?.mimetype ?? null,
    size: typeof row.metadata?.size === "number" ? row.metadata.size : null,
  }));

  return Promise.all(files.map(async (file) => ({ ...file, url: await signPortfolioObject(env, file.path) })));
}
