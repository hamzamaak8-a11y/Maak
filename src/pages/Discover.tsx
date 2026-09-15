import { useMemo, useState } from "react";
import { Sparkles } from "lucide-react";
import { CategoryChip, ProviderRow, ProviderSkeleton, StateCard } from "../components/atoms";
import SearchBar from "../components/search/SearchBar";
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
  const featuredProviders = useMemo(() => results.filter((provider) => provider.is_featured), [results]);
  const otherProviders = useMemo(() => results.filter((provider) => !provider.is_featured), [results]);

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
      <div className="mk-page-head">
        <div>
          <h1>{t("discover.title")}</h1>
          <p className="mk-page-sub">{t("discover.subV2")}</p>
        </div>
        {providers.length > 0 ? <span className="mk-count-badge">{providerCountLabel(providers.length, t)}</span> : null}
      </div>

      <SearchBar value={query} onChange={setQuery} onClear={clearAll} />

      <div className="mk-rail" style={{ marginTop: 12 }} aria-label={t("home.categoriesRail")}>
        {chips.map((item) => {
          const isAll = item.name === t("filters.all");
          const isActive = isAll ? !category : category === item.name;
          return (
            <CategoryChip
              key={item.name}
              category={item}
              active={isActive}
              onClick={() => setCategory(isAll ? "" : category === item.name ? "" : item.name)}
            />
          );
        })}
      </div>

      <div className="mk-filter-selects" style={{ marginTop: 10 }} aria-label={t("search.filters")}>
        <RatingFilter value={minRating} onChange={setMinRating} />
        <PriceFilter value={priceRange} onChange={setPriceRange} />
        <AvailabilityFilter value={availability} onChange={setAvailability} />
        {cities.length > 0 ? (
          <span className="mk-filter-select">
            <span className="sr-only">{t("common.city")}</span>
            <select value={city} onChange={(event) => setCity(event.target.value)} aria-label={t("common.city")}>
              <option value="">{t("filters.allCities")}</option>
              {cities.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
          </span>
        ) : null}
        {hasActiveFilters ? (
          <button className="mk-btn mk-btn--ghost mk-btn--sm" type="button" onClick={clearAll} style={{ borderRadius: 999 }}>
            {t("discover.clearFilters")}
          </button>
        ) : null}
      </div>

      {status === "loading" ? <section style={{ marginTop: 16 }}><ProviderSkeleton rows={4} /></section> : null}
      {status === "error" ? <section style={{ marginTop: 16 }}><StateCard variant="error" actionLabel={t("common.retry")} onAction={refetch} /></section> : null}

      {status === "success" && featuredProviders.length > 0 ? (
        <section aria-labelledby="featured-heading">
          <div className="mk-results-info">
            <h2 id="featured-heading">{t("featured.title")}</h2>
            <span className="mk-results-count">{providerCountLabel(featuredProviders.length, t)}</span>
          </div>
          <div className="mk-provider-list">
            {featuredProviders.map((provider) => <ProviderRow key={provider.id} provider={provider} onClick={() => navigate("/provider/" + provider.id)} />)}
          </div>
        </section>
      ) : null}

      {status === "success" ? (
        <section aria-labelledby="discover-results-heading">
          <div className="mk-results-info">
            <h2 id="discover-results-heading">
              {hasActiveFilters || featuredProviders.length > 0 ? t("featured.otherProviders") : t("discover.allProviders")}
            </h2>
            <span className="mk-results-count">{providerCountLabel(otherProviders.length, t)}</span>
          </div>
          <div className="mk-provider-list">
            {otherProviders.length === 0 ? (
              <StateCard
                variant="empty"
                emptyTitle={marketplaceEmpty ? t("home.emptyTitle") : featuredProviders.length > 0 ? t("featured.empty") : t("search.noMatches")}
                emptyBody={marketplaceEmpty ? t("home.emptyBody") : t("search.noMatchesBody")}
                actionLabel={marketplaceEmpty ? t("home.explore") : hasActiveFilters ? t("discover.clearFilters") : undefined}
                onAction={marketplaceEmpty ? () => window.scrollTo({ top: 0, behavior: "smooth" }) : hasActiveFilters ? clearAll : undefined}
              />
            ) : (
              otherProviders.map((provider) => <ProviderRow key={provider.id} provider={provider} onClick={() => navigate("/provider/" + provider.id)} />)
            )}
          </div>
        </section>
      ) : null}
    </main>
  );
}
