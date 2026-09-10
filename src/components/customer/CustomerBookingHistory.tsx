import { CalendarDays, ChevronLeft, ChevronRight, Clock3, MapPin, WalletCards } from "lucide-react";
import type { CustomerBooking } from "../../lib/customer";
import { BOOKING_STATUS_LABELS } from "../../lib/bookings";
import { useLanguage } from "../../i18n";

type Props = { bookings: CustomerBooking[] };

type Status = CustomerBooking["status"];

function statusClass(status: Status): string {
  return `status-pill ${status === "pending" ? "pending" : status === "accepted" ? "accepted" : status === "in_progress" ? "progress" : status === "completed" ? "done" : status === "rejected" ? "rejected" : "cancelled"}`;
}

function formatDate(value: string | null, lang: string): string {
  if (!value) return "—";
  try { return new Intl.DateTimeFormat(lang === "fr" ? "fr-FR" : "ar-MA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); } catch { return value; }
}

export default function CustomerBookingHistory({ bookings }: Props) {
  const { t, lang } = useLanguage();
  return (
    <section className="customer-card" aria-labelledby="customer-bookings-heading">
      <div className="customer-card-head">
        <div><span className="section-kicker">{t("customer.activityKicker")}</span><h2 id="customer-bookings-heading">{t("customer.bookingsTitle")}</h2></div>
        <span className="count-badge">{bookings.length}</span>
      </div>
      {bookings.length === 0 ? <div className="customer-empty"><CalendarDays size={23} /><h3>{t("customer.noBookings")}</h3><p>{t("customer.noBookingsBody")}</p></div> : (
        <div className="customer-booking-list">
          {bookings.map((booking) => (
            <article className="customer-booking-item" key={booking.id}>
              <div className="customer-booking-avatar">
                {booking.provider?.avatar_url ? <img src={booking.provider.avatar_url} alt="" /> : <span>{(booking.provider?.name || t("account.roleProvider")).slice(0, 1).toUpperCase()}</span>}
              </div>
              <div className="customer-booking-content">
                <div className="customer-booking-top"><span className={statusClass(booking.status)}>{t(BOOKING_STATUS_LABELS[booking.status])}</span><strong>{booking.provider?.name || t("account.roleProvider")}</strong></div>
                <h3>{t(booking.service_category)}</h3>
                <div className="customer-booking-meta"><span><CalendarDays size={13} />{formatDate(booking.service_date, lang)}</span>{booking.location_text ? <span><MapPin size={13} />{booking.location_text}</span> : null}</div>
                <div className="customer-booking-bottom">
                  <span><WalletCards size={13} />{booking.price == null ? t("customer.pricePending") : `${booking.price.toFixed(2)} ${booking.currency}`}</span>
                  {booking.status === "pending" || booking.status === "accepted" || booking.status === "in_progress" ? <span><Clock3 size={13} />{t("customer.upcoming")}</span> : null}
                </div>
              </div>
              {booking.provider_listing_id ? <button className="customer-booking-arrow" type="button" aria-label={t("customer.providerInfo")} title={t("customer.providerInfo")} disabled>
                {lang === "fr" ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
              </button> : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
