import { useEffect, useState, type ReactNode } from "react";
import { Ban, Briefcase, Clock, Edit3, Globe, Loader2, LogOut, Rocket, ShieldCheck } from "lucide-react";
import { useAuth } from "../auth";
import { useRouter } from "../router";
import { useToast } from "../context";
import { fetchProviderProfile } from "../lib/onboarding";
import { getCustomerBookings, getCustomerProfile, getCustomerReviews, type CustomerBooking, type CustomerReview } from "../lib/customer";
import CustomerProfileCard from "../components/customer/CustomerProfileCard";
import CustomerBookingHistory from "../components/customer/CustomerBookingHistory";
import CustomerReviewHistory from "../components/customer/CustomerReviewHistory";
import "../components/customer/customer.css";
import { useLanguage } from "../i18n";

type TranslateFunc = (key: string, vars?: Record<string, string | number>) => string;

function roleLabel(role: string, t: TranslateFunc): string {
  if (role === "admin") return t("account.roleAdmin");
  if (role === "provider") return t("account.roleProvider");
  return t("account.roleCustomer");
}

export default function Account() {
  const { t, lang, toggleLang } = useLanguage();
  const { user, profile, role, signOut, loading } = useAuth();
  const { navigate } = useRouter();
  const { showToast } = useToast();
  const [status, setStatus] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState<string | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [customerProfile, setCustomerProfile] = useState(profile);
  const [customerBookings, setCustomerBookings] = useState<CustomerBooking[]>([]);
  const [customerReviews, setCustomerReviews] = useState<CustomerReview[]>([]);
  const [customerLoading, setCustomerLoading] = useState(false);
  const [customerError, setCustomerError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) navigate("/login");
  }, [loading, user, navigate]);

  useEffect(() => {
    if (!user || role === "customer") return;
    let active = true;
    (async () => {
      try {
        const prof = await fetchProviderProfile(user.id);
        if (active) {
          setStatus(prof?.verification_status ?? null);
          setRejectionReason(prof?.rejection_reason ?? null);
        }
      } catch (e) {
        if (active) setLoadErr(e instanceof Error ? e.message : t("account.statusError"));
      } finally {
        if (active) setLoadingStatus(false);
      }
    })();
    return () => { active = false; };
  }, [user, role]);

  useEffect(() => {
    if (!user || role !== "customer") return;
    let active = true;
    setCustomerLoading(true);
    setCustomerError(null);
    void Promise.all([getCustomerProfile(), getCustomerBookings(), getCustomerReviews()])
      .then(([nextProfile, bookings, reviews]) => {
        if (!active) return;
        setCustomerProfile(nextProfile);
        setCustomerBookings(bookings);
        setCustomerReviews(reviews);
      })
      .catch((e) => {
        if (active) setCustomerError(e instanceof Error ? e.message : "customer.saveFailed");
      })
      .finally(() => { if (active) setCustomerLoading(false); });
    return () => { active = false; };
  }, [user, role]);

  useEffect(() => {
    if (role === "customer") setCustomerProfile(profile);
  }, [profile, role]);

  async function handleSignOut() {
    await signOut();
    showToast(t("nav.loggedOut"));
    navigate("/");
  }

  if (loading || (user && role !== "customer" && loadingStatus)) {
    return <main className="screen onb-loading"><Loader2 className="auth-spin" size={26} /></main>;
  }
  if (!user) return null;

  const email = user.email ?? "";
  const displayName = customerProfile?.full_name || profile?.full_name || (email ? email.split("@")[0] : "");

  let statusBlock: ReactNode;
  if (loadErr) {
    statusBlock = (
      <div className="acct-status">
        <p className="acct-status-body">{t(loadErr)}</p>
        <button className="secondary" onClick={() => window.location.reload()}>{t("common.retry")}</button>
      </div>
    );
  } else if (role === "admin") {
    statusBlock = (
      <div className="acct-status">
        <h3 className="acct-status-title"><ShieldCheck size={16} /> {t("adm.dashboard")}</h3>
        <p className="acct-status-body">{t("admLogin.gateBody")}</p>
        <button className="primary" onClick={() => navigate("/admin")}><ShieldCheck size={16} /> {t("adm.dashboard")}</button>
      </div>
    );
  } else if (status === null && role !== "provider") {
    statusBlock = (
      <div className="acct-status">
        <h3 className="acct-status-title">{t("account.applyTitle")}</h3>
        <p className="acct-status-body">{t("account.applyBody")}</p>
        <button className="primary" onClick={() => navigate("/onboarding")}><Rocket size={16} /> {t("acct.startApplication")}</button>
      </div>
    );
  } else if (status === "draft") {
    statusBlock = (
      <div className="acct-status">
        <h3 className="acct-status-title">{t("account.draftTitle")}</h3>
        <p className="acct-status-body">{t("account.draftBody")}</p>
        <button className="primary" onClick={() => navigate("/onboarding")}>{t("account.draftCta")}</button>
      </div>
    );
  } else if (status === "pending") {
    statusBlock = (
      <div className="acct-status">
        <h3 className="acct-status-title"><Clock size={15} /> {t("acct.underReview")}</h3>
        <p className="acct-status-body">{t("account.reviewBody")}</p>
      </div>
    );
  } else if (status === "rejected") {
    statusBlock = (
      <div className="acct-status">
        <h3 className="acct-status-title"><Edit3 size={15} /> {t("acct.editResend")}</h3>
        <p className="acct-status-body">{t("acct.rejectedBody")}</p>
        {rejectionReason ? <p className="acct-reason"><b>{t("account.reason")}</b> {rejectionReason}</p> : null}
        <button className="primary" onClick={() => navigate("/onboarding")}>{t("account.editCta")}</button>
      </div>
    );
  } else if (status === "approved" || role === "provider") {
    statusBlock = (
      <div className="acct-status">
        <h3 className="acct-status-title"><ShieldCheck size={15} /> {t("acct.accredited")}</h3>
        <p className="acct-status-body">{t("acct.accreditedBody")}</p>
        <button className="primary" onClick={() => navigate("/provider-mode")} style={{ marginTop: 10 }}>
          <Briefcase size={16} /> {t("pm.workspace")}
        </button>
      </div>
    );
  } else if (status === "suspended") {
    statusBlock = (
      <div className="acct-status">
        <h3 className="acct-status-title"><Ban size={15} /> {t("acct.suspendedTitle")}</h3>
        <p className="acct-status-body">{t("acct.suspendedBody")}</p>
      </div>
    );
  } else {
    statusBlock = <div className="acct-status"><p className="acct-status-body">{t("account.unknownStatus")}</p></div>;
  }

  return (
    <main className="screen">
      <div className="page-title">
        <div><span className="section-kicker">{t("nav.account")}</span><h1>{t("account.personalInfo")}</h1></div>
      </div>

      {role === "customer" ? (
        customerLoading ? <div className="customer-loading"><Loader2 className="spin" size={22} /><span>{t("bookings.loading")}</span></div> : customerError ? (
          <div className="customer-card customer-load-error"><p>{t(customerError)}</p><button className="secondary" onClick={() => window.location.reload()}>{t("common.retry")}</button></div>
        ) : (
          <div className="customer-account-grid">
            <CustomerProfileCard profile={customerProfile ?? profile!} email={email} onSaved={(next) => { setCustomerProfile(next); showToast(t("customer.profileSaved")); }} />
            <CustomerBookingHistory bookings={customerBookings} />
            <CustomerReviewHistory reviews={customerReviews} />
          </div>
        )
      ) : (
        <div className="acct-card">
          <div className="acct-row"><span>{t("common.name")}</span><span>{displayName || "—"}</span></div>
          <div className="acct-row"><span>{t("common.email")}</span><span>{email}</span></div>
          <div className="acct-row"><span>{t("common.role")}</span><span>{roleLabel(role, t)}</span></div>
          {profile?.city ? <div className="acct-row"><span>{t("common.city")}</span><span>{profile.city}</span></div> : null}
          {profile?.phone ? <div className="acct-row"><span>{t("common.phone")}</span><span>{profile.phone}</span></div> : null}
          <div className="acct-row"><span>{t("lang.label")}</span><button className="lang-toggle-btn" onClick={toggleLang}><Globe size={13} /><span>{lang === "ar" ? "العربية (التبديل إلى Français)" : "Français (Passer en Arabe)"}</span></button></div>
          {statusBlock}
        </div>
      )}

      <div className="onb-nav" style={{ marginTop: 18 }}>
        <button className="secondary" onClick={handleSignOut}><LogOut size={16} /> {t("acct.signOut")}</button>
      </div>
    </main>
  );
}
