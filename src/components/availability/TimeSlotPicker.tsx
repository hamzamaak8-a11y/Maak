import { useEffect, useMemo, useState } from "react";
import { CalendarClock, Loader2 } from "lucide-react";
import { checkAvailability } from "../../lib/bookings";
import { isoForUtcDay, slotEnd, type ProviderAvailability } from "../../lib/availability";
import { useLanguage } from "../../i18n";
import "./availability.css";

type Props = {
  providerId: number;
  availability: ProviderAvailability[];
  value: string;
  onChange: (iso: string) => void;
};

type DayOption = { offset: number; key: string; label: string; short: string };

type Slot = { iso: string; label: string; available: boolean };

function buildDays(lang: "ar" | "fr"): DayOption[] {
  const formatter = new Intl.DateTimeFormat(lang === "ar" ? "ar-MA" : "fr-FR", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  const longFormatter = new Intl.DateTimeFormat(lang === "ar" ? "ar-MA" : "fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  const now = new Date();
  return Array.from({ length: 7 }, (_, offset) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + offset));
    return { offset, key: d.toISOString().slice(0, 10), label: longFormatter.format(d), short: formatter.format(d) };
  });
}

function buildSlots(dayOffset: number, rows: ProviderAvailability[]): string[] {
  const dayOfWeek = new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), new Date().getUTCDate() + dayOffset)).getUTCDay();
  const starts = new Set<string>();
  for (const row of rows.filter((item) => item.day_of_week === dayOfWeek && item.is_available)) {
    const [sh, sm] = row.start_time.slice(0, 5).split(":").map(Number);
    const [eh, em] = row.end_time.slice(0, 5).split(":").map(Number);
    for (let minutes = sh * 60 + sm; minutes + 60 <= eh * 60 + em; minutes += 60) {
      starts.add(`${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`);
    }
  }
  return [...starts].sort();
}

export default function TimeSlotPicker({ providerId, availability, value, onChange }: Props) {
  const { lang, t } = useLanguage();
  const days = useMemo(() => buildDays(lang), [lang]);
  const [dayOffset, setDayOffset] = useState(0);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    let active = true;
    const times = buildSlots(dayOffset, availability);
    setLoading(true);
    setLoadError(false);
    Promise.all(
      times.map(async (time) => {
        const iso = isoForUtcDay(dayOffset, time);
        try {
          const available = await checkAvailability(providerId, iso, slotEnd(iso));
          return { iso, label: time, available };
        } catch {
          return { iso, label: time, available: false };
        }
      }),
    ).then((next) => {
      if (active) setSlots(next);
    }).catch(() => {
      if (active) setLoadError(true);
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [availability, dayOffset, providerId]);

  return (
    <section className="slot-picker">
      <div className="slot-picker-head">
        <div>
          <label>{t("availability.chooseDate")}</label>
          <p>{t("availability.chooseDateHint")}</p>
        </div>
        <CalendarClock size={22} aria-hidden="true" />
      </div>
      <div className="slot-days" role="tablist" aria-label={t("availability.chooseDate")}>
        {days.map((day) => (
          <button key={day.key} className={day.offset === dayOffset ? "active" : ""} onClick={() => setDayOffset(day.offset)} role="tab" aria-selected={day.offset === dayOffset}>
            <strong>{day.short}</strong>
          </button>
        ))}
      </div>
      <p className="slot-selected-date">{days[dayOffset]?.label}</p>
      {loading ? (
        <div className="slot-state"><Loader2 className="spin" size={18} /> {t("availability.loadingSlots")}</div>
      ) : loadError ? (
        <div className="slot-state error">{t("availability.loadSlotsError")}</div>
      ) : slots.length === 0 ? (
        <div className="slot-state">{t("availability.noSlots")}</div>
      ) : (
        <div className="slot-grid">
          {slots.map((slot) => (
            <button
              key={slot.iso}
              className={`slot-option${value === slot.iso ? " selected" : ""}${!slot.available ? " unavailable" : ""}`}
              disabled={!slot.available}
              onClick={() => onChange(slot.iso)}
              aria-pressed={value === slot.iso}
            >
              <span>{slot.label}</span>
              <small>{slot.available ? (value === slot.iso ? t("availability.selected") : t("availability.availableSlot")) : t("availability.booked")}</small>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}
