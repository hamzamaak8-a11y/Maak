import { useEffect, useState } from "react";
import { CalendarDays, ClipboardList, Loader2, MapPin, X } from "lucide-react";
import { useBookings, useToast } from "../context";
import { useProviders } from "../hooks/useProviders";
import { useRouter } from "../router";
import { Avatar } from "../components/atoms";
import { BOOKING_STATUS_LABELS, mapBookingError } from "../lib/bookings";
import { getProviderReviews } from "../lib/reviews";
import type { BookingRow, BookingStatus, Provider } from "../types";
import { useLanguage } from "../i18n";
import { useAuth } from "../auth";
import { rememberReturnTo } from "../lib/returnTo";
import ReviewForm from "../components/reviews/ReviewForm";

function statusClass(status: BookingStatus): string {
  return "status-pill " + (status === "pending" ? "pending" : status === "accepted" ? "accepted" : status === "in_progress" ? "progress" : status === "completed" ? "done" : status === "rejected" ? "rejected" : "cancelled");
}

type TranslateFunc = (key: string, vars?: Record<string, string | number>) => string;
function fmtDate(iso: string | null, t: TranslateFunc, lang: string): string {
  if (!iso) return t("common.unspecified");
  try { return new Intl.DateTimeFormat(lang === "fr" ? "fr-FR" : "ar-MA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso)); } catch { return iso; }
}

async function collectReviewedBookingIds(providerIds: string[]): Promise<Set<string>> {
  const reviewed = new Set<string>();
  await Promise.all(providerIds.map(async (providerId) => {
    let offset = 0; let total = 0;
    do {
      const page = await getProviderReviews(providerId, 50, offset);
      page.reviews.forEach((review) => reviewed.add(review.booking_id));
      total = page.total_count; offset += page.reviews.length;
    } while (offset < total && offset > 0);
  }));
  return reviewed;
}

export default function Bookings() {
  const { t, lang } = useLanguage();
  const { user, loading: authLoading } = useAuth();
  const { bookings, loading, error, refresh, cancelBooking } = useBookings();
  const { providers } = useProviders();
  const { navigate } = useRouter();
  const { showToast } = useToast();
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [reviewId, setReviewId] = useState<string | null>(null);
  const [reviewedBookingIds, setReviewedBookingIds] = useState<Set<string>>(() => new Set());
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"all" | "upcoming" | "done" | "cancelled">("all");
  const TABS: { key: "all" | "upcoming" | "done" | "cancelled"; label: string }[] = [
    { key: "all", label: t("filters.all") }, { key: "upcoming", label: t("bookings.upcoming") }, { key: "done", label: t("bookings.done") }, { key: "cancelled", label: t("bookings.cancelledFilter") },
  ];
  const filtered = bookings.filter((b) => tab === "all" ? true : tab === "upcoming" ? b.status === "pending" || b.status === "accepted" || b.status === "in_progress" : tab === "done" ? b.status === "completed" : b.status === "rejected" || b.status === "cancelled");
  const providerMap = new Map<number, Provider>();
  providers.forEach((p) => providerMap.set(p.id, p));

  useEffect(() => {
    let cancelled = false;
    const providerIds = Array.from(new Set(bookings.filter((b) => b.status === "completed").map((b) => b.provider_listing_id ? providerMap.get(b.provider_listing_id)?.provider_profile_id : null).filter((id): id is string => Boolean(id))));
    if (!providerIds.length) { setReviewedBookingIds(new Set()); return () => { cancelled = true; }; }
    void collectReviewedBookingIds(providerIds).then((ids) => { if (!cancelled) setReviewedBookingIds(ids); }).catch(() => { if (!cancelled) setReviewedBookingIds(new Set()); });
    return () => { cancelled = true; };
  }, [bookings, providers]);

  const doCancel = async (id: string) => {
    setBusy(true);
    try { await cancelBooking(id); showToast(t("bookings.cancelled")); setCancelId(null); }
    catch (err) { showToast(t(mapBookingError(err))); }
    finally { setBusy(false); }
  };

  if (authLoading) return <main className="screen bookings-screen" aria-busy="true"><div className="empty-state"><Loader2 className="spin" size={22} aria-hidden="true" /><p>{t("bookings.loading")}</p></div></main>;
  if (!user) {
    const goAuth = (target: "/login" | "/register") => { rememberReturnTo("/bookings"); navigate(target); };
    return <main className="screen bookings-screen"><section className="auth-gate" aria-labelledby="bookings-auth-title"><div className="page-title"><div><span className="section-kicker">{t("bookings.sub")}</span><h1 id="bookings-auth-title">{t("bookings.title")}</h1></div></div><h3>{t("bookings.loginRequired")}</h3><p>{t("bookings.loginRequiredBody")}</p><div className="actions"><button type="button" className="primary" onClick={() => goAuth("/login")}>{t("adminLogin.signIn")}</button><button type="button" className="ghost-button" onClick={() => goAuth("/register")}>{t("auth.createAccountBtn")}</button></div></section></main>;
  }

  return <main className="screen bookings-screen">
    <div className="page-title"><div><span className="section-kicker">{t("bookings.sub")}</span><h1>{t("bookings.title")}</h1></div><span className="count-badge" aria-label={t("bk.countBadge", { n: bookings.length })}>{t("bk.countBadge", { n: bookings.length })}</span></div>
    <div className="seg-tabs" role="tablist" aria-label={t("bookings.title")}>{TABS.map((item) => <button type="button" key={item.key} className={"seg-tab" + (tab === item.key ? " active" : "")} role="tab" aria-selected={tab === item.key} onClick={() => setTab(item.key)}>{item.label}</button>)}</div>
    {loading ? <div className="empty-state" aria-busy="true"><Loader2 className="spin" size={22} aria-hidden="true" /><p>{t("bookings.loading")}</p></div> : error ? <div className="empty-state" role="alert"><p>{t(error)}</p><button type="button" className="ghost-button" onClick={() => void refresh()}>{t("common.retry")}</button></div> : bookings.length === 0 ? <div className="empty-state"><ClipboardList size={24} aria-hidden="true" /><h3>{t("bookings.empty")}</h3><p>{t("bookings.emptyBody")}</p><button type="button" className="primary bookings-discover-cta" onClick={() => navigate("/discover")}>{t("discover.title")}</button></div> : filtered.length === 0 ? <div className="empty-state"><ClipboardList size={24} aria-hidden="true" /><h3>{t("bookings.emptyFiltered")}</h3></div> : <div className="bookings-list">{filtered.map((booking: BookingRow) => {
      const provider = booking.provider_listing_id ? providerMap.get(booking.provider_listing_id) : undefined;
      const canCancel = booking.status === "pending";
      const canReview = booking.status === "completed" && Boolean(provider?.provider_profile_id) && !reviewedBookingIds.has(booking.id);
      return <article className="booking-card" key={booking.id}>
        <div className="booking-icon" aria-hidden="true">{provider ? <Avatar name={provider.name} src={provider.image} /> : <CalendarDays size={20} />}</div>
        <div className="booking-main"><div className="booking-card-topline"><span className={statusClass(booking.status)}>{t(BOOKING_STATUS_LABELS[booking.status])}</span></div><h3>{t(booking.service_category)}</h3><p className="booking-provider-name">{provider ? provider.name : t("account.roleProvider")}</p><div className="booking-meta"><span><CalendarDays size={12} aria-hidden="true" /> {fmtDate(booking.service_date, t, lang)}</span>{booking.location_text ? <span><MapPin size={12} aria-hidden="true" /> {booking.location_text}</span> : null}</div>{booking.service_description ? <p className="booking-note">{booking.service_description}</p> : null}{booking.provider_note ? <p className="booking-note"><b>{t("bk.providerNote")}:</b> {booking.provider_note}</p> : null}{booking.status === "rejected" && booking.rejection_reason ? <p className="booking-reason"><b>{t("bk.rejectionReason")}:</b> {booking.rejection_reason}</p> : null}{canReview || canCancel ? <div className="booking-card-actions">{canReview ? <button type="button" className="primary mini-button" onClick={() => setReviewId(booking.id)}>{t("reviews.serviceRating")}</button> : null}{canCancel ? cancelId === booking.id ? <div className="booking-cancel-confirm" role="group" aria-label={t("bk.confirmCancel")} aria-busy={busy ? "true" : "false"}><button type="button" className="secondary mini-button" onClick={() => void doCancel(booking.id)} disabled={busy}><X size={14} aria-hidden="true" /> {t("bk.confirmCancel")}</button><button type="button" className="ghost-button mini-button" onClick={() => setCancelId(null)} disabled={busy}>{t("bk.backOut")}</button></div> : <button type="button" className="ghost-button mini-button" onClick={() => setCancelId(booking.id)}><X size={14} aria-hidden="true" /> {t("bk.cancelRequest")}</button> : null}</div> : null}</div>
      </article>;
    })}</div>}
    {reviewId ? <ReviewForm bookingId={reviewId} onClose={() => setReviewId(null)} onSubmitted={(review) => setReviewedBookingIds((current) => new Set(current).add(review.booking_id))} /> : null}
  </main>;
}
