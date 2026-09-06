import { AlertCircle, ArrowLeft, ChevronLeft, Clock3, Loader2, MapPin, MessageCircle, ShieldCheck, Star } from "lucide-react";
import { isBookable, useProvider } from "../hooks/useProviders";
import { useRouter } from "../router";
import { Avatar } from "../components/atoms";
import { useLanguage } from "../i18n";

export default function ProviderDetail({ id }: { id: number }) {
  const { t } = useLanguage();
  const { navigate } = useRouter();
  const { provider, status } = useProvider(id);

  if (status === "loading") {
    return (
      <main className="screen pdetail">
        <button className="pdetail-back" onClick={() => navigate("/discover")}>
          <ChevronLeft size={16} /> {t("common.backToDiscover")}
        </button>
        <div className="pdetail-loading">
          <Loader2 className="spin" size={24} />
          <p>{t("pdetail.loading")}</p>
        </div>
      </main>
    );
  }

  if (status === "error") {
    return (
      <main className="screen pdetail">
        <button className="pdetail-back" onClick={() => navigate("/discover")}>
          <ChevronLeft size={16} /> {t("common.backToDiscover")}
        </button>
        <div className="pdetail-error">
          <AlertCircle size={24} />
          <h3>{t("pdetail.error")}</h3>
          <p>{t("common.retry")}</p>
          <button className="ghost-button" onClick={() => navigate("/discover")}>{t("pdetail.back")}</button>
        </div>
      </main>
    );
  }

  if (!provider) {
    return (
      <main className="screen pdetail">
        <button className="pdetail-back" onClick={() => navigate("/discover")}>
          <ChevronLeft size={16} /> {t("common.backToDiscover")}
        </button>
        <div className="pdetail-error">
          <MapPin size={24} />
          <h3>{t("pdetail.notFound")}</h3>
        </div>
      </main>
    );
  }

  if (!isBookable(provider)) {
    return (
      <main className="screen pdetail">
        <button className="pdetail-back" onClick={() => navigate("/discover")}>
          <ChevronLeft size={16} /> {t("common.backToDiscover")}
        </button>
        <div className="pdetail-error">
          <ShieldCheck size={24} />
          <h3>{t("pdetail.notBookable")}</h3>
          <p>{t("pdetail.notBookableBody")}</p>
          <button className="ghost-button" onClick={() => navigate("/discover")}>{t("pdetail.back")}</button>
        </div>
      </main>
    );
  }

return (
    <main className="screen pdetail">
      <button className="pdetail-back" onClick={() => navigate("/discover")}>
        <ChevronLeft size={16} /> {t("common.backToDiscover")}
      </button>

      <div className="pdetail-grid">
        <section className="pdetail-identity">
          <div className="pdetail-photo">
            <Avatar name={provider.name} src={provider.image} />
            {provider.available != null ? (
              <span className={`dot ${provider.available ? "online" : "offline"}`} />
            ) : null}
          </div>
          <div className="pdetail-info">
            <span className="verified"><ShieldCheck size={12} /> {t("pd.verified")}</span>
          <h1 className="pdetail-name">{provider.name}</h1>
          <p className="pdetail-job">{provider.job}</p>
          <p className="pdetail-city"><MapPin size={13} /> {provider.city}</p>

          <ul className="pdetail-trust">
            <li>
              {provider.rating && Number(provider.rating) > 0 ? (
                <span className="t-ico gold"><Star size={15} fill="currentColor" /></span>
              ) : (
                <span className="t-ico"><Star size={15} fill="currentColor" /></span>
              )}
              <span className="t-val">
                {provider.rating && Number(provider.rating) > 0 ? (
                  <><b>{provider.rating}</b> <small>{t("pd.reviewsCount", { n: provider.reviews })}</small></>
                ) : (
                  <b>{t("common.new")}</b>
                )}
              </span>
            </li>
            {provider.experience ? (
              <li>
                <span className="t-ico"><Clock3 size={15} /></span>
                <span className="t-val"><b>{provider.experience}</b> <small>{t("pdetail.fromExperience")}</small></span>
              </li>
            ) : null}
            {provider.available != null ? (
              <li>
                <span className={`t-ico ${provider.available ? "green" : "muted"}`}>
                  <span className={`status-dot ${provider.available ? "on" : "off"}`} />
                </span>
                <span className="t-val"><b>{provider.available ? t("filters.availableNow") : t("filters.unavailableNow")}</b></span>
              </li>
            ) : null}
          </ul>

          <div className="pdetail-price">{t("pd.estimatedPrice")} <b>{provider.price ? provider.price : t("price.onContact")}</b></div>
          </div>

          <div className="pdetail-desktop-cta">
            <button className="primary" onClick={() => navigate(`/provider/${provider.id}/booking`)}>
              {t("pd.bookNow")} <ArrowLeft size={16} />
            </button>
            <button className="secondary" onClick={() => navigate("/chat")} aria-label={t("pd.contactProvider")}>
              <MessageCircle size={16} /> {t("pd.contact")}
            </button>
          </div>
        </section>

        <section className="pdetail-content">
          {provider.intro ? (
            <div className="pdetail-section">
              <span className="section-kicker">{t("steps.reviewBio")}</span>
              <h2>{t("pd.aboutProvider")}</h2>
              <p className="body-copy">{provider.intro}</p>
            </div>
          ) : null}

          <div className="pdetail-section">
            <span className="section-kicker">{t("home.services")}</span>
            <h2>{t("pdetail.offers")}</h2>
            <div className="pdetail-services">
              {provider.services.length ? (
                provider.services.map((service) => (
                  <span className="chip" key={service}>{t(service)}</span>
                ))
              ) : (
                <span className="muted">{t("pdetail.notDefined")}</span>
              )}
            </div>
          </div>

          <div className="pdetail-section">
            <span className="section-kicker">{t("pdetail.location")}</span>
            <h2>{t("steps.reviewRange")}</h2>
            <ul className="pdetail-loc">
              <li><MapPin size={15} /> {provider.city}</li>
              {provider.distance ? <li><span className="muted-dot" /> {t("pd.approxDistance", { d: provider.distance })}</li> : null}
            </ul>
          </div>
        </section>
      </div>

      <div className="pdetail-cta" role="region" aria-label={t("pdetail.mainAction")}>
        <div className="inner">
          <button className="secondary cta-chat" onClick={() => navigate("/chat")} aria-label={t("pd.contactProvider")}>
            <MessageCircle size={18} />
          </button>
          <button className="primary cta-book" onClick={() => navigate(`/provider/${provider.id}/booking`)}>
            {t("pd.bookNow")} <ArrowLeft size={16} />
          </button>
        </div>
      </div>
    </main>
  );
}
