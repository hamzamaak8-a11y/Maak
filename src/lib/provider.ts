import { supabase } from "./supabaseClient";
import type { ProviderDashboardStats } from "../types";

type ProviderDashboardError = { message?: unknown; code?: unknown };

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
    average_rating: 0,
    total_reviews: 0,
    upcoming_bookings: [],
    recent_activity: [],
  }) as ProviderDashboardStats;
}
