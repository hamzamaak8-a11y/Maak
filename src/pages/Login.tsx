import { useState, type FormEvent } from "react";
import { Eye, EyeOff, Globe, Loader2 } from "lucide-react";
import { useAuth } from "../auth";
import { useRouter } from "../router";
import { Logo } from "../components/atoms";
import "../styles/auth.css";
import "../styles/final-auth.css";
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
    <main className="auth-main">
      <div className="auth-card">
        <div className="auth-language">
          <button className="lang-toggle-btn" type="button" onClick={toggleLang} aria-label={t("lang.label")}>
            <Globe size={14} />
            <span>{lang === "ar" ? "FR" : "عربي"}</span>
          </button>
        </div>
        <div className="auth-brand">
          <Logo variant="lockup" />
        </div>
        <h1 className="auth-title">{t("auth.loginTitle")}</h1>
        <p className="auth-subtitle">{t("auth.loginSub")}</p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="auth-field">
            <span>{t("common.email")}</span>
            <input
              className="auth-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
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
            {submitting ? <Loader2 size={18} className="auth-spin" /> : t("auth.loginBtn")}
          </button>
        </form>

        <p className="auth-link-row">
          <button className="auth-link" type="button" onClick={() => navigate("/forgot-password")}>
            {t("auth.forgot")}
          </button>
        </p>

        <p className="auth-link-row">
          {t("auth.noAccount")} {" "}
          <button className="auth-link" type="button" onClick={() => navigate("/register")}>
            {t("auth.createAccountBtn")}
          </button>
        </p>
      </div>
    </main>
  );
}
