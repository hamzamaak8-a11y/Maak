import { CircleDollarSign } from "lucide-react";
import { useLanguage } from "../../i18n";

export type PriceRange = "" | "0-100" | "100-250" | "250-500" | "500+";

export default function PriceFilter({ value, onChange }: { value: PriceRange; onChange: (value: PriceRange) => void }) {
  const { t } = useLanguage();
  return (
    <label className="market-filter-select">
      <CircleDollarSign size={15} aria-hidden="true" />
      <span className="sr-only">{t("search.price")}</span>
      <select value={value} onChange={(event) => onChange(event.target.value as PriceRange)} aria-label={t("search.price")}>
        <option value="">{t("search.anyPrice")}</option>
        <option value="0-100">0 – 100</option>
        <option value="100-250">100 – 250</option>
        <option value="250-500">250 – 500</option>
        <option value="500+">500+</option>
      </select>
    </label>
  );
}
