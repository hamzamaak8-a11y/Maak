import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase browser client.
 *
 * Configuration is intentionally read only from Vite environment variables.
 * There is no production-project fallback. The client is created lazily so a
 * dependency-free production build can succeed without credentials while any
 * runtime use with missing/malformed configuration fails closed.
 */

function readSupabaseConfig(): { url: string; key: string } {
  const url = String(import.meta.env.VITE_SUPABASE_URL ?? "").trim();
  const key = String(import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? "").trim();

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Supabase frontend configuration is missing or invalid.");
  }

  if (parsed.protocol !== "https:" || !parsed.hostname) {
    throw new Error("Supabase frontend configuration is missing or invalid.");
  }

  if (!key) {
    throw new Error("Supabase frontend configuration is missing or invalid.");
  }

  return { url, key };
}

let client: SupabaseClient | null = null;

function getClient(): SupabaseClient {
  if (client) return client;
  const { url, key } = readSupabaseConfig();
  client = createClient(url, key, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return client;
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, property, receiver) {
    return Reflect.get(getClient() as object, property, receiver);
  },
});
