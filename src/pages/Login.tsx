import { useState, type FormEvent } from "react";
import { AlertCircle, Eye, EyeOff, Globe, Loader2 } from "lucide-react";
import { useAuth } from "../auth";
import { useRouter } from "../router";
import { MaakMark } from "../components/BrandMark";
import { useLanguage } from "../i18n";
import { consumeReturnTo } from "../lib/returnTo";

export default function Login() {
  const { t, lang, toggleLang } = useLanguage();
  const { signIn } = useAuth();
  const { navigate } = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error: signInError } = await signIn(email.trim(), password);
    setSubmitting(false);
    if (signInError) {
      setError(signInError);
      return;
    }
    navigate(consumeReturnTo() ?? "/");
  }

  return (
    <main className="mk-auth auth-main">
      <div className="mk-auth-card auth-card">
        <div className="mk-auth-lang">
          <button className="mk-langbtn" type="button" onClick={toggleLang} aria-label={t("lang.label")}>
            <Globe size={13} aria-hidden="true" />
            <span>{lang === "ar" ? "FR" : "ع"}</span>
          </button>
        </div>

        <MaakMark size={46} />
        <h1 className="mk-auth-title">{t("auth.loginTitle")}</h1>
        <p className="mk-auth-sub">{t("auth.loginSub")}</p>

        <form onSubmit={handleSubmit} noValidate={false}>
          <div className="mk-field">
            <label className="mk-label" htmlFor="login-email">{t("common.email")}</label>
            <input
              id="login-email"
              className="mk-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
              required
              dir="ltr"
            />
          </div>

          <div className="mk-field">
            <label className="mk-label" htmlFor="login-password">{t("common.password")}</label>
            <div className="mk-passwrap">
              <input
                id="login-password"
                className="mk-input"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                dir="ltr"
              />
              <button
                className="mk-passtoggle"
                type="button"
                onClick={() => setShowPassword((visible) => !visible)}
                aria-label={showPassword ? t("v2.hidePassword") : t("v2.showPassword")}
              >
                {showPassword ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
              </button>
            </div>
          </div>

          {error ? (
            <div className="mk-auth-error" role="alert">
              <AlertCircle size={16} aria-hidden="true" />
              <span>{t(error)}</span>
            </div>
          ) : null}

          <button className="mk-btn mk-btn--lg mk-btn--block" type="submit" disabled={submitting}>
            {submitting ? <Loader2 size={18} className="spin" aria-hidden="true" /> : t("auth.loginBtn")}
          </button>
        </form>

        <p className="mk-auth-links">
          <button className="mk-auth-link" type="button" onClick={() => navigate("/forgot-password")}>
            {t("auth.forgot")}
          </button>
        </p>

        <p className="mk-auth-links" style={{ marginTop: 6 }}>
          {t("auth.noAccount")}{" "}
          <button className="mk-auth-link" type="button" onClick={() => navigate("/register")}>
            {t("auth.createAccountBtn")}
          </button>
        </p>
      </div>
    </main>
  );
}
