import type { Provider } from "../../types";
import { useLanguage } from "../../i18n";

export default function ProviderServices({ provider }: { provider: Provider }) {
  const { t } = useLanguage();
  return (
    <section className="public-provider-section" aria-labelledby="provider-services-title">
      <span className="section-kicker">{t("home.services")}</span>
      <h2 id="provider-services-title">{t("pd.servicesTitle")}</h2>
      {provider.services.length ? (
        <div className="public-provider-services">
          {provider.services.map((service) => <span className="chip" key={service}>{t(service)}</span>)}
        </div>
      ) : <p className="public-provider-muted">{t("pdetail.notDefined")}</p>}
    </section>
  );
}
