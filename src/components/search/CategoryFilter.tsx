import { SlidersHorizontal } from "lucide-react";
import { getCategories } from "../../services";
import { useLanguage } from "../../i18n";

export default function CategoryFilter({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const { t, catLabel } = useLanguage();
  const categories = getCategories();
  return (
    <label className="market-filter-select">
      <SlidersHorizontal size={15} aria-hidden="true" />
      <span className="sr-only">{t("search.category")}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)} aria-label={t("search.category")}>
        <option value="">{t("filters.all")}</option>
        {categories.map((category) => (
          <option key={category.name} value={category.name}>{catLabel(category.name)}</option>
        ))}
      </select>
    </label>
  );
}
