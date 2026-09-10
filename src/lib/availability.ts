import { supabase } from "./supabaseClient";

export type ProviderAvailability = {
  id: string;
  provider_id: number;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_available: boolean;
  created_at: string;
  updated_at: string;
};

export async function getMyProviderListingId(): Promise<number | null> {
  const { data, error } = await supabase.rpc("get_my_provider_listing_id");
  if (error) throw error;
  return typeof data === "number" ? data : null;
}

export async function getProviderAvailability(providerId: number): Promise<ProviderAvailability[]> {
  const { data, error } = await supabase.rpc("get_provider_availability", { p_provider_id: providerId });
  if (error) throw error;
  return (data ?? []) as ProviderAvailability[];
}

export async function setProviderAvailability(input: {
  providerId: number;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  isAvailable: boolean;
}): Promise<ProviderAvailability> {
  const { data, error } = await supabase.rpc("set_provider_availability", {
    p_provider_id: input.providerId,
    p_day_of_week: input.dayOfWeek,
    p_start_time: input.isAvailable ? input.startTime : null,
    p_end_time: input.isAvailable ? input.endTime : null,
    p_is_available: input.isAvailable,
  });
  if (error) throw error;
  return data as ProviderAvailability;
}

export function slotEnd(startIso: string): string {
  return new Date(new Date(startIso).getTime() + 60 * 60 * 1000).toISOString();
}

export function isoForUtcDay(dayOffset: number, time: string): string {
  const now = new Date();
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + dayOffset));
  const [hours, minutes] = time.slice(0, 5).split(":").map(Number);
  date.setUTCHours(hours, minutes, 0, 0);
  return date.toISOString();
}
