import { useMemo, useState } from "react";
import { Check, Clock3, Loader2 } from "lucide-react";
import { useLanguage } from "../../i18n";
import { setProviderAvailability, type ProviderAvailability } from "../../lib/availability";
import "./availability.css";

type Props = {
  providerId: number;
  initialRows: ProviderAvailability[];
  onSaved: (row: ProviderAvailability) => void;
};

type Draft = { enabled: boolean; start: string; end: string };

const DAYS_AR = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const DAYS_FR = ["Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi"];

function normalizeTime(value: string | null | undefined, fallback: string): string {
  return value?.slice(0, 5) || fallback;
}

export default function AvailabilityCalendar({ providerId, initialRows, onSaved }: Props) {
  const { lang, t } = useLanguage();
  const [drafts, setDrafts] = useState<Record<number, Draft>>(() => {
    const next: Record<number, Draft> = {};
    for (let day = 0; day < 7; day += 1) {
      const row = initialRows.find((item) => item.day_of_week === day && item.is_available);
      next[day] = {
        enabled: Boolean(row),
        start: normalizeTime(row?.start_time, "09:00"),
        end: normalizeTime(row?.end_time, "17:00"),
      };
    }
    return next;
  });
  const [saving, setSaving] = useState<number | null>(null);
  const [saved, setSaved] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const days = useMemo(() => (lang === "ar" ? DAYS_AR : DAYS_FR), [lang]);

  const update = (day: number, patch: Partial<Draft>) => {
    setDrafts((current) => ({ ...current, [day]: { ...current[day], ...patch } }));
    setSaved(null);
    setError(null);
  };

  const save = async (day: number) => {
    const draft = drafts[day];
    if (!draft) return;
    setSaving(day);
    setError(null);
    try {
      const row = await setProviderAvailability({
        providerId,
        dayOfWeek: day,
        startTime: draft.start,
        endTime: draft.end,
        isAvailable: draft.enabled,
      });
      onSaved(row);
      setSaved(day);
    } catch (err) {
      setError(err instanceof Error ? err.message : "availability.saveError");
    } finally {
      setSaving(null);
    }
  };

  return (
    <section className="availability-card">
      <div className="availability-card-head">
        <div>
          <span className="section-kicker">{t("availability.kicker")}</span>
          <h2>{t("availability.title")}</h2>
          <p>{t("availability.subtitle")}</p>
        </div>
        <Clock3 size={22} aria-hidden="true" />
      </div>

      <div className="availability-week">
        {days.map((dayName, day) => {
          const draft = drafts[day];
          return (
            <div className="availability-day" key={day}>
              <div className="availability-day-head">
                <strong>{dayName}</strong>
                <label className="availability-toggle">
                  <input
                    type="checkbox"
                    checked={draft.enabled}
                    onChange={(event) => update(day, { enabled: event.target.checked })}
                  />
                  <span>{draft.enabled ? t("availability.available") : t("availability.off")}</span>
                </label>
              </div>
              <div className="availability-times">
                <label>
                  <span>{t("availability.from")}</span>
                  <input type="time" value={draft.start} disabled={!draft.enabled} onChange={(event) => update(day, { start: event.target.value })} />
                </label>
                <span className="availability-arrow">→</span>
                <label>
                  <span>{t("availability.to")}</span>
                  <input type="time" value={draft.end} disabled={!draft.enabled} onChange={(event) => update(day, { end: event.target.value })} />
                </label>
              </div>
              <button className="primary availability-save" disabled={saving === day} onClick={() => void save(day)}>
                {saving === day ? <Loader2 size={15} className="spin" /> : saved === day ? <Check size={15} /> : null}
                {saved === day ? t("availability.saved") : t("availability.save")}
              </button>
            </div>
          );
        })}
      </div>
      {error ? <p className="availability-error">{t(error)}</p> : null}
      <p className="availability-footnote">{t("availability.oneHour")}</p>
    </section>
  );
}
