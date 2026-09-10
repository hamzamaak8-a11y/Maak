import { supabase } from "./supabaseClient";
import { getProviderReviews } from "./reviews";
import type { Provider, ProviderDashboardStats } from "../types";

type ProviderDashboardError = { message?: unknown; code?: unknown };

type PublicProviderDetails = {
  rating: number;
  reviewCount: number;
  availability: "available" | "unknown";
};

export function mapProviderDashboardError(error: unknown): Error {
  const source = (error ?? {}) as ProviderDashboardError;
  const raw = typeof source.message === "string" ? source.message : String(source.code ?? "");
  const mapped = /not_authenticated/i.test(raw)
    ? "providerDashboard.notAuthenticated"
    : /forbidden/i.test(raw)
      ? "providerDashboard.forbidden"
      : "providerDashboard.loadFailed";
  const result = new Error(mapped);
  const enriched = result as Error & { cause?: unknown };
  enriched.cause = error;
  return result;
}

export async function fetchProviderDashboardStats(): Promise<ProviderDashboardStats> {
  const { data, error } = await supabase.rpc("get_provider_dashboard_stats");
  if (error) throw mapProviderDashboardError(error);
  return (data ?? {
    total_completed_bookings: 0,
    total_earnings: null,
    total_earnings_currency: null,
    average_rating: 0,
    total_reviews: 0,
    upcoming_bookings: [],
    recent_activity: [],
  }) as ProviderDashboardStats;
}

/** Loads public-facing provider facts without bypassing the existing Worker or RLS boundaries. */
export async function fetchPublicProviderDetails(provider: Provider): Promise<PublicProviderDetails> {
  const fallbackRating = provider.rating ? Number(provider.rating) : 0;
  const fallbackCount = Number(provider.reviews) || 0;

  if (!provider.provider_profile_id) {
    return {
      rating: Number.isFinite(fallbackRating) ? fallbackRating : 0,
      reviewCount: fallbackCount,
      availability: provider.available === true ? "available" : "unknown",
    };
  }

  try {
    const summary = await getProviderReviews(provider.provider_profile_id, 1, 0);
    return {
      rating: summary.total_count > 0 ? summary.average_rating : (Number.isFinite(fallbackRating) ? fallbackRating : 0),
      reviewCount: summary.total_count || fallbackCount,
      availability: provider.available === true ? "available" : "unknown",
    };
  } catch {
    return {
      rating: Number.isFinite(fallbackRating) ? fallbackRating : 0,
      reviewCount: fallbackCount,
      availability: provider.available === true ? "available" : "unknown",
    };
  }
}

export type { PublicProviderDetails };
