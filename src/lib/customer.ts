import { supabase } from "./supabaseClient";
import type { BookingRow, Profile, Review } from "../types";

export type CustomerBooking = BookingRow & {
  provider: { id: string; name: string | null; avatar_url: string | null } | null;
};

export type CustomerReview = Review & {
  provider: { id: string; name: string | null } | null;
};

export type CustomerProfileUpdate = Pick<Profile, "full_name" | "phone" | "city" | "avatar_url">;

export async function getCustomerProfile(): Promise<Profile> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  const userId = userData.user?.id;
  if (!userId) throw new Error("customer.notAuthenticated");

  const { data, error } = await supabase
    .from("profiles")
    .select("id, role, full_name, phone, city, avatar_url, account_status, created_at, updated_at")
    .eq("id", userId)
    .single();
  if (error) throw error;
  return data as Profile;
}

export async function updateCustomerProfile(data: CustomerProfileUpdate): Promise<Profile> {
  const current = await getCustomerProfile();
  const payload: CustomerProfileUpdate = {
    full_name: data.full_name?.trim() || null,
    phone: data.phone?.trim() || null,
    city: data.city?.trim() || null,
    avatar_url: data.avatar_url?.trim() || null,
  };

  const { data: updated, error } = await supabase
    .from("profiles")
    .update(payload)
    .eq("id", current.id)
    .select("id, role, full_name, phone, city, avatar_url, account_status, created_at, updated_at")
    .single();
  if (error) throw error;
  return updated as Profile;
}

async function getProviderProfiles(providerIds: string[]): Promise<Map<string, { id: string; name: string | null; avatar_url: string | null }>> {
  const result = new Map<string, { id: string; name: string | null; avatar_url: string | null }>();
  if (!providerIds.length) return result;
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, avatar_url")
    .in("id", providerIds);
  if (error) throw error;
  for (const row of (data ?? []) as Array<{ id: string; full_name: string | null; avatar_url: string | null }>) {
    result.set(row.id, { id: row.id, name: row.full_name, avatar_url: row.avatar_url });
  }
  return result;
}

export async function getCustomerBookings(): Promise<CustomerBooking[]> {
  const { data, error } = await supabase
    .from("bookings")
    .select("id, customer_id, provider_id, provider_listing_id, service_category, service_description, service_date, location_text, customer_note, provider_note, status, rejection_reason, customer_name, created_at, updated_at, accepted_at, started_at, completed_at, cancelled_at, price, currency, payment_status, payment_method, paid_at")
    .order("service_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;

  const bookings = (data ?? []) as BookingRow[];
  const providerMap = await getProviderProfiles(Array.from(new Set(bookings.map((booking) => booking.provider_id))));
  return bookings.map((booking) => ({ ...booking, provider: providerMap.get(booking.provider_id) ?? null }));
}

export async function getCustomerReviews(): Promise<CustomerReview[]> {
  const { data: userData, error: userError } = await supabase.auth.getUser();
  if (userError) throw userError;
  const userId = userData.user?.id;
  if (!userId) throw new Error("customer.notAuthenticated");

  const { data, error } = await supabase
    .from("reviews")
    .select("id, booking_id, customer_id, provider_id, rating, comment, is_hidden, created_at")
    .eq("customer_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw error;

  const reviews = (data ?? []) as Review[];
  const providerMap = await getProviderProfiles(Array.from(new Set(reviews.map((review) => review.provider_id))));
  return reviews.map((review) => ({
    ...review,
    provider: providerMap.get(review.provider_id) ? { id: review.provider_id, name: providerMap.get(review.provider_id)?.name ?? null } : null,
  }));
}
