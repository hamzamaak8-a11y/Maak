import { useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { CategoryChip, ProviderRow, ProviderSkeleton, StateCard } from "../components/atoms";
import SearchBar from "../components/search/SearchBar";
import CategoryFilter from "../components/search/CategoryFilter";
import RatingFilter from "../components/search/RatingFilter";
import PriceFilter, { type PriceRange } from "../components/search/PriceFilter";
import AvailabilityFilter, { type AvailabilityFilterValue } from "../components/search/AvailabilityFilter";
import { categoryCountLabel, countByCategory, filterMarketplaceProviders, getCategories } from "../services";
import { useProviders } from "../hooks/useProviders";
import type { Category } from "../types";
import { useRouter } from "../router";
import { useLanguage } from "../i18n";

type TranslateFunc = (key: string, vars?: Record<string, string | number>) => string;

const providerCountLabel = (n: number, t: TranslateFunc): string => {
  if (n <= 0) return "";
  if (n === 1) return t("discover.countOne");
  if (n === 2) return t("discover.countTwo");
  return t("discover.countMany", { n });
};

export default function Discover() {
  const { t } = useLanguage();
  const { navigate } = useRouter();
  const initialQuery = useMemo(() => new URLSearchParams(window.location.search).get("q") || "", []);
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState("");
  const [city, setCity] = useState("");
  const [minRating, setMinRating] = useState<number | null>(null);
  const [priceRange, setPriceRange] = useState<PriceRange>("");
  const [availability, setAvailability] = useState<AvailabilityFilterValue>("");
  const { providers, status, refetch } = useProviders();

  const categories = useMemo(
    () => getCategories().map((c) => ({ ...c, count: t(categoryCountLabel(providers, c.name), { n: countByCategory(providers, c.name) }) })),
    [providers, t],
  );
  const chips: Category[] = useMemo(
    () => [
      { name: t("filters.all"), icon: Sparkles, count: providerCountLabel(providers.length, t) },
      ...categories,
    ],
    [categories, providers.length, t],
  );
  const cities = useMemo(
    () => Array.from(new Set(providers.map((p) => p.city).filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b)),
    [providers],
  );

  const results = useMemo(
    () => filterMarketplaceProviders(providers, { query, category, city, minRating, priceRange, availability }),
    [providers, query, category, city, minRating, priceRange, availability],
  );

  const hasActiveFilters = Boolean(query.trim() || category || city || minRating != null || priceRange || availability);
  const clearAll = () => {
    setQuery("");
    setCategory("");
    setCity("");
    setMinRating(null);
    setPriceRange("");
    setAvailability("");
  };

  const marketplaceEmpty = providers.length === 0 && !hasActiveFilters;

  return (
    <main className="screen discover">
      <div className="page-title">
        <h1>{t("discover.title")}</h1>
        {providers.length > 0 ? <span className="count-badge">{providerCountLabel(providers.length, t)}</span> : null}
      </div>

      <SearchBar value={query} onChange={setQuery} />

      <section id="discover-categories" className="content-section discover-categories">
        <div className="section-heading"><h2>{t("home.categoriesRail")}</h2></div>
        <div className="category-rail" aria-label={t("home.categoriesRail")}>
          {chips.map((item) => {
            const isAll = item.name === t("filters.all");
            const isActive = isAll ? !category : category === item.name;
            return (
              <CategoryChip
                key={item.name}
                category={item}
                active={isActive}
                onClick={() => {
                  if (isAll) setCategory("");
                  else setCategory(category === item.name ? "" : item.name);
                }}
              />
            );
          })}
        </div>
      </section>

      <section className="market-filter-panel" aria-label={t("search.filters")}>
        <div className="market-filter-row">
          <CategoryFilter value={category} onChange={setCategory} />
          <RatingFilter value={minRating} onChange={setMinRating} />
          <PriceFilter value={priceRange} onChange={setPriceRange} />
          <AvailabilityFilter value={availability} onChange={setAvailability} />
          <label className="market-filter-select">
            <span className="sr-only">{t("common.city")}</span>
            <select value={city} onChange={(event) => setCity(event.target.value)} aria-label={t("common.city")}>
              <option value="">{t("filters.allCities")}</option>
              {cities.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </label>
          {hasActiveFilters ? <button className="filter-clear" onClick={clearAll}>{t("discover.clearFilters")}</button> : null}
        </div>
      </section>

      <section className="content-section providers-section">
        <div className="section-heading">
          <div>
            <span className="section-kicker">{hasActiveFilters ? t("search.filteredResults") : t("discover.allProviders")}</span>
            <h2>{hasActiveFilters ? t("discover.resultsCount", { n: results.length }) : t("discover.allProviders")}</h2>
          </div>
          <span className="results-count">{providerCountLabel(results.length, t)}</span>
        </div>
        <div className="discover-results">
          {status === "loading" ? (
            <ProviderSkeleton rows={4} />
          ) : status === "error" ? (
            <StateCard variant="error" actionLabel={t("common.retry")} onAction={refetch} />
          ) : results.length === 0 ? (
            <StateCard
              variant="empty"
              emptyTitle={marketplaceEmpty ? t("home.emptyTitle") : t("search.noMatches")}
              emptyBody={marketplaceEmpty ? t("home.emptyBody") : t("search.noMatchesBody")}
              actionLabel={marketplaceEmpty ? t("home.explore") : hasActiveFilters ? t("discover.clearFilters") : undefined}
              onAction={marketplaceEmpty ? () => document.getElementById("discover-categories")?.scrollIntoView({ behavior: "smooth", block: "start" }) : hasActiveFilters ? clearAll : undefined}
            />
          ) : (
            results.map((provider) => <ProviderRow key={provider.id} provider={provider} onClick={() => navigate("/provider/" + provider.id)} />)
          )}
        </div>
      </section>
    </main>
  );
}
