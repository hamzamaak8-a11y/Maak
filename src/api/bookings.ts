import { supabase } from '../lib/supabase';
import type { Availability, Booking } from '../types';

export type CreateBookingInput = {
  providerListingId: number;
  serviceCategory: string;
  serviceDescription: string;
  serviceDate: string;
  locationText: string;
  customerNote?: string;
};

export async function checkAvailability(listingId: number, startIso: string, endIso: string): Promise<boolean> {
  const { data, error } = await supabase.rpc('check_availability', { p_provider_id: listingId, p_start_time: startIso, p_end_time: endIso });
  if (error) throw error;
  return Boolean(data);
}

export async function getProviderAvailability(listingId: number): Promise<Availability[]> {
  const { data, error } = await supabase.rpc('get_provider_availability', { p_provider_id: listingId });
  if (error) throw error;
  return (data ?? []) as Availability[];
}

export async function createBooking(input: CreateBookingInput): Promise<Booking> {
  const when = new Date(input.serviceDate).getTime();
  if (!Number.isFinite(when) || when <= Date.now()) throw new Error('invalid_service_date');
  const end = new Date(when + 3_600_000).toISOString();
  if (!(await checkAvailability(input.providerListingId, new Date(when).toISOString(), end))) throw new Error('slot_unavailable');
  const { data, error } = await supabase.rpc('create_booking', {
    p_provider_listing_id: input.providerListingId,
    p_service_category: input.serviceCategory,
    p_service_description: input.serviceDescription,
    p_service_date: input.serviceDate,
    p_location_text: input.locationText,
    p_customer_note: input.customerNote ?? '',
  });
  if (error) throw error;
  return data as Booking;
}

/** RLS scopes the result: a customer sees their own bookings, a provider the ones addressed to them. */
export async function listMyBookings(): Promise<Booking[]> {
  const { data, error } = await supabase.from('bookings').select('*').order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Booking[];
}

export async function getBooking(id: string): Promise<Booking | null> {
  const { data, error } = await supabase.from('bookings').select('*').eq('id', id).maybeSingle();
  if (error) throw error;
  return (data as Booking) ?? null;
}

const rpc = (name: string) => async (id: string, extra: Record<string, unknown> = {}): Promise<Booking> => {
  const { data, error } = await supabase.rpc(name, { p_booking_id: id, ...extra });
  if (error) throw error;
  return data as Booking;
};

export const cancelBooking = rpc('cancel_booking');
export const acceptBooking = rpc('accept_booking');
export const startBooking = rpc('start_booking');
export const completeBooking = rpc('complete_booking');
export const rejectBooking = (id: string, reason: string) => rpc('reject_booking')(id, { p_reason: reason });

export async function setBookingPrice(id: string, price: number, currency: string): Promise<Booking> {
  const cur = currency.trim().toUpperCase();
  if (!Number.isFinite(price) || price < 0) throw new Error('invalid_price');
  if (!/^[A-Z]{3}$/.test(cur)) throw new Error('invalid_currency');
  const { data, error } = await supabase.rpc('set_booking_price', { p_booking_id: id, p_price: price, p_currency: cur });
  if (error) throw error;
  return data as Booking;
}
