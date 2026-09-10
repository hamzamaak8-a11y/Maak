import { CalendarCheck2 } from "lucide-react";
import { useLanguage } from "../../i18n";

export type AvailabilityFilterValue = "" | "today" | "week";

export default function AvailabilityFilter({ value, onChange }: { value: AvailabilityFilterValue; onChange: (value: AvailabilityFilterValue) => void }) {
  const { t } = useLanguage();
  return (
    <label className="market-filter-select">
      <CalendarCheck2 size={15} aria-hidden="true" />
      <span className="sr-only">{t("search.availability")}</span>
      <select value={value} onChange={(event) => onChange(event.target.value as AvailabilityFilterValue)} aria-label={t("search.availability")}>
        <option value="">{t("search.anyAvailability")}</option>
        <option value="today">{t("search.availableToday")}</option>
        <option value="week">{t("search.availableWeek")}</option>
      </select>
    </label>
  );
}
