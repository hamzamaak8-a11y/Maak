import type { Env, Provider, ProviderPortfolioImage } from "./types";

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

async function featuredProviderIds(env: Env): Promise<Set<string>> {
  const url = new URL(env.SUPABASE_URL + "/rest/v1/provider_subscriptions");
  url.searchParams.set("select", "provider_id");
  url.searchParams.set("plan_id", "eq.featured");
  url.searchParams.set("status", "eq.active");
  url.searchParams.set("end_date", "gt.now()");
  const res = await fetch(url, { headers: headers(env) });
  if (!res.ok) {
    throw new Error("supabase featured lookup failed: " + res.status + " " + (await res.text()));
  }
  const rows = (await res.json()) as Array<{ provider_id?: string }>;
  return new Set(rows.map((row) => row.provider_id).filter((id): id is string => typeof id === "string" && id.length > 0));
}

function withFeatured(provider: Provider, featuredIds: Set<string>): Provider {
  return { ...provider, is_featured: provider.provider_profile_id ? featuredIds.has(provider.provider_profile_id) : false };
}

export async function listProviders(env: Env): Promise<Provider[]> {
  const res = await fetch(env.SUPABASE_URL + "/rest/v1/providers?order=id.asc&" + PUBLISHED_FILTER, {
    headers: headers(env),
  });
  if (!res.ok) {
    throw new Error("supabase list failed: " + res.status + " " + (await res.text()));
  }
  const providers = (await res.json()) as Provider[];
  const featuredIds = await featuredProviderIds(env);
  return providers.map((provider) => withFeatured(provider, featuredIds));
}

export async function findProvider(env: Env, id: number): Promise<Provider | null> {
  const res = await fetch(env.SUPABASE_URL + "/rest/v1/providers?id=eq." + id + "&" + PUBLISHED_FILTER, {
    headers: headers(env),
  });
  if (!res.ok) {
    throw new Error("supabase get failed: " + res.status);
  }
  const arr = (await res.json()) as Provider[];
  if (arr.length === 0) return null;
  const featuredIds = await featuredProviderIds(env);
  return withFeatured(arr[0], featuredIds);
}

async function signPortfolioObject(env: Env, path: string): Promise<string> {
  const encodedPath = path.split("/").map(encodeURIComponent).join("/");
  const res = await fetch(`${env.SUPABASE_URL}/storage/v1/object/sign/${PORTFOLIO_BUCKET}/${encodedPath}`, {
    method: "POST",
    headers: { ...headers(env), "Content-Type": "application/json" },
    body: JSON.stringify({ expiresIn: PORTFOLIO_URL_TTL_SECONDS }),
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
