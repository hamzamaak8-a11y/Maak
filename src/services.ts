import { categories } from "./data";
import type { Category, Provider } from "./types";
import { supabase } from "./lib/supabaseClient";

/**
 * Marketplace reads use the public Supabase policy for published, real
 * providers. There is intentionally no client-side fallback dataset: an
 * unreachable/erroring database produces an error state, while zero eligible
 * rows produces the honest empty marketplace state.
 */
export async function fetchProviders(): Promise<Provider[]> {
  const { data, error } = await supabase
    .from("providers")
    .select("*")
    .eq("listing_kind", "real")
    .not("published_at", "is", null)
    .not("provider_profile_id", "is", null)
    .order("id", { ascending: true });

  if (error) throw new Error("svc.errProviders");
  return (data ?? []) as Provider[];
}

export async function fetchProvider(id: number): Promise<Provider | undefined> {
  const { data, error } = await supabase
    .from("providers")
    .select("*")
    .eq("id", id)
    .eq("listing_kind", "real")
    .not("published_at", "is", null)
    .not("provider_profile_id", "is", null)
    .maybeSingle();

  if (error) throw new Error("svc.errProvider");
  return (data ?? undefined) as Provider | undefined;
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
