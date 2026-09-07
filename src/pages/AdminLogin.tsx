import { useState, type FormEvent } from "react";
import { Eye, EyeOff, Globe, Loader2, ShieldCheck } from "lucide-react";
import { useAuth } from "../auth";
import { Logo } from "../components/atoms";
import "../styles/auth.css";
import "../styles/admin-auth.css";
import { useLanguage } from "../i18n";

/**
 * Dedicated administrator sign-in (/admin/login). Uses the existing Supabase
 * Auth session — no second auth system. The parent gate in App.tsx sends
 * admins to /admin and keeps every non-admin outside the admin panel.
 */
export default function AdminLogin() {
  const { t, lang, toggleLang } = useLanguage();
  const { user, profile, profileLoading, signIn, signOut } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user && !profileLoading && (profile?.role ?? "customer") !== "admin") {
    return (
      <main className="auth-main">
        <div className="auth-card">
          <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
            <button className="lang-toggle-btn" type="button" onClick={toggleLang} aria-label={t("lang.label")}>
              <Globe size={13} />
              <span>{lang === "ar" ? "FR" : "عربي"}</span>
            </button>
          </div>
          <div className="auth-brand">
            <Logo variant="lockup" />
          </div>
          <span className="auth-admin-chip"><ShieldCheck size={13} /> {t("admLogin.adminArea")}</span>
          <h1 className="auth-title">{t("adminLogin.noAdmin")}</h1>
          <p className="auth-subtitle">
            {t("admLogin.noAdminRightsBody")}
          </p>
          <button className="auth-btn" onClick={() => void signOut()}>{t("acct.signOut")}</button>
        </div>
      </main>
    );
  }

  if (user) {
    return (
      <main className="auth-main">
        <div className="auth-card">
          <div className="auth-brand">
            <Logo variant="lockup" />
          </div>
          <h1 className="auth-title">{t("adminLogin.verifying")}</h1>
          <p className="auth-subtitle">{t("adminLogin.verifyingSub")}</p>
          <div className="auth-admin-checking"><Loader2 size={22} className="auth-spin" /></div>
        </div>
      </main>
    );
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error: signInError } = await signIn(email.trim(), password);
    setSubmitting(false);
    if (signInError) {
      setError(signInError);
    }
    // On success the auth context resolves the profile; the parent gate then
    // redirects admins to /admin and this screen shows its checking state.
  }

  return (
    <main className="auth-main">
      <div className="auth-card">
        <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>
          <button className="lang-toggle-btn" type="button" onClick={toggleLang} aria-label={t("lang.label")}>
            <Globe size={13} />
            <span>{lang === "ar" ? "FR" : "عربي"}</span>
          </button>
        </div>
        <div className="auth-brand">
          <Logo variant="lockup" />
        </div>
        <span className="auth-admin-chip"><ShieldCheck size={13} /> {t("admLogin.adminArea")}</span>
        <h1 className="auth-title">{t("adminLogin.title")}</h1>
        <p className="auth-subtitle">
          {t("admLogin.gateBody")}
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="auth-field">
            <span>{t("common.email")}</span>
            <input
              className="auth-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              autoComplete="email"
              required
              dir="ltr"
            />
          </label>

          <label className="auth-field">
            <span>{t("common.password")}</span>
            <div className="auth-password-wrap">
              <input
                className="auth-input"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                dir="ltr"
              />
              <button
                className="auth-password-toggle"
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
                title={showPassword ? "إخفاء كلمة المرور" : "إظهار كلمة المرور"}
              >
                {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
              </button>
            </div>
          </label>

          {error ? <div className="auth-error">{t(error)}</div> : null}

          <button className="auth-btn" type="submit" disabled={submitting}>
            {submitting ? <Loader2 size={18} className="auth-spin" /> : t("nav.login")}
          </button>
        </form>
      </div>
    </main>
  );
}
