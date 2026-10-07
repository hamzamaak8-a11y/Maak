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

/** Adds the provider's category and the live rating/review count computed from visible reviews. */
async function enrich(env: Env, providers: Provider[]): Promise<Provider[]> {
  const ids = Array.from(new Set(providers.map((p) => p.provider_profile_id).filter((id): id is string => !!id)));
  if (ids.length === 0) return providers.map((p) => ({ ...p, category: null }));

  const categories = new Map<string, string | null>();
  const stats = new Map<string, { sum: number; count: number }>();

  await Promise.all(
    chunk(ids, 50).map(async (group) => {
      const list = `(${group.join(",")})`;
      const profiles = await getJson<Array<{ id: string; service_category: string | null }>>(
        env,
        `${env.SUPABASE_URL}/rest/v1/provider_profiles?select=id,service_category&id=in.${list}`,
        "category lookup",
      );
      for (const row of profiles) categories.set(row.id, row.service_category);

      const reviews = await getJson<Array<{ provider_id: string; rating: number }>>(
        env,
        `${env.SUPABASE_URL}/rest/v1/reviews?select=provider_id,rating&is_hidden=eq.false&provider_id=in.${list}&limit=5000`,
        "rating lookup",
      );
      for (const row of reviews) {
        const current = stats.get(row.provider_id) ?? { sum: 0, count: 0 };
        current.sum += Number(row.rating);
        current.count += 1;
        stats.set(row.provider_id, current);
      }
    }),
  );

  return providers.map((provider) => {
    const id = provider.provider_profile_id;
    const stat = id ? stats.get(id) : undefined;
    return {
      ...provider,
      category: id ? categories.get(id) ?? null : null,
      rating: stat && stat.count > 0 ? (stat.sum / stat.count).toFixed(1) : provider.rating,
      reviews: stat && stat.count > 0 ? stat.count : provider.reviews,
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
  return (await enrich(env, [arr[0]]))[0];
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
