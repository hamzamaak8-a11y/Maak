import type { Env } from "./types";
import { HttpError } from "./admin";

/**
 * Push notifications through the free Expo Push Service (Android: FCM). The database trigger private.dispatch_push()
 * calls POST /push/notify for every new row of public.notifications; this endpoint is protected by a shared secret and
 * does nothing unless PUSH_WEBHOOK_SECRET is configured.
 */

const EXPO_PUSH_URL = "https://exp.host/--/api/v2/push/send";
const TIMEOUT_MS = 10_000;

type Lang = "en" | "ar" | "fr";
const TEXT: Record<string, Record<Lang, [string, string]>> = {
  "notifications.bookingNew": { en: ["New booking request", "A customer sent you a new request."], ar: ["طلب حجز جديد", "أرسل لك زبون طلبًا جديدًا."], fr: ["Nouvelle demande de réservation", "Un client vous a envoyé une demande."] },
  "notifications.bookingAccepted": { en: ["Request accepted", "The provider accepted your request."], ar: ["تم قبول الطلب", "قبل مقدّم الخدمة طلبك."], fr: ["Demande acceptée", "Le prestataire a accepté votre demande."] },
  "notifications.bookingRejected": { en: ["Request declined", "The provider declined your request."], ar: ["تم رفض الطلب", "اعتذر مقدّم الخدمة عن طلبك."], fr: ["Demande refusée", "Le prestataire a refusé votre demande."] },
  "notifications.bookingCancelled": { en: ["Booking cancelled", "A booking was cancelled."], ar: ["تم إلغاء الحجز", "تم إلغاء حجز."], fr: ["Réservation annulée", "Une réservation a été annulée."] },
  "notifications.bookingCancelledSupport": { en: ["Booking cancelled by support", "A booking was cancelled by the Maak team."], ar: ["ألغى الدعم الحجز", "ألغى فريق معاك حجزًا."], fr: ["Réservation annulée par le support", "L'équipe Maak a annulé une réservation."] },
  "notifications.bookingStarted": { en: ["Service started", "The provider has started your service."], ar: ["بدأت الخدمة", "بدأ مقدّم الخدمة تنفيذ خدمتك."], fr: ["Service commencé", "Le prestataire a commencé votre service."] },
  "notifications.bookingCompleted": { en: ["Service completed", "Your service is complete. You can now leave a review."], ar: ["اكتملت الخدمة", "اكتملت خدمتك. يمكنك الآن ترك تقييم."], fr: ["Service terminé", "Votre service est terminé. Vous pouvez laisser un avis."] },
  "notifications.bookingPrice": { en: ["Price set", "The provider set or updated the price of your booking."], ar: ["تم تحديد السعر", "حدّد مقدّم الخدمة أو عدّل سعر حجزك."], fr: ["Prix défini", "Le prestataire a défini ou modifié le prix de votre réservation."] },
  "notifications.newMessage": { en: ["New message", "You have a new message."], ar: ["رسالة جديدة", "وصلتك رسالة جديدة."], fr: ["Nouveau message", "Vous avez un nouveau message."] },
  "notifications.reviewReceived": { en: ["New review", "You received a new review."], ar: ["تقييم جديد", "وصلك تقييم جديد."], fr: ["Nouvel avis", "Vous avez reçu un nouvel avis."] },
};

const KEY_RE = /^notifications\.[A-Za-z]+(Title|Body)$/;

/** Server notifications carry translation keys; announcements carry free text, which is sent as it is. */
export function localize(title: string, body: string, lang: Lang): { title: string; body: string } {
  const pick = (raw: string, idx: 0 | 1) => {
    if (!KEY_RE.test(raw)) return raw;
    const entry = TEXT[raw.replace(/(Title|Body)$/, "")];
    return entry ? (entry[lang] ?? entry.en)[idx] : idx === 0 ? "Maak" : "";
  };
  return { title: pick(title, 0).slice(0, 100) || "Maak", body: pick(body, 1).slice(0, 240) };
}

function sameSecret(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

type Payload = { user_id?: unknown; type?: unknown; title?: unknown; body?: unknown; metadata?: unknown };
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function sendPush(env: Env, req: Request, payload: Payload): Promise<{ sent: number }> {
  const secret = env.PUSH_WEBHOOK_SECRET;
  if (!secret || secret.length < 24) throw new HttpError(404, "not_found"); // feature switched off
  if (!sameSecret(req.headers.get("X-Maak-Push-Secret") ?? "", secret)) throw new HttpError(401, "not_authenticated");

  const userId = typeof payload.user_id === "string" ? payload.user_id : "";
  if (!UUID_RE.test(userId) || typeof payload.title !== "string" || typeof payload.body !== "string") throw new HttpError(400, "invalid_payload");

  const headers = { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}`, "Content-Type": "application/json" };
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/push_tokens?user_id=eq.${userId}&select=token,lang`, { headers, signal: AbortSignal.timeout(TIMEOUT_MS) });
  if (!res.ok) throw new Error("token lookup failed: " + res.status);
  const tokens = (await res.json()) as Array<{ token: string; lang: Lang }>;
  if (tokens.length === 0) return { sent: 0 };

  const data = payload.metadata && typeof payload.metadata === "object" ? (payload.metadata as Record<string, unknown>) : {};
  const messages = tokens.map((t) => ({ to: t.token, ...localize(payload.title as string, payload.body as string, t.lang), data, sound: "default", channelId: "default", priority: "high" }));
  const push = await fetch(EXPO_PUSH_URL, {
    method: "POST", headers: { Accept: "application/json", "Content-Type": "application/json" }, body: JSON.stringify(messages), signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!push.ok) throw new Error("expo push failed: " + push.status);
  const tickets = ((await push.json()) as { data?: Array<{ status?: string; details?: { error?: string } }> }).data ?? [];

  // Tokens that Expo says no longer exist are removed so they are not tried again.
  const dead = tokens.filter((_, i) => tickets[i]?.status === "error" && tickets[i]?.details?.error === "DeviceNotRegistered").map((t) => t.token);
  for (const token of dead) {
    await fetch(`${env.SUPABASE_URL}/rest/v1/push_tokens?token=eq.${encodeURIComponent(token)}`, { method: "DELETE", headers, signal: AbortSignal.timeout(TIMEOUT_MS) }).catch(() => undefined);
  }
  return { sent: tickets.filter((t) => t.status === "ok").length };
}
