import { categories } from "./data";
import type { Category, Provider } from "./types";

const API_URL = import.meta.env.VITE_API_URL?.replace(/\/$/, "");

/**
 * Marketplace reads go through the Cloudflare Worker API.
 * The browser must not query the providers table directly; the Worker is the
 * public API and caching/protection layer in front of Supabase.
 */
export async function fetchProviders(): Promise<Provider[]> {
  if (!API_URL) throw new Error("svc.errProviders");

  try {
    const res = await fetch(`${API_URL}/api/providers`);
    if (!res.ok) throw new Error("Worker API failed");
    return (await res.json()) as Provider[];
  } catch (err) {
    console.error("Worker fetch failed", err);
    throw new Error("svc.errProviders");
  }
}

export async function fetchProvider(id: number): Promise<Provider | undefined> {
  if (!API_URL) throw new Error("svc.errProvider");

  try {
    const res = await fetch(`${API_URL}/api/providers/${id}`);
    if (res.status === 404) return undefined;
    if (!res.ok) throw new Error("Worker API failed");
    return (await res.json()) as Provider;
  } catch (err) {
    console.error("Worker fetch failed", err);
    throw new Error("svc.errProvider");
  }
}

export function getCategories(): Category[] {
  return categories;
}

export function filterProviders(providers: Provider[], query: string): Provider[] {
  const q = query.trim();
  if (!q) return providers;
  // Category chips pass the canonical category name; match those against the
  // category keyword roots so "الكهرباء" also finds "كهربائي" listings, and
  // fall back to a plain substring match for free-text search.
  const roots = CATEGORY_ROOTS[q];
  const needles = roots && roots.length > 0 ? roots : [q];
  return providers.filter((provider) => {
    const hay = provider.job + " " + provider.services.join(" ") + " " + provider.name;
    return needles.some((needle) => hay.includes(needle));
  });
}

const CATEGORY_ROOTS: Record<string, string[]> = {
  "السباكة": ["سباك", "سباكة", "تسرب", "صنابير", "سخان", "ماء"],
  "الكهرباء": ["كهرب", "إنارة", "لوح", "تمديد", "عطل"],
  "التنظيف": ["تنظيف", "نظافة", "مرتب"],
  "الصباغة": ["صباغ", "دهان", "دهن", "صباغة"],
  "النقل": ["نقل", "أثاث", "تغليف", "تركيب"],
  "الصيانة": ["صيانة", "إصلاح", "تصليح", "عطل"],
};

export function countByCategory(providers: Provider[], category: string): number {
  const roots = CATEGORY_ROOTS[category];
  if (!roots || roots.length === 0) return providers.length;
  return providers.filter((provider) => {
    const hay = provider.job + " " + provider.services.join(" ");
    return roots.some((root) => hay.includes(root));
  }).length;
}

export function categoryCountLabel(providers: Provider[], category: string): string {
  const n = countByCategory(providers, category);
  if (n <= 0) return "";
  if (n === 1) return "discover.countOne";
  if (n === 2) return "discover.countTwo";
  return "svc.nProviders";
}
