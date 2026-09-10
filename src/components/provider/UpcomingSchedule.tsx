import { CalendarClock, MapPin } from "lucide-react";
import type { UpcomingProviderBooking } from "../../types";

type UpcomingScheduleProps = {
  bookings: UpcomingProviderBooking[];
  title: string;
  empty: string;
  serviceLabel: string;
  statusLabel: (status: string) => string;
  formatDate: (value: string) => string;
  locationLabel: string;
  customerLabel: string;
};

export default function UpcomingSchedule({
  bookings,
  title,
  empty,
  serviceLabel,
  statusLabel,
  formatDate,
  locationLabel,
  customerLabel,
}: UpcomingScheduleProps) {
  return (
    <section className="provider-panel provider-schedule-panel">
      <div className="provider-panel-heading">
        <div>
          <span className="section-kicker">{serviceLabel}</span>
          <h2>{title}</h2>
        </div>
        <CalendarClock size={20} aria-hidden="true" />
      </div>

      {bookings.length === 0 ? (
        <div className="provider-panel-empty"><CalendarClock size={24} aria-hidden="true" /><span>{empty}</span></div>
      ) : (
        <div className="provider-schedule-list">
          {bookings.map((booking) => (
            <article className="provider-schedule-item" key={booking.id}>
              <div className="provider-schedule-date">
                <strong>{formatDate(booking.service_date)}</strong>
                <span>{statusLabel(booking.status)}</span>
              </div>
              <div className="provider-schedule-main">
                <h3>{booking.service_category}</h3>
                <p>{customerLabel}: {booking.customer_name}</p>
                {booking.location_text ? <small><MapPin size={13} aria-hidden="true" /> {locationLabel}: {booking.location_text}</small> : null}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
