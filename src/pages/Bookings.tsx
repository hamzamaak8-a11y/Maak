import { useEffect, useState } from "react";
import { CalendarDays, ClipboardList, MapPin, X } from "lucide-react";
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

const STATUS_CLASS: Record<BookingStatus, string> = {
  pending: "mk-status--pending",
  accepted: "mk-status--accepted",
  in_progress: "mk-status--progress",
  completed: "mk-status--done",
  rejected: "mk-status--rejected",
  cancelled: "mk-status--cancelled",
};

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

  if (authLoading) {
    return (
      <main className="screen bookings-screen" aria-busy="true">
        <div className="mk-provider-list">
          {Array.from({ length: 2 }).map((_, index) => (
            <div key={index} className="mk-card" style={{ padding: 16, pointerEvents: "none" }}>
              <span className="mk-skel" style={{ height: 14, width: "40%", display: "block" }} />
              <span className="mk-skel" style={{ height: 11, width: "65%", display: "block", marginTop: 10 }} />
            </div>
          ))}
        </div>
      </main>
    );
  }

  if (!user) {
    const goAuth = (target: "/login" | "/register") => { rememberReturnTo("/bookings"); navigate(target); };
    return (
      <main className="screen bookings-screen">
        <div className="mk-page-head">
          <div>
            <h1>{t("bookings.title")}</h1>
            <p className="mk-page-sub">{t("bookings.sub")}</p>
          </div>
        </div>
        <div className="mk-state">
          <span className="mk-state-icon"><ClipboardList size={24} aria-hidden="true" /></span>
          <h3>{t("bookings.loginRequired")}</h3>
          <p>{t("bookings.loginRequiredBody")}</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", marginTop: 6 }}>
            <button type="button" className="mk-btn" onClick={() => goAuth("/login")}>{t("adminLogin.signIn")}</button>
            <button type="button" className="mk-btn mk-btn--secondary" onClick={() => goAuth("/register")}>{t("auth.createAccountBtn")}</button>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="screen bookings-screen">
      <div className="mk-page-head">
        <div>
          <h1>{t("bookings.title")}</h1>
          <p className="mk-page-sub">{t("bookings.sub")}</p>
        </div>
        <span className="mk-count-badge" aria-label={t("bk.countBadge", { n: bookings.length })}>{bookings.length}</span>
      </div>

      <div className="mk-seg" role="tablist" aria-label={t("bookings.title")}>
        {TABS.map((item) => (
          <button
            type="button"
            key={item.key}
            className={"mk-seg-item" + (tab === item.key ? " is-active" : "")}
            role="tab"
            aria-selected={tab === item.key}
            onClick={() => setTab(item.key)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div style={{ marginTop: 14 }}>
        {loading ? (
          <div className="mk-provider-list" aria-busy="true">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="mk-card" style={{ padding: 16, pointerEvents: "none" }}>
                <span className="mk-skel" style={{ height: 12, width: "35%", display: "block" }} />
                <span className="mk-skel" style={{ height: 15, width: "55%", display: "block", marginTop: 10 }} />
                <span className="mk-skel" style={{ height: 11, width: "70%", display: "block", marginTop: 10 }} />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="mk-state" role="alert">
            <span className="mk-state-icon danger"><ClipboardList size={24} aria-hidden="true" /></span>
            <p>{t(error)}</p>
            <button type="button" className="mk-btn mk-btn--secondary mk-btn--sm" onClick={() => void refresh()}>{t("common.retry")}</button>
          </div>
        ) : bookings.length === 0 ? (
          <div className="mk-state">
            <span className="mk-state-icon"><ClipboardList size={24} aria-hidden="true" /></span>
            <h3>{t("bookings.empty")}</h3>
            <p>{t("bookings.emptyBody")}</p>
            <button type="button" className="mk-btn" style={{ marginTop: 6 }} onClick={() => navigate("/discover")}>{t("discover.title")}</button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="mk-state">
            <span className="mk-state-icon"><ClipboardList size={24} aria-hidden="true" /></span>
            <h3>{t("bookings.emptyFiltered")}</h3>
          </div>
        ) : (
          <div className="mk-provider-list">
            {filtered.map((booking: BookingRow) => {
              const provider = booking.provider_listing_id ? providerMap.get(booking.provider_listing_id) : undefined;
              const canCancel = booking.status === "pending";
              const canReview = booking.status === "completed" && Boolean(provider?.provider_profile_id) && !reviewedBookingIds.has(booking.id);
              return (
                <article className="mk-card mk-booking-card" key={booking.id}>
                  <div className="mk-booking-top">
                    <span className={"mk-status " + STATUS_CLASS[booking.status]}>{t(BOOKING_STATUS_LABELS[booking.status])}</span>
                    <span className="mk-booking-date">{fmtDate(booking.service_date, t, lang)}</span>
                  </div>

                  <div className="mk-booking-title">
                    {provider ? <Avatar name={provider.name} src={provider.image} size="sm" /> : <span className="mk-avatar mk-avatar--sm"><CalendarDays size={16} aria-hidden="true" /></span>}
                    <div style={{ minWidth: 0 }}>
                      <h3>{t(booking.service_category)}</h3>
                      <p className="mk-booking-provider">{provider ? provider.name : t("account.roleProvider")}</p>
                    </div>
                  </div>

                  <div className="mk-booking-meta">
                    <span><CalendarDays size={13} aria-hidden="true" /> {fmtDate(booking.service_date, t, lang)}</span>
                    {booking.location_text ? <span><MapPin size={13} aria-hidden="true" /> {booking.location_text}</span> : null}
                    {booking.price != null ? <span>{booking.price.toFixed(2)} {booking.currency}</span> : null}
                  </div>

                  {booking.service_description ? <p className="mk-booking-note">{booking.service_description}</p> : null}
                  {booking.provider_note ? <p className="mk-booking-note"><b>{t("bk.providerNote")}:</b> {booking.provider_note}</p> : null}
                  {booking.status === "rejected" && booking.rejection_reason ? <p className="mk-booking-note"><b>{t("bk.rejectionReason")}:</b> {booking.rejection_reason}</p> : null}

                  {canReview || canCancel ? (
                    <div className="mk-booking-actions">
                      {canReview ? (
                        <button type="button" className="mk-btn mk-btn--sm" onClick={() => setReviewId(booking.id)}>{t("reviews.serviceRating")}</button>
                      ) : null}
                      {canCancel ? (
                        cancelId === booking.id ? (
                          <span role="group" aria-label={t("bk.confirmCancel")} aria-busy={busy ? "true" : "false"} style={{ display: "inline-flex", gap: 8 }}>
                            <button type="button" className="mk-btn mk-btn--danger mk-btn--sm" onClick={() => void doCancel(booking.id)} disabled={busy}>
                              <X size={14} aria-hidden="true" /> {t("bk.confirmCancel")}
                            </button>
                            <button type="button" className="mk-btn mk-btn--ghost mk-btn--sm" onClick={() => setCancelId(null)} disabled={busy}>{t("bk.backOut")}</button>
                          </span>
                        ) : (
                          <button type="button" className="mk-btn mk-btn--ghost mk-btn--sm" onClick={() => setCancelId(booking.id)}>
                            <X size={14} aria-hidden="true" /> {t("bk.cancelRequest")}
                          </button>
                        )
                      ) : null}
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </div>

      {reviewId ? <ReviewForm bookingId={reviewId} onClose={() => setReviewId(null)} onSubmitted={(review) => setReviewedBookingIds((current) => new Set(current).add(review.booking_id))} /> : null}
    </main>
  );
}
