import { categories } from "./data";
import type { Category, Provider } from "./types";

const API_URL = import.meta.env.VITE_API_URL?.replace(/\/$/, "");

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
  const q = query.trim().toLocaleLowerCase();
  if (!q) return providers;
  const roots = CATEGORY_ROOTS[q] ?? [q];
  return providers.filter((provider) => {
    const hay = `${provider.job} ${provider.services.join(" ")} ${provider.name} ${provider.city}`.toLocaleLowerCase();
    return roots.some((needle) => hay.includes(needle.toLocaleLowerCase()));
  });
}

export type MarketplacePriceRange = "" | "0-100" | "100-250" | "250-500" | "500+";
export type MarketplaceAvailability = "" | "today" | "week";

export type MarketplaceFilters = {
  query: string;
  category: string;
  city: string;
  minRating: number | null;
  priceRange: MarketplacePriceRange;
  availability: MarketplaceAvailability;
};

function numericValue(value: string | null): number | null {
  if (!value) return null;
  const cleaned = value.replace(/,/g, ".").replace(/[^0-9.]/g, " ");
  const match = cleaned.match(/\d+(?:\.\d+)?/);
  if (!match) return null;
  const parsed = Number(match[0]);
  return Number.isFinite(parsed) ? parsed : null;
}

export function providerRating(provider: Provider): number | null {
  return numericValue(provider.rating);
}

export function providerPrice(provider: Provider): number | null {
  return numericValue(provider.price);
}

function matchesPriceRange(price: number | null, range: MarketplacePriceRange): boolean {
  if (!range) return true;
  if (price == null) return false;
  if (range === "0-100") return price <= 100;
  if (range === "100-250") return price > 100 && price <= 250;
  if (range === "250-500") return price > 250 && price <= 500;
  return price > 500;
}

export function filterMarketplaceProviders(providers: Provider[], filters: MarketplaceFilters): Provider[] {
  let result = filterProviders(providers, filters.query);

  if (filters.category) {
    result = filterProviders(result, filters.category);
  }

  if (filters.city) {
    result = result.filter((provider) => provider.city === filters.city);
  }

  if (filters.minRating != null) {
    result = result.filter((provider) => {
      const rating = providerRating(provider);
      return rating != null && rating >= filters.minRating!;
    });
  }

  if (filters.priceRange) {
    result = result.filter((provider) => matchesPriceRange(providerPrice(provider), filters.priceRange));
  }

  if (filters.availability) {
    result = result.filter((provider) => provider.available === true);
  }

  return result;
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
