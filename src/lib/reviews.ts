import { supabase } from "./supabaseClient";
import type { ProviderReviewsSummary, Review } from "../types";

type RpcError = { message?: unknown; code?: unknown };

type ProviderReviewsPayload = {
  reviews?: unknown;
  total_count?: unknown;
  average_rating?: unknown;
};

/** Maps database error identifiers to stable translation keys used by the review UI. */
export function mapReviewError(error: unknown, fallback = "reviews.genericError"): Error {
  const source = (error ?? {}) as RpcError;
  const message = typeof source.message === "string" ? source.message : "";
  const keyByCode: Record<string, string> = {
    forbidden: "reviews.forbidden",
    booking_not_found: "reviews.bookingNotFound",
    booking_not_completed: "reviews.bookingNotCompleted",
    already_reviewed: "reviews.alreadyReviewed",
    invalid_rating: "reviews.invalidRating",
    comment_too_long: "reviews.commentTooLong",
    review_not_found: "reviews.reviewNotFound",
  };
  const key = keyByCode[message] ?? keyByCode[String(source.code)] ?? fallback;
  const mapped = new Error(key);
  const enriched = mapped as Error & { cause?: unknown };
  enriched.cause = error;
  return mapped;
}

/** Submits one review through the transactional, authorization-checked RPC. */
export async function submitReview(bookingId: string, rating: number, comment?: string | null): Promise<Review> {
  const { data, error } = await supabase.rpc("submit_review", {
    p_booking_id: bookingId,
    p_rating: rating,
    p_comment: comment ?? null,
  });
  if (error) throw mapReviewError(error, "reviews.submitFailed");
  return data as Review;
}

/** Fetches the public, non-hidden provider reviews and aggregate rating summary. */
export async function getProviderReviews(providerId: string, limit = 10, offset = 0): Promise<ProviderReviewsSummary> {
  const { data, error } = await supabase.rpc("get_provider_reviews", {
    p_provider_id: providerId,
    p_limit: limit,
    p_offset: offset,
  });
  if (error) throw mapReviewError(error, "reviews.loadFailed");

  const payload = (data ?? {}) as ProviderReviewsPayload;
  const rawReviews = Array.isArray(payload.reviews) ? payload.reviews : [];
  const reviews: Review[] = rawReviews.map((item) => {
    const row = item as Partial<Review>;
    return {
      id: String(row.id ?? ""),
      booking_id: String(row.booking_id ?? ""),
      customer_id: row.customer_id ? String(row.customer_id) : null,
      provider_id: providerId,
      rating: Number(row.rating ?? 0),
      comment: row.comment == null ? null : String(row.comment),
      is_hidden: false,
      created_at: String(row.created_at ?? ""),
    };
  });

  return {
    reviews,
    total_count: typeof payload.total_count === "number" ? payload.total_count : Number(payload.total_count ?? 0),
    average_rating: typeof payload.average_rating === "number" ? payload.average_rating : Number(payload.average_rating ?? 0),
  };
}
