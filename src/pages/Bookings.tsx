import { useState } from "react";
import { CalendarDays, ClipboardList, Loader2, MapPin, X } from "lucide-react";
import { useBookings, useToast } from "../context";
import { useProviders } from "../hooks/useProviders";
import { useRouter } from "../router";
import { Avatar } from "../components/atoms";
import { BOOKING_STATUS_LABELS, mapBookingError } from "../lib/bookings";
import type { BookingRow, BookingStatus, Provider } from "../types";
import { useLanguage } from "../i18n";

function statusClass(status: BookingStatus): string {
  return (
    "status-pill " +
    (status === "pending"
      ? "pending"
      : status === "accepted"
        ? "accepted"
        : status === "in_progress"
          ? "progress"
          : status === "completed"
            ? "done"
            : status === "rejected"
              ? "rejected"
              : "cancelled")
  );
}

type TranslateFunc = (key: string, vars?: Record<string, string | number>) => string;

function fmtDate(iso: string | null, t: TranslateFunc, lang: string): string {
  if (!iso) return t("common.unspecified");
  try {
    const locale = lang === "fr" ? "fr-FR" : "ar-MA";
    return new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export default function Bookings() {
  const { t, lang } = useLanguage();
  const { bookings, loading, error, refresh, cancelBooking } = useBookings();
  const { providers } = useProviders();
  const { navigate } = useRouter();
  const { showToast } = useToast();
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<"all" | "upcoming" | "done" | "cancelled">("all");

  const TABS: { key: "all" | "upcoming" | "done" | "cancelled"; label: string }[] = [
    { key: "all", label: t("filters.all") },
    { key: "upcoming", label: t("bookings.upcoming") },
    { key: "done", label: t("bookings.done") },
    { key: "cancelled", label: t("bookings.cancelledFilter") },
  ];
  const filtered = bookings.filter((b) =>
    tab === "all"
      ? true
      : tab === "upcoming"
        ? b.status === "pending" || b.status === "accepted" || b.status === "in_progress"
        : tab === "done"
          ? b.status === "completed"
          : b.status === "rejected" || b.status === "cancelled",
  );

  const providerMap = new Map<number, Provider>();
  providers.forEach((p) => providerMap.set(p.id, p));

  const doCancel = async (id: string) => {
    setBusy(true);
    try {
      await cancelBooking(id);
      showToast(t("bookings.cancelled"));
      setCancelId(null);
    } catch (err) {
      showToast(t(mapBookingError(err)));
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="screen bookings-screen">
      <div className="page-title">
        <div>
          <span className="section-kicker">{t("bookings.sub")}</span>
          <h1>{t("bookings.title")}</h1>
        </div>
        <span className="count-badge">{t("bk.countBadge", { n: bookings.length })}</span>
      </div>

      <div className="seg-tabs" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={"seg-tab" + (tab === t.key ? " active" : "")}
            role="tab"
            aria-selected={tab === t.key}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="empty-state">
          <Loader2 className="spin" size={22} />
          <p>{t("bookings.loading")}</p>
        </div>
      ) : error ? (
        <div className="empty-state">
          <p>{t(error)}</p>
          <button className="ghost-button" onClick={() => void refresh()}>
            {t("common.retry")}
          </button>
        </div>
      ) : bookings.length === 0 ? (
        <div className="empty-state">
          <ClipboardList size={24} />
          <h3>{t("bookings.empty")}</h3>
          <p>{t("bookings.emptyBody")}</p>
          <button
            className="primary"
            style={{ marginTop: 8 }}
            onClick={() => navigate("/discover")}
          >
            {t("discover.title")}
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <ClipboardList size={24} />
          <h3>{t("bookings.emptyFiltered")}</h3>
        </div>
      ) : (
        filtered.map((booking) => {
          const provider = booking.provider_listing_id
            ? providerMap.get(booking.provider_listing_id)
            : undefined;
          const canCancel = booking.status === "pending";
          return (
            <div className="booking-card" key={booking.id}>
              <div className="booking-icon">
                {provider ? (
                  <Avatar name={provider.name} src={provider.image} />
                ) : (
                  <CalendarDays size={20} />
                )}
              </div>
              <div className="booking-main">
                <span className={statusClass(booking.status)}>
                  {t(BOOKING_STATUS_LABELS[booking.status])}
                </span>
                <h3>{t(booking.service_category)}</h3>
                <p>{provider ? provider.name : t("account.roleProvider")}</p>
                <small className="booking-meta">
                  <CalendarDays size={12} /> {fmtDate(booking.service_date, t, lang)}
                  {booking.location_text ? (
                    <>
                      <MapPin size={12} /> {booking.location_text}
                    </>
                  ) : null}
                </small>
                {booking.service_description ? (
                  <p className="booking-note">{booking.service_description}</p>
                ) : null}
                {booking.provider_note ? (
                  <p className="booking-note"><b>{t("bk.providerNote")}:</b> {booking.provider_note}</p>
                ) : null}
                {booking.status === "rejected" && booking.rejection_reason ? (
                  <p className="booking-reason"><b>{t("bk.rejectionReason")}:</b> {booking.rejection_reason}</p>
                ) : null}
                {canCancel ? (
                  cancelId === booking.id ? (
                    <div className="cta-row" style={{ marginTop: 10 }}>
                      <button
                        className="secondary mini-button"
                        onClick={() => doCancel(booking.id)}
                        disabled={busy}
                      >
                        <X size={14} /> {t("bk.confirmCancel")}
                      </button>
                      <button
                        className="ghost-button mini-button"
                        onClick={() => setCancelId(null)}
                        disabled={busy}
                      >
                        {t("bk.backOut")}
                      </button>
                    </div>
                  ) : (
                    <button
                      className="ghost-button mini-button"
                      style={{ marginTop: 8 }}
                      onClick={() => setCancelId(booking.id)}
                    >
                      <X size={14} /> {t("bk.cancelRequest")}
                    </button>
                  )
                ) : null}
              </div>
            </div>
          );
        })
      )}
    </main>
  );
}
