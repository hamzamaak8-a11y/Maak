import { categories } from "./data";
import type { Category, Provider } from "./types";

const API_BASE: string = (import.meta.env.VITE_API_URL as string | undefined) || "";

/**
 * Marketplace data comes exclusively from the Worker API (which applies the
 * published-real-provider filter server-side). There is intentionally NO
 * client-side fallback dataset: when the API is unreachable or returns an
 * error we surface an honest error state, and when it returns an empty list
 * the marketplace shows an honest empty state. Never fabricate providers.
 */
export async function fetchProviders(): Promise<Provider[]> {
  const res = await fetch(API_BASE + "/api/providers");
  if (!res.ok) {
    throw new Error("svc.errProviders");
  }
  const data: unknown = await res.json();
  return Array.isArray(data) ? (data as Provider[]) : [];
}

export async function fetchProvider(id: number): Promise<Provider | undefined> {
  const res = await fetch(API_BASE + "/api/providers/" + id);
  if (res.status === 404) return undefined;
  if (!res.ok) {
    throw new Error("svc.errProvider");
  }
  return (await res.json()) as Provider;
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
