import { supabase } from "./supabaseClient";
import { fetchProviders } from "../services";
import type { BookingRow, Profile, Provider, Review } from "../types";

export type CustomerBooking = BookingRow & {
  provider: { id: string; name: string | null; avatar_url: string | null; listingId: number | null } | null;
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

async function getPublicProviderMap(): Promise<Map<number, Provider>> {
  const providers = await fetchProviders();
  return new Map(providers.map((provider) => [provider.id, provider]));
}

export async function getCustomerBookings(): Promise<CustomerBooking[]> {
  const { data, error } = await supabase
    .from("bookings")
    .select("id, customer_id, provider_id, provider_listing_id, service_category, service_description, service_date, location_text, customer_note, provider_note, status, rejection_reason, customer_name, created_at, updated_at, accepted_at, started_at, completed_at, cancelled_at, price, currency, payment_status, payment_method, paid_at")
    .order("service_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;

  const bookings = (data ?? []) as BookingRow[];
  const providerMap = await getPublicProviderMap();
  return bookings.map((booking) => {
    const listing = booking.provider_listing_id == null ? undefined : providerMap.get(booking.provider_listing_id);
    return {
      ...booking,
      provider: listing?.provider_profile_id === booking.provider_id
        ? { id: booking.provider_id, name: listing.name || null, avatar_url: listing.image || null, listingId: listing.id }
        : null,
    };
  });
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
  const providerMap = await getPublicProviderMap();
  return reviews.map((review) => {
    const provider = Array.from(providerMap.values()).find((candidate) => candidate.provider_profile_id === review.provider_id);
    return { ...review, provider: provider ? { id: review.provider_id, name: provider.name || null } : null };
  });
}
