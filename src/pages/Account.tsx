import { useEffect, useState, type ReactNode } from "react";
import { Ban, Briefcase, Clock, Edit3, Globe, LogOut, Rocket, ShieldCheck } from "lucide-react";
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
import { Avatar } from "../components/atoms";

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

  useEffect(() => { if (!loading && !user) navigate("/login"); }, [loading, user, navigate]);

  useEffect(() => {
    if (!user || role === "customer") return;
    let active = true;
    (async () => {
      try {
        const prof = await fetchProviderProfile(user.id);
        if (active) { setStatus(prof?.verification_status ?? null); setRejectionReason(prof?.rejection_reason ?? null); }
      } catch (e) {
        if (active) setLoadErr(e instanceof Error ? e.message : t("account.statusError"));
      } finally { if (active) setLoadingStatus(false); }
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
      .catch((e) => { if (active) setCustomerError(e instanceof Error ? e.message : "customer.saveFailed"); })
      .finally(() => { if (active) setCustomerLoading(false); });
    return () => { active = false; };
  }, [user, role]);

  useEffect(() => { if (role === "customer") setCustomerProfile(profile); }, [profile, role]);

  async function handleSignOut() {
    await signOut();
    showToast(t("nav.loggedOut"));
    navigate("/");
  }

  if (loading || (user && role !== "customer" && loadingStatus)) {
    return (
      <main className="screen" aria-busy="true">
        <div className="mk-card" style={{ padding: 20, marginTop: 24, pointerEvents: "none" }}>
          <span className="mk-skel" style={{ height: 16, width: "45%", display: "block" }} />
          <span className="mk-skel" style={{ height: 12, width: "70%", display: "block", marginTop: 12 }} />
          <span className="mk-skel" style={{ height: 12, width: "55%", display: "block", marginTop: 10 }} />
        </div>
      </main>
    );
  }
  if (!user) return null;

  const email = user.email ?? "";
  const displayName = customerProfile?.full_name || profile?.full_name || (email ? email.split("@")[0] : "");

  let statusBlock: ReactNode;
  if (loadErr) {
    statusBlock = (
      <div className="mk-acct-status">
        <p>{t(loadErr)}</p>
        <button className="mk-btn mk-btn--secondary mk-btn--sm" onClick={() => window.location.reload()}>{t("common.retry")}</button>
      </div>
    );
  } else if (role === "admin") {
    statusBlock = (
      <div className="mk-acct-status">
        <h3><ShieldCheck size={16} aria-hidden="true" /> {t("adm.dashboard")}</h3>
        <p>{t("admLogin.gateBody")}</p>
        <button className="mk-btn" onClick={() => navigate("/admin")}><ShieldCheck size={15} aria-hidden="true" /> {t("adm.dashboard")}</button>
      </div>
    );
  } else if (status === null && role !== "provider") {
    statusBlock = (
      <div className="mk-acct-status">
        <h3>{t("account.applyTitle")}</h3>
        <p>{t("account.applyBody")}</p>
        <button className="mk-btn" onClick={() => navigate("/onboarding")}><Rocket size={15} aria-hidden="true" /> {t("acct.startApplication")}</button>
      </div>
    );
  } else if (status === "draft") {
    statusBlock = (
      <div className="mk-acct-status">
        <h3>{t("account.draftTitle")}</h3>
        <p>{t("account.draftBody")}</p>
        <button className="mk-btn" onClick={() => navigate("/onboarding")}>{t("account.draftCta")}</button>
      </div>
    );
  } else if (status === "pending") {
    statusBlock = (
      <div className="mk-acct-status">
        <h3><Clock size={15} aria-hidden="true" /> {t("acct.underReview")}</h3>
        <p>{t("account.reviewBody")}</p>
      </div>
    );
  } else if (status === "rejected") {
    statusBlock = (
      <div className="mk-acct-status">
        <h3><Edit3 size={15} aria-hidden="true" /> {t("acct.editResend")}</h3>
        <p>{t("acct.rejectedBody")}</p>
        {rejectionReason ? <p><b>{t("account.reason")}</b> {rejectionReason}</p> : null}
        <button className="mk-btn" onClick={() => navigate("/onboarding")}>{t("account.editCta")}</button>
      </div>
    );
  } else if (status === "approved" || role === "provider") {
    statusBlock = (
      <div className="mk-acct-status">
        <h3><ShieldCheck size={15} aria-hidden="true" /> {t("acct.accredited")}</h3>
        <p>{t("acct.accreditedBody")}</p>
        <button className="mk-btn" onClick={() => navigate("/provider-mode")}><Briefcase size={15} aria-hidden="true" /> {t("pm.workspace")}</button>
      </div>
    );
  } else if (status === "suspended") {
    statusBlock = (
      <div className="mk-acct-status">
        <h3><Ban size={15} aria-hidden="true" /> {t("acct.suspendedTitle")}</h3>
        <p>{t("acct.suspendedBody")}</p>
      </div>
    );
  } else {
    statusBlock = (
      <div className="mk-acct-status">
        <p>{t("account.unknownStatus")}</p>
      </div>
    );
  }

  return (
    <main className="screen">
      <div className="mk-page-head">
        <div>
          <h1>{t("account.personalInfo")}</h1>
          <p className="mk-page-sub">{t("nav.account")}</p>
        </div>
      </div>

      {role === "customer" ? (
        customerLoading ? (
          <div className="mk-card" style={{ padding: 20 }} aria-busy="true">
            <span className="mk-skel" style={{ height: 14, width: "50%", display: "block" }} />
            <span className="mk-skel" style={{ height: 12, width: "75%", display: "block", marginTop: 12 }} />
          </div>
        ) : customerError ? (
          <div className="mk-state" role="alert">
            <span className="mk-state-icon danger"><Ban size={22} aria-hidden="true" /></span>
            <p>{t(customerError)}</p>
            <button className="mk-btn mk-btn--secondary mk-btn--sm" onClick={() => window.location.reload()}>{t("common.retry")}</button>
          </div>
        ) : (
          <div className="customer-account-grid">
            <CustomerProfileCard profile={customerProfile ?? profile!} email={email} onSaved={(next) => { setCustomerProfile(next); showToast(t("customer.profileSaved")); }} />
            <CustomerBookingHistory bookings={customerBookings} />
            <CustomerReviewHistory reviews={customerReviews} />
            <div className="customer-account-tools">
              <span>{t("lang.label")}</span>
              <button className="mk-langbtn" onClick={toggleLang}><Globe size={13} aria-hidden="true" /><span>{lang === "ar" ? "Français" : "العربية"}</span></button>
            </div>
          </div>
        )
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div className="mk-card">
            <div className="mk-acct-head">
              <Avatar name={displayName} src={profile?.avatar_url} size="lg" />
              <div style={{ minWidth: 0 }}>
                <div className="mk-acct-name">{displayName || "—"}</div>
                <div className="mk-acct-mail">{email}</div>
                <div className="mk-acct-badges">
                  <span className="mk-badge mk-badge--neutral">{roleLabel(role, t)}</span>
                  {profile?.city ? <span className="mk-badge mk-badge--neutral">{profile.city}</span> : null}
                </div>
              </div>
            </div>
            <div className="mk-rows" style={{ border: 0, borderRadius: 0, boxShadow: "none", borderTop: "1px solid var(--mk-line)" }}>
              {profile?.phone ? <div className="mk-row"><span className="k">{t("common.phone")}</span><span className="v" dir="ltr">{profile.phone}</span></div> : null}
              <div className="mk-row">
                <span className="k">{t("lang.label")}</span>
                <span className="v">
                  <button className="mk-langbtn" onClick={toggleLang}><Globe size={13} aria-hidden="true" /><span>{lang === "ar" ? "Français" : "العربية"}</span></button>
                </span>
              </div>
            </div>
          </div>
          <div className="mk-card">{statusBlock}</div>
        </div>
      )}

      <div style={{ marginTop: 16 }}>
        <button className="mk-btn mk-btn--secondary" onClick={handleSignOut}><LogOut size={16} aria-hidden="true" /> {t("acct.signOut")}</button>
      </div>
    </main>
  );
}
