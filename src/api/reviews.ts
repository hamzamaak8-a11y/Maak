import { supabase } from '../lib/supabase';
import type { Review, ReviewsSummary } from '../types';

export async function submitReview(bookingId: string, rating: number, comment?: string): Promise<Review> {
  const { data, error } = await supabase.rpc('submit_review', { p_booking_id: bookingId, p_rating: rating, p_comment: comment?.trim() || null });
  if (error) throw error;
  return data as Review;
}

export async function getProviderReviews(providerProfileId: string, limit = 10, offset = 0): Promise<ReviewsSummary> {
  const { data, error } = await supabase.rpc('get_provider_reviews', { p_provider_id: providerProfileId, p_limit: limit, p_offset: offset });
  if (error) throw error;
  const payload = (data ?? {}) as { reviews?: unknown; total_count?: unknown; average_rating?: unknown };
  const rows = Array.isArray(payload.reviews) ? (payload.reviews as Array<Partial<Review>>) : [];
  return {
    reviews: rows.map(r => ({
      id: String(r.id ?? ''), booking_id: String(r.booking_id ?? ''), customer_id: r.customer_id ?? null, provider_id: providerProfileId,
      rating: Number(r.rating ?? 0), comment: r.comment ?? null, is_hidden: false, created_at: String(r.created_at ?? ''),
    })),
    total_count: Number(payload.total_count ?? 0),
    average_rating: Number(payload.average_rating ?? 0),
  };
}

export async function listMyReviews(userId: string): Promise<Review[]> {
  const { data, error } = await supabase
    .from('reviews')
    .select('id, booking_id, customer_id, provider_id, rating, comment, is_hidden, created_at')
    .eq('customer_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as Review[];
}
