import { useMemo, useState } from "react";
import { MapPin } from "lucide-react";
import { CategoryChip, ProviderRow, ProviderSkeleton, SearchBox, ServiceChip, StateCard, TrustStrip } from "../components/atoms";
import { categoryCountLabel, countByCategory, getCategories } from "../services";
import { useProviders } from "../hooks/useProviders";
import { useAuth } from "../auth";
import { useToast } from "../context";
import { useRouter } from "../router";
import { useLanguage } from "../i18n";

export default function Home() {
  const { navigate } = useRouter();
  const { showToast } = useToast();
  const { profile } = useAuth();
  const { t } = useLanguage();
  const [query, setQuery] = useState("");
  const { providers, status, refetch } = useProviders();

  const categories = useMemo(
    () => getCategories().map((c) => ({ ...c, count: t(categoryCountLabel(providers, c.name), { n: countByCategory(providers, c.name) }) })),
    [providers],
  );
  const availableServices = useMemo(() => {
    const freq: Record<string, number> = {};
    for (const p of providers) for (const s of p.services) freq[s] = (freq[s] || 0) + 1;
    return Object.entries(freq).sort((a, b) => b[1] - a[1]).map(([s]) => s).slice(0, 8);
  }, [providers]);

  const name = profile?.full_name?.trim();
  const city = profile?.city?.trim();
  const goDiscover = (term: string) =>
    navigate("/discover" + (term ? "?q=" + encodeURIComponent(term) : ""));
  const featured = providers.slice(0, 4);

  return (
    <main className="home">
      <div className="home-bar">
        <button
          className="home-loc"
          onClick={() => showToast(t("home.locationUnavailable"))}
        >
          <MapPin size={16} />
          <span>{city || t("home.locate")}</span>
        </button>
      </div>

      <section className="home-intro">
        <p className="home-greet">{name ? t("home.greetName", { name }) : t("home.greet")}</p>
        <h1 className="home-prompt">{t("home.prompt")}</h1>
        <p className="home-sub">{t("home.sub")}</p>
        <SearchBox value={query} onChange={setQuery} onSubmit={() => goDiscover(query)} />
      </section>

      <TrustStrip />

      <section className="home-section">
        <div className="home-section-head">
          <h2>{t("home.services")}</h2>
          <button className="text-button" onClick={() => goDiscover("")}>
            {t("home.explore")}
          </button>
        </div>
        <div className="category-rail" aria-label={t("home.categoriesRail")}>
          {categories.map((category) => (
            <CategoryChip
              key={category.name}
              category={category}
              onClick={() => goDiscover(category.name)}
            />
          ))}
        </div>
        {availableServices.length > 0 ? (
          <div className="service-rail" aria-label={t("home.servicesRail")}>
            {availableServices.map((service) => (
              <ServiceChip key={service} label={service} onClick={() => goDiscover(service)} />
            ))}
          </div>
        ) : null}
      </section>

      <section className="home-section">
        <div className="home-section-head">
          <h2>{t("home.providers")}</h2>
          <button className="text-button" onClick={() => goDiscover("")}>
            {t("home.viewAll")}
          </button>
        </div>
        {status === "loading" ? (
          <ProviderSkeleton rows={3} />
        ) : status === "error" ? (
          <StateCard variant="error" actionLabel={t("common.retry")} onAction={refetch} />
        ) : providers.length === 0 ? (
          <StateCard
            variant="empty"
            emptyTitle={t("home.emptyTitle")}
            emptyBody={t("home.emptyBody")}
            actionLabel={t("home.explore")}
            onAction={() => goDiscover("")}
          />
        ) : (
          <div className="provider-list">
            {featured.map((provider) => (
              <ProviderRow
                key={provider.id}
                provider={provider}
                onClick={() => navigate("/provider/" + provider.id)}
              />
            ))}
            {providers.length > featured.length ? (
              <button className="ghost-button home-more" onClick={() => goDiscover("")}>
                {t("home.viewAllProviders")}
              </button>
            ) : null}
          </div>
        )}
      </section>
    </main>
  );
}
