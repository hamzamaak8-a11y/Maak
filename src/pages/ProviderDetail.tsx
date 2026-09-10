import { useEffect, useState } from "react";
import { AlertCircle, ArrowLeft, ChevronLeft, Loader2, MapPin, MessageCircle, ShieldCheck } from "lucide-react";
import { isBookable, useProvider } from "../hooks/useProviders";
import { useRouter } from "../router";
import { useLanguage } from "../i18n";
import { useAuth } from "../auth";
import { useToast } from "../context";
import { getOrCreateProviderConversation } from "../lib/chat";
import { fetchPublicProviderDetails, type PublicProviderDetails } from "../lib/provider";
import type { Provider } from "../types";
import ReviewList from "../components/reviews/ReviewList";
import ProviderHeader from "../components/provider/ProviderHeader";
import ProviderServices from "../components/provider/ProviderServices";
import ProviderAvailability from "../components/provider/ProviderAvailability";
import "../components/provider/provider-public.css";

export default function ProviderDetail({ id }: { id: number }) {
  const { t } = useLanguage();
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

  if (status === "loading") return <main className="screen pdetail"><button className="pdetail-back" onClick={() => navigate("/discover")}><ChevronLeft size={16} /> {t("common.backToDiscover")}</button><div className="pdetail-loading"><Loader2 className="spin" size={24} /><p>{t("pdetail.loading")}</p></div></main>;
  if (status === "error") return <main className="screen pdetail"><button className="pdetail-back" onClick={() => navigate("/discover")}><ChevronLeft size={16} /> {t("common.backToDiscover")}</button><div className="pdetail-error"><AlertCircle size={24} /><h3>{t("pdetail.error")}</h3><p>{t("common.retry")}</p><button className="ghost-button" onClick={() => navigate("/discover")}>{t("pdetail.back")}</button></div></main>;
  if (!provider) return <main className="screen pdetail"><button className="pdetail-back" onClick={() => navigate("/discover")}><ChevronLeft size={16} /> {t("common.backToDiscover")}</button><div className="pdetail-error"><MapPin size={24} /><h3>{t("pdetail.notFound")}</h3></div></main>;
  if (!isBookable(provider)) return <main className="screen pdetail"><button className="pdetail-back" onClick={() => navigate("/discover")}><ChevronLeft size={16} /> {t("common.backToDiscover")}</button><div className="pdetail-error"><ShieldCheck size={24} /><h3>{t("pdetail.notBookable")}</h3><p>{t("pdetail.notBookableBody")}</p><button className="ghost-button" onClick={() => navigate("/discover")}>{t("pdetail.back")}</button></div></main>;

  const rating = publicDetails?.rating ?? (provider.rating ? Number(provider.rating) : 0);
  const reviewCount = publicDetails?.reviewCount ?? provider.reviews;

  return (
    <main className="screen pdetail">
      <button className="pdetail-back" onClick={() => navigate("/discover")}><ChevronLeft size={16} /> {t("common.backToDiscover")}</button>

      <div className="pdetail-grid">
        <aside className="pdetail-identity">
          <ProviderHeader provider={provider} rating={rating} reviewCount={reviewCount} />
          <div className="public-provider-hero-actions">
            <button className="secondary" onClick={() => void openChat()} disabled={openingChat}><MessageCircle size={16} />{openingChat ? t("common.loading") : t("pd.messageCta")}</button>
            <button className="primary" onClick={() => goToBooking(provider)}><ArrowLeft size={16} />{t("pd.bookCta")}</button>
          </div>
          <div className="pdetail-desktop-cta">
            <button className="secondary" onClick={() => void openChat()} disabled={openingChat}><MessageCircle size={16} />{openingChat ? t("common.loading") : t("pd.messageCta")}</button>
            <button className="primary" onClick={() => goToBooking(provider)}>{t("pd.bookCta")} <ArrowLeft size={16} /></button>
          </div>
          <div className="pdetail-section" style={{ marginTop: 16 }}>
            <span className="section-kicker">{t("pd.estimatedPrice")}</span>
            <div className="public-provider-price"><b>{provider.price ?? t("price.onContact")}</b></div>
          </div>
        </aside>

        <section className="pdetail-content">
          {provider.intro ? <section className="public-provider-section"><span className="section-kicker">{t("pd.aboutTitle")}</span><h2>{provider.name}</h2><p className="public-provider-about">{provider.intro}</p></section> : null}
          <ProviderServices provider={provider} />
          <ProviderAvailability provider={provider} />
          {provider.provider_profile_id ? <section className="public-provider-section"><div className="public-provider-review-title"><div><span className="section-kicker">{t("pd.reviewsTitle")}</span><h2>{t("pd.reviewsTitle")}</h2></div><span className="public-provider-review-summary">{reviewCount > 0 ? `${rating.toFixed(1)} / 5` : t("pd.noRating")}</span></div><ReviewList providerId={provider.provider_profile_id} /></section> : null}
          <section className="public-provider-cta-panel">
            <div className="public-provider-cta-copy"><strong>{t("pd.bookCta")}</strong><span>{provider.city} · {provider.job}</span></div>
            <div className="public-provider-cta-actions">
              <button className="secondary" onClick={() => void openChat()} disabled={openingChat}><MessageCircle size={16} />{openingChat ? t("common.loading") : t("pd.messageCta")}</button>
              <button className="primary" onClick={() => goToBooking(provider)}>{t("pd.bookCta")} <ArrowLeft size={16} /></button>
            </div>
          </section>
        </section>
      </div>

      <div className="pdetail-cta" role="region" aria-label={t("pd.bookCta")}><div className="inner"><button className="primary cta-book" onClick={() => goToBooking(provider)}>{t("pd.bookCta")} <ArrowLeft size={16} /></button></div></div>
    </main>
  );
}
