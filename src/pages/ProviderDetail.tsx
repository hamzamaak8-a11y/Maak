import { useEffect, useState } from "react";
import { BadgeCheck, CalendarCheck2, ChevronRight, CircleOff, Clock3, MapPin, MessageCircle, Star } from "lucide-react";
import { isBookable, useProvider } from "../hooks/useProviders";
import { useRouter } from "../router";
import { useLanguage } from "../i18n";
import { useAuth } from "../auth";
import { useToast } from "../context";
import { getOrCreateProviderConversation } from "../lib/chat";
import { fetchPublicProviderDetails, type PublicProviderDetails } from "../lib/provider";
import type { Provider } from "../types";
import ReviewList from "../components/reviews/ReviewList";
import ProviderPortfolio from "../components/provider/ProviderPortfolio";
import { Avatar } from "../components/atoms";
import "../styles/provider-portfolio.css";

export default function ProviderDetail({ id }: { id: number }) {
  const { t, dir } = useLanguage();
  const { navigate } = useRouter();
  const { provider, status } = useProvider(id);
  const { user } = useAuth();
  const { showToast } = useToast();
  const [openingChat, setOpeningChat] = useState(false);
  const [publicDetails, setPublicDetails] = useState<PublicProviderDetails | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!provider) {
      setPublicDetails(null);
      return () => { cancelled = true; };
    }
    void fetchPublicProviderDetails(provider)
      .then((details) => { if (!cancelled) setPublicDetails(details); })
      .catch(() => { if (!cancelled) setPublicDetails(null); });
    return () => { cancelled = true; };
  }, [provider]);

  async function openChat() {
    if (!provider?.provider_profile_id) { showToast(t("chat.providerUnavailable")); return; }
    if (!user) { navigate("/login"); return; }
    setOpeningChat(true);
    try {
      const conversationId = await getOrCreateProviderConversation(provider.provider_profile_id);
      navigate(`/chat/${conversationId}`);
    } catch (err) {
      showToast(err instanceof Error ? t(err.message) : t("chat.openFail"));
    } finally {
      setOpeningChat(false);
    }
  }

  const goToBooking = (current: Provider) => navigate(`/provider/${current.id}/booking`);
  const back = (
    <div className="mk-backrow">
      <button type="button" className="mk-backbtn" onClick={() => navigate("/discover")}>
        <ChevronRight size={15} aria-hidden="true" style={dir === "ltr" ? { transform: "scaleX(-1)" } : undefined} />
        {t("common.backToDiscover")}
      </button>
    </div>
  );

  if (status === "loading") {
    return (
      <main className="screen screen--wide pdetail" aria-busy="true">
        {back}
        <div className="mk-provider-list">
          <div className="mk-pd-header mk-card" style={{ pointerEvents: "none" }}>
            <span className="mk-avatar mk-avatar--lg mk-skel" aria-hidden="true" />
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 10 }}>
              <span className="mk-skel" style={{ height: 18, width: "50%", display: "block" }} />
              <span className="mk-skel" style={{ height: 12, width: "32%", display: "block" }} />
              <span className="mk-skel" style={{ height: 12, width: "68%", display: "block" }} />
            </div>
          </div>
          <div className="mk-card" style={{ pointerEvents: "none", padding: 20 }}>
            <span className="mk-skel" style={{ height: 12, width: "85%", display: "block" }} />
            <span className="mk-skel" style={{ height: 12, width: "70%", display: "block", marginTop: 10 }} />
            <span className="mk-skel" style={{ height: 12, width: "78%", display: "block", marginTop: 10 }} />
          </div>
        </div>
      </main>
    );
  }

  if (status === "error") {
    return (
      <main className="screen pdetail">
        {back}
        <div className="mk-state" role="alert">
          <span className="mk-state-icon danger"><CircleOff size={24} aria-hidden="true" /></span>
          <h3>{t("pdetail.error")}</h3>
          <p>{t("atoms.loadFailSub")}</p>
          <button type="button" className="mk-btn mk-btn--secondary mk-btn--sm" onClick={() => navigate("/discover")}>{t("pdetail.back")}</button>
        </div>
      </main>
    );
  }

  if (!provider) {
    return (
      <main className="screen pdetail">
        {back}
        <div className="mk-state">
          <span className="mk-state-icon"><MapPin size={24} aria-hidden="true" /></span>
          <h3>{t("pdetail.notFound")}</h3>
          <button type="button" className="mk-btn mk-btn--secondary mk-btn--sm" onClick={() => navigate("/discover")}>{t("pdetail.back")}</button>
        </div>
      </main>
    );
  }

  if (!isBookable(provider)) {
    return (
      <main className="screen pdetail">
        {back}
        <div className="mk-state">
          <span className="mk-state-icon warn"><BadgeCheck size={24} aria-hidden="true" /></span>
          <h3>{t("pdetail.notBookable")}</h3>
          <p>{t("pdetail.notBookableBody")}</p>
          <button type="button" className="mk-btn mk-btn--secondary mk-btn--sm" onClick={() => navigate("/discover")}>{t("pdetail.back")}</button>
        </div>
      </main>
    );
  }

  const rating = publicDetails?.rating ?? (provider.rating ? Number(provider.rating) : 0);
  const reviewCount = publicDetails?.reviewCount ?? provider.reviews;
  const hasRating = reviewCount > 0 && rating > 0;
  const available = provider.available === true;

  const ctaButtons = (
    <>
      <button
        type="button"
        className="mk-btn mk-btn--secondary"
        onClick={() => void openChat()}
        disabled={openingChat}
        aria-busy={openingChat}
        aria-label={t("pd.messageCta")}
      >
        <MessageCircle size={17} aria-hidden="true" />
      </button>
      <button type="button" className="mk-btn mk-btn--lg" style={{ flex: 1 }} onClick={() => goToBooking(provider)}>
        {t("pd.bookCta")}
      </button>
    </>
  );

  return (
    <main className="screen screen--wide pdetail" aria-labelledby="public-provider-name">
      {back}

      <div className="mk-pd-grid">
        <div className="mk-pd-aside">
          <section className="mk-card mk-pd-header" aria-labelledby="public-provider-name">
            <span style={{ position: "relative", display: "inline-flex" }}>
              <Avatar name={provider.name} src={provider.image} size="lg" />
              {provider.available != null ? <span className={"mk-avail-dot " + (available ? "on" : "off")} aria-hidden="true" /> : null}
            </span>
            <div className="mk-pd-id">
              <h1 id="public-provider-name" className="mk-pd-name">{provider.name}</h1>
              <p className="mk-pd-job">{provider.job}</p>
              <div className="mk-pd-meta">
                <span><MapPin size={13.5} aria-hidden="true" /> {provider.city}</span>
                {provider.experience ? <span><Clock3 size={13.5} aria-hidden="true" /> {provider.experience} {t("pd.experience")}</span> : null}
                {hasRating ? (
                  <span className="mk-rating">
                    <Star size={13} fill="currentColor" aria-hidden="true" />
                    {rating.toFixed(1)} <small>{t("pd.reviewCountShort", { n: reviewCount })}</small>
                  </span>
                ) : null}
              </div>
              <div className="mk-pd-badges">
                <span className="mk-badge mk-badge--brand"><BadgeCheck size={12.5} aria-hidden="true" /> {t("pd.verifiedProvider")}</span>
                {available ? <span className="mk-status mk-status--done">{t("filters.availableNow")}</span> : null}
              </div>
            </div>
          </section>

          <section className="mk-card mk-pd-section mk-pd-desktop-only">
            <div className="mk-pd-price-row">
              <span className="k">{t("pd.estimatedPrice")}</span>
              <span className="v">{provider.price ?? t("price.onContact")}</span>
            </div>
            <div style={{ display: "flex", gap: 8 }}>{ctaButtons}</div>
          </section>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 14, minWidth: 0 }}>
          {provider.intro ? (
            <section className="mk-card mk-pd-section" aria-labelledby="pdetail-about-title">
              <h2 id="pdetail-about-title">{t("pd.aboutTitle")}</h2>
              <p className="mk-pd-about">{provider.intro}</p>
            </section>
          ) : null}

          <section className="mk-card mk-pd-section" aria-labelledby="provider-services-title">
            <h2 id="provider-services-title">{t("pd.servicesTitle")}</h2>
            {provider.services.length ? (
              <div className="mk-pd-chips">
                {provider.services.map((service) => <span key={service} className="mk-service-tag">{t(service)}</span>)}
              </div>
            ) : <p className="mk-pd-about">{t("pdetail.notDefined")}</p>}
          </section>

          <section className="mk-card mk-pd-section">
            <div className={"mk-pd-avail " + (available ? "on" : "off")}>
              <span className="ic">{available ? <CalendarCheck2 size={19} aria-hidden="true" /> : <CircleOff size={19} aria-hidden="true" />}</span>
              <span>
                {available ? t("pd.availableToday") : provider.available != null ? t("pd.notAvailableNow") : t("pd.availabilityUnknown")}
                <small>{available ? t("pd.checkAvailability") : t("pd.requestAnytime")}</small>
              </span>
            </div>
          </section>

          <ProviderPortfolio providerId={provider.id} />

          {provider.provider_profile_id ? (
            <section className="mk-card mk-pd-section" aria-labelledby="pdetail-reviews-title">
              <ReviewList providerId={provider.provider_profile_id} />
            </section>
          ) : null}

          <div className="mk-stickybar-pad" />
        </div>
      </div>

      {/* Mobile / tablet sticky request bar */}
      <div className="mk-stickybar mk-pd-sticky" role="region" aria-label={t("pd.bookCta")}>
        <div className="mk-stickybar-inner" style={{ maxWidth: 1020 }}>
          <div style={{ minWidth: 0, marginInlineEnd: "auto" }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--mk-ink-3)" }}>{t("pd.estimatedPrice")}</div>
            <div style={{ fontSize: 14.5, fontWeight: 800 }}>{provider.price ?? t("price.onContact")}</div>
          </div>
          {ctaButtons}
        </div>
      </div>
    </main>
  );
}

