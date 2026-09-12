import { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Loader2, ShieldCheck } from "lucide-react";
import { useToast } from "../../context";
import { useLanguage } from "../../i18n";
import { cancelSubscription, getSubscription, subscribe, type ProviderSubscription, type ProviderSubscriptionPlan } from "../../lib/provider";
import "../../styles/provider-subscription.css";

const PLANS: Array<{ id: ProviderSubscriptionPlan; priceKey: string; featureKeys: string[] }> = [
  { id: "basic", priceKey: "providerSubscription.basicPrice", featureKeys: ["providerSubscription.basicF1", "providerSubscription.basicF2"] },
  { id: "premium", priceKey: "providerSubscription.premiumPrice", featureKeys: ["providerSubscription.premiumF1", "providerSubscription.premiumF2", "providerSubscription.premiumF3"] },
  { id: "featured", priceKey: "providerSubscription.featuredPrice", featureKeys: ["providerSubscription.featuredF1", "providerSubscription.featuredF2", "providerSubscription.featuredF3"] },
];

function formatDate(value: string, lang: string): string {
  try {
    return new Intl.DateTimeFormat(lang === "fr" ? "fr-FR" : "ar-MA", { dateStyle: "medium" }).format(new Date(value));
  } catch {
    return value;
  }
}

export default function SubscriptionManager() {
  const { t, lang } = useLanguage();
  const { showToast } = useToast();
  const [subscription, setSubscription] = useState<ProviderSubscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyPlan, setBusyPlan] = useState<ProviderSubscriptionPlan | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setSubscription(await getSubscription());
    } catch (error) {
      showToast(t(error instanceof Error ? error.message : "providerSubscription.loadFail"));
    } finally {
      setLoading(false);
    }
  }, [showToast, t]);

  useEffect(() => { void load(); }, [load]);

  const currentActive = subscription?.status === "active" && new Date(subscription.end_date).getTime() > Date.now();
  const currentPlan = currentActive ? subscription?.plan_id : null;

  const statusLabel = useMemo(() => {
    if (!subscription) return t("providerSubscription.none");
    return t(`providerSubscription.${subscription.status}`);
  }, [subscription, t]);

  async function selectPlan(planId: ProviderSubscriptionPlan) {
    if (currentPlan === planId) return;
    setBusyPlan(planId);
    try {
      setSubscription(await subscribe(planId));
      showToast(t("providerSubscription.subscribedSuccess"));
    } catch (error) {
      showToast(t(error instanceof Error ? error.message : "providerSubscription.subscribeFail"));
    } finally {
      setBusyPlan(null);
    }
  }

  async function cancelCurrent() {
    if (!window.confirm(t("providerSubscription.cancelConfirm"))) return;
    setCancelling(true);
    try {
      setSubscription(await cancelSubscription());
      showToast(t("providerSubscription.cancelledSuccess"));
    } catch (error) {
      showToast(t(error instanceof Error ? error.message : "providerSubscription.cancelFail"));
    } finally {
      setCancelling(false);
    }
  }

  return (
    <section className="provider-subscription-manager">
      <div className="admin-top">
        <div>
          <span className="section-kicker">{t("providerSubscription.tab")}</span>
          <h1>{t("providerSubscription.title")}</h1>
          <p className="onb-step-sub">{t("providerSubscription.subtitle")}</p>
        </div>
        <span className="verified"><ShieldCheck size={14} /> {statusLabel}</span>
      </div>

      {loading ? <div className="empty-state"><Loader2 className="spin" size={20} /><p>{t("common.loading")}</p></div> : (
        <>
          {subscription ? (
            <div className={`provider-subscription-current ${currentActive ? "active" : "inactive"}`}>
              <div>
                <span className="section-kicker">{t("providerSubscription.current")}</span>
                <h2>{t(`providerSubscription.${subscription.plan_id}`)}</h2>
                <p>{t(`providerSubscription.${subscription.status}`)} · {t("providerSubscription.ends")} {formatDate(subscription.end_date, lang)}</p>
              </div>
              {currentActive ? <button className="secondary" type="button" disabled={cancelling} onClick={() => void cancelCurrent()}>{cancelling ? <Loader2 className="spin" size={15} /> : null}{t("providerSubscription.cancel")}</button> : null}
            </div>
          ) : (
            <div className="provider-subscription-current inactive">
              <div><span className="section-kicker">{t("providerSubscription.current")}</span><h2>{t("providerSubscription.none")}</h2></div>
            </div>
          )}

          <div className="provider-subscription-grid">
            {PLANS.map((plan) => {
              const selected = currentPlan === plan.id;
              return (
                <article className={`provider-subscription-card ${selected ? "selected" : ""}`} key={plan.id}>
                  <div className="provider-subscription-card-head">
                    <div><span className="section-kicker">{plan.id === "featured" ? "01" : plan.id === "premium" ? "02" : "03"}</span><h3>{t(`providerSubscription.${plan.id}`)}</h3></div>
                    {selected ? <span className="provider-subscription-badge">{t("providerSubscription.active")}</span> : null}
                  </div>
                  <div className="provider-subscription-price"><strong>{t(plan.priceKey)}</strong><span>{t("providerSubscription.perMonth")}</span></div>
                  <ul>
                    {plan.featureKeys.map((key) => <li key={key}><Check size={15} aria-hidden="true" /> <span>{t(key)}</span></li>)}
                  </ul>
                  <button className={selected ? "ghost-button" : "primary"} type="button" disabled={selected || busyPlan !== null} onClick={() => void selectPlan(plan.id)}>
                    {busyPlan === plan.id ? <Loader2 className="spin" size={15} /> : null}
                    {selected ? t("providerSubscription.active") : t("providerSubscription.subscribe")}
                  </button>
                </article>
              );
            })}
          </div>

          <p className="provider-subscription-note">{t("providerSubscription.billingNote")}</p>
        </>
      )}
    </section>
  );
}
