import { supabase } from "./supabaseClient";
import type { BookingRow, BookingStatus } from "../types";

export type CreateBookingInput = {
  providerListingId: number;
  serviceCategory: string;
  serviceDescription: string;
  serviceDate: string | null;
  locationText: string;
  customerNote?: string;
};

export async function createBooking(input: CreateBookingInput): Promise<BookingRow> {
  if (input.serviceDate !== null) {
    const when = new Date(input.serviceDate).getTime();
    if (!Number.isFinite(when) || when <= Date.now()) {
      throw new Error("invalid_service_date");
    }
  }
  const { data, error } = await supabase.rpc("create_booking", {
    p_provider_listing_id: input.providerListingId,
    p_service_category: input.serviceCategory,
    p_service_description: input.serviceDescription,
    p_service_date: input.serviceDate,
    p_location_text: input.locationText,
    p_customer_note: input.customerNote ?? "",
  });
  if (error) throw error;
  return data as BookingRow;
}

export async function getCustomerBookings(): Promise<BookingRow[]> {
  const { data, error } = await supabase
    .from("bookings")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as BookingRow[];
}

export async function getProviderBookings(): Promise<BookingRow[]> {
  const { data, error } = await supabase
    .from("bookings")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as BookingRow[];
}

export async function getBooking(id: string): Promise<BookingRow | null> {
  const { data, error } = await supabase
    .from("bookings")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as BookingRow) ?? null;
}

export async function cancelBooking(id: string): Promise<BookingRow> {
  const { data, error } = await supabase.rpc("cancel_booking", { p_booking_id: id });
  if (error) throw error;
  return data as BookingRow;
}

export async function acceptBooking(id: string): Promise<BookingRow> {
  const { data, error } = await supabase.rpc("accept_booking", { p_booking_id: id });
  if (error) throw error;
  return data as BookingRow;
}

export async function rejectBooking(id: string, reason: string): Promise<BookingRow> {
  const { data, error } = await supabase.rpc("reject_booking", {
    p_booking_id: id,
    p_reason: reason,
  });
  if (error) throw error;
  return data as BookingRow;
}

export async function startBooking(id: string): Promise<BookingRow> {
  const { data, error } = await supabase.rpc("start_booking", { p_booking_id: id });
  if (error) throw error;
  return data as BookingRow;
}

export async function completeBooking(id: string): Promise<BookingRow> {
  const { data, error } = await supabase.rpc("complete_booking", { p_booking_id: id });
  if (error) throw error;
  return data as BookingRow;
}

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  pending: "status.pending",
  accepted: "status.accepted",
  rejected: "status.rejected",
  cancelled: "status.cancelled",
  in_progress: "status.in_progress",
  completed: "status.completed",
};

export function mapBookingError(error: unknown): string {
  const raw =
    error && typeof error === "object" && "message" in error
      ? String((error as { message?: unknown }).message)
      : String(error ?? "");
  if (/not_authenticated/i.test(raw)) return "berr.notAuthenticated";
  if (/provider_not_bookable|provider_not_linked/i.test(raw))
    return "berr.notBookable";
  if (/invalid_service_date/i.test(raw)) return "berr.invalidServiceDate";
  if (/invalid_transition/i.test(raw))
    return "berr.invalidTransition";
  if (/reason_required/i.test(raw)) return "berr.reasonRequired";
  if (/forbidden/i.test(raw)) return "berr.forbidden";
  return "berr.generic";
}