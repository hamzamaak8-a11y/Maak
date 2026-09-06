import { MapPin } from "lucide-react";
import { useLanguage } from "../i18n";

/**
 * Marketplace filter bar.
 *
 * Only filters backed by real listing data are offered. City comes from the
 * providers' own `city` field. "Available now", rating sort and distance sort
 * were removed on purpose: real listings never carry live availability,
 * ratings or distances (refresh_provider_listing sets them to NULL), so those
 * controls would have been fabricated filters.
 */
export function FilterBar({
  cities,
  city,
  onCity,
  onClear,
  hasActive,
}: {
  cities: string[];
  city: string;
  onCity: (value: string) => void;
  onClear: () => void;
  hasActive: boolean;
}) {
  const { t } = useLanguage();
  return (
    <div className="discover-filterbar">
      <div className="filter-field">
        <MapPin size={14} />
        <select
          className="filter-select"
          value={city}
          onChange={(event) => onCity(event.target.value)}
          aria-label={t("common.city")}
        >
          <option value="">{t("filters.allCities")}</option>
          {cities.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      {hasActive ? (
        <button className="filter-clear" onClick={onClear}>
          {t("discover.clearFilters")}
        </button>
      ) : null}
    </div>
  );
}
