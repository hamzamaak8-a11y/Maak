import { useMemo, useState } from "react";
import { ChevronRight, MapPin } from "lucide-react";
import { CategoryCard, ProviderRow, ProviderSkeleton, SearchBox, ServiceChip, StateCard, TrustStrip } from "../components/atoms";
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
  const { t, dir } = useLanguage();
  const [query, setQuery] = useState("");
  const { providers, status, refetch } = useProviders();

  const categories = useMemo(
    () => getCategories().map((c) => ({ ...c, count: t(categoryCountLabel(providers, c.name), { n: countByCategory(providers, c.name) }) })),
    [providers, t],
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
  const chevronFlip = dir === "rtl" ? { transform: "scaleX(-1)" } : undefined;

  return (
    <main className="home">
      <section className="mk-home-head" aria-labelledby="home-prompt">
        <button
          className="mk-home-loc"
          type="button"
          onClick={() => showToast(t("home.locationUnavailable"))}
        >
          <MapPin size={13} aria-hidden="true" />
          <span>{city || t("home.locate")}</span>
        </button>

        <p className="mk-greet">{name ? t("home.greetName", { name }) : t("home.greet")}</p>
        <h1 id="home-prompt" className="mk-home-title">{t("home.prompt")}</h1>
        <p className="mk-home-sub">{t("home.sub")}</p>

        <SearchBox value={query} onChange={setQuery} onSubmit={() => goDiscover(query)} />
        <TrustStrip />
      </section>

      <section aria-labelledby="home-services-heading">
        <div className="mk-section-head">
          <h2 id="home-services-heading">{t("home.services")}</h2>
          <button className="mk-link-btn" type="button" onClick={() => goDiscover("")}>
            {t("home.explore")}
            <ChevronRight size={14} aria-hidden="true" style={chevronFlip} />
          </button>
        </div>
        <div className="mk-cat-grid" aria-label={t("home.categoriesRail")}>
          {categories.map((category) => (
            <CategoryCard
              key={category.name}
              category={category}
              onClick={() => goDiscover(category.name)}
            />
          ))}
        </div>
        {availableServices.length > 0 ? (
          <div className="mk-rail" style={{ marginTop: 12 }} aria-label={t("home.servicesRail")}>
            {availableServices.map((service) => (
              <ServiceChip key={service} label={service} onClick={() => goDiscover(service)} />
            ))}
          </div>
        ) : null}
      </section>

      <section aria-labelledby="home-providers-heading">
        <div className="mk-section-head">
          <h2 id="home-providers-heading">{t("home.providers")}</h2>
          <button className="mk-link-btn" type="button" onClick={() => goDiscover("")}>
            {t("home.viewAll")}
            <ChevronRight size={14} aria-hidden="true" style={chevronFlip} />
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
          <div className="mk-provider-list">
            {featured.map((provider) => (
              <ProviderRow
                key={provider.id}
                provider={provider}
                onClick={() => navigate("/provider/" + provider.id)}
              />
            ))}
            {providers.length > featured.length ? (
              <button className="mk-btn mk-btn--secondary mk-btn--block" type="button" onClick={() => goDiscover("")}>
                {t("home.viewAllProviders")}
              </button>
            ) : null}
          </div>
        )}
      </section>
    </main>
  );
}
