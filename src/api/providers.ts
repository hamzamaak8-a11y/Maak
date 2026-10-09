import { API_URL } from '../config/env';
import { supabase } from '../lib/supabase';
import type { PortfolioImage, Provider } from '../types';

const TTL_MS = 60_000;
let cache: { at: number; data: Provider[] } | null = null;
let inflight: Promise<Provider[]> | null = null;

function normalize(raw: Record<string, unknown>): Provider {
  const services = Array.isArray(raw.services) ? raw.services.filter((s): s is string => typeof s === 'string') : [];
  return {
    id: Number(raw.id),
    name: String(raw.name ?? ''),
    job: String(raw.job ?? ''),
    city: String(raw.city ?? ''),
    price: raw.price == null ? null : String(raw.price),
    rating: raw.rating == null ? null : String(raw.rating),
    reviews: Number(raw.reviews ?? 0) || 0,
    image: typeof raw.image === 'string' && raw.image ? raw.image : null,
    available: typeof raw.available === 'boolean' ? raw.available : null,
    services,
    experience: raw.experience == null ? null : String(raw.experience),
    intro: raw.intro == null ? null : String(raw.intro),
    provider_profile_id: typeof raw.provider_profile_id === 'string' ? raw.provider_profile_id : null,
    category: typeof raw.category === 'string' ? raw.category : null,
    verified: raw.verified === true,
    currency: typeof raw.currency === 'string' && /^[A-Z]{3}$/.test(raw.currency) ? raw.currency : null,
  };
}

async function getJson(path: string): Promise<unknown> {
  if (!API_URL) throw new Error('err.config');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(`${API_URL}${path}`, { signal: controller.signal });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error('err.network');
    return await res.json();
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('err.')) throw e;
    throw new Error('err.network');
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchProviders(force = false): Promise<Provider[]> {
  if (!force && cache && Date.now() - cache.at < TTL_MS) return cache.data;
  if (inflight) return inflight;
  inflight = (async () => {
    try {
      const body = await getJson('/api/providers');
      const data = Array.isArray(body) ? body.map(r => normalize(r as Record<string, unknown>)) : [];
      cache = { at: Date.now(), data };
      return data;
    } finally {
      inflight = null;
    }
  })();
  return inflight;
}

export async function fetchProvider(id: number): Promise<Provider | null> {
  const cached = cache?.data.find(p => p.id === id);
  if (cached && cache && Date.now() - cache.at < TTL_MS) return cached;
  const body = await getJson(`/api/providers/${id}`);
  return body ? normalize(body as Record<string, unknown>) : null;
}

/** Work photos of a provider. Rejects when the server cannot be reached, so the screen can tell "no photos" from "could not load". */
export async function fetchPortfolio(listingId: number): Promise<PortfolioImage[]> {
  const body = await getJson(`/api/providers/${listingId}/portfolio`);
  return Array.isArray(body)
    ? (body as Array<{ id?: string; path?: string; url?: string; created_at?: string | null }>)
        .filter(i => i.url)
        .map(i => ({ id: String(i.id ?? i.path), path: String(i.path ?? ''), url: String(i.url), created_at: i.created_at ?? null }))
    : [];
}

export function isBookable(p: Provider | null | undefined): p is Provider {
  return !!p && p.available === true && !!p.provider_profile_id;
}

export function invalidateProviders() {
  cache = null;
}

export type PublicService = { id: string; name: string; description: string | null; price: number | null; currency: string; duration_minutes: number | null };

/** Active price list of a published provider (public read policy, see migration 20261007120100). */
export async function fetchPublicServices(providerProfileId: string): Promise<PublicService[]> {
  const { data, error } = await supabase
    .from('provider_services')
    .select('id,name,description,price,currency,duration_minutes')
    .eq('provider_id', providerProfileId)
    .eq('is_active', true)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as PublicService[];
}
