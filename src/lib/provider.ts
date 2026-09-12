import { supabase } from "./supabaseClient";
import { getProviderReviews } from "./reviews";
import type { Provider, ProviderDashboardStats } from "../types";

type ProviderDashboardError = { message?: unknown; code?: unknown };

type PublicProviderDetails = {
  rating: number;
  reviewCount: number;
  availability: "available" | "unknown";
};

export type ProviderService = {
  id: string;
  provider_id: string;
  name: string;
  description: string | null;
  price: number | null;
  currency: string;
  duration_minutes: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ProviderServiceInput = {
  name: string;
  description?: string | null;
  price?: number | null;
  currency?: string;
  duration_minutes?: number | null;
  is_active?: boolean;
};

function mapServiceError(error: unknown): Error {
  const raw = error && typeof error === "object" && "message" in error ? String((error as { message?: unknown }).message ?? "") : String(error ?? "");
  if (/not_authenticated|JWT/i.test(raw)) return new Error("providerServices.notAuthenticated");
  if (/forbidden/i.test(raw)) return new Error("providerServices.forbidden");
  if (/not_found/i.test(raw)) return new Error("providerServices.notFound");
  return new Error(raw || "providerServices.saveFail");
}

function normalizeServiceInput(data: ProviderServiceInput): ProviderServiceInput {
  const name = data.name.trim();
  if (!name) throw new Error("providerServices.nameRequired");
  const price = data.price == null || Number.isNaN(Number(data.price)) ? null : Number(data.price);
  if (price != null && (!Number.isFinite(price) || price < 0)) throw new Error("providerServices.priceInvalid");
  const currency = (data.currency ?? "USD").trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error("providerServices.currencyInvalid");
  const duration = data.duration_minutes == null || data.duration_minutes === 0 ? null : Number(data.duration_minutes);
  if (duration != null && (!Number.isInteger(duration) || duration <= 0)) throw new Error("providerServices.durationInvalid");
  return { name, description: data.description?.trim() || null, price, currency, duration_minutes: duration, is_active: data.is_active ?? true };
}

export async function addService(data: ProviderServiceInput): Promise<ProviderService> {
  const input = normalizeServiceInput(data);
  const { data: row, error } = await supabase.rpc("add_provider_service", {
    p_name: input.name,
    p_description: input.description,
    p_price: input.price,
    p_currency: input.currency,
    p_duration_minutes: input.duration_minutes,
    p_is_active: input.is_active,
  });
  if (error) throw mapServiceError(error);
  return row as ProviderService;
}

export async function updateService(serviceId: string, data: ProviderServiceInput): Promise<ProviderService> {
  const input = normalizeServiceInput(data);
  const { data: row, error } = await supabase.rpc("update_provider_service", {
    p_service_id: serviceId,
    p_name: input.name,
    p_description: input.description,
    p_price: input.price,
    p_currency: input.currency,
    p_duration_minutes: input.duration_minutes,
    p_is_active: input.is_active,
  });
  if (error) throw mapServiceError(error);
  return row as ProviderService;
}

export async function deleteService(serviceId: string): Promise<void> {
  const { error } = await supabase.rpc("delete_provider_service", { p_service_id: serviceId });
  if (error) throw mapServiceError(error);
}

export async function getServices(): Promise<ProviderService[]> {
  const { data, error } = await supabase.rpc("get_provider_services");
  if (error) throw mapServiceError(error);
  return (data ?? []) as ProviderService[];
}

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
