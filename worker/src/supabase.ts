import type { Env, Provider } from "./types";

function headers(env: Env): Record<string, string> {
  return {
    apikey: env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization: "Bearer " + env.SUPABASE_SERVICE_ROLE_KEY,
    Accept: "application/json",
  };
}

// Public marketplace visibility: only real, published, provider-linked listings.
const PUBLISHED_FILTER = "listing_kind=eq.real&published_at=not.is.null&provider_profile_id=not.is.null";

export async function listProviders(env: Env): Promise<Provider[]> {
  const res = await fetch(env.SUPABASE_URL + "/rest/v1/providers?order=id.asc&" + PUBLISHED_FILTER, {
    headers: headers(env),
  });
  if (!res.ok) {
    throw new Error("supabase list failed: " + res.status + " " + (await res.text()));
  }
  return (await res.json()) as Provider[];
}

export async function findProvider(env: Env, id: number): Promise<Provider | null> {
  const res = await fetch(env.SUPABASE_URL + "/rest/v1/providers?id=eq." + id + "&" + PUBLISHED_FILTER, {
    headers: headers(env),
  });
  if (!res.ok) {
    throw new Error("supabase get failed: " + res.status);
  }
  const arr = (await res.json()) as Provider[];
  return arr.length > 0 ? arr[0] : null;
}
