import { Star } from "lucide-react";
import { useLanguage } from "../../i18n";

export default function RatingFilter({ value, onChange }: { value: number | null; onChange: (value: number | null) => void }) {
  const { t } = useLanguage();
  return (
    <label className="market-filter-select">
      <Star size={15} aria-hidden="true" />
      <span className="sr-only">{t("search.rating")}</span>
      <select value={value == null ? "" : String(value)} onChange={(event) => onChange(event.target.value ? Number(event.target.value) : null)} aria-label={t("search.rating")}>
        <option value="">{t("search.anyRating")}</option>
        {[4, 3, 2, 1].map((rating) => <option key={rating} value={rating}>{rating}+ ★</option>)}
      </select>
    </label>
  );
}
