import { useEffect, useState, type FormEvent } from "react";
import { Globe, Loader2, MailCheck } from "lucide-react";
import { useAuth } from "../auth";
import { useRouter } from "../router";
import { Logo } from "../components/atoms";
import { supabase } from "../lib/supabaseClient";
import "../styles/auth.css";
import { useLanguage } from "../i18n";

const RESEND_COOLDOWN_SECONDS = 60;

export default function Register() {
  const { t, lang, toggleLang } = useLanguage();
  const { signUp } = useAuth();
  const { navigate } = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [pendingEmail, setPendingEmail] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [resendNote, setResendNote] = useState<string | null>(null);
  const [resendOk, setResendOk] = useState(true);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError(t("auth.pwMin"));
      return;
    }
    if (password !== confirm) {
      setError(t("auth.pwMatch"));
      return;
    }

    setSubmitting(true);
    const { error: signUpError, needsEmailConfirmation } = await signUp(email.trim(), password);
    setSubmitting(false);

    if (signUpError) {
      setError(signUpError);
      return;
    }

    if (needsEmailConfirmation) {
      setPendingEmail(email.trim());
      setCooldown(RESEND_COOLDOWN_SECONDS);
      return;
    }

    navigate("/");
  }

  async function handleResend() {
    if (!pendingEmail || resending || cooldown > 0) return;
    setResending(true);
    setResendNote(null);
    const { error: resendError } = await supabase.auth.resend({ type: "signup", email: pendingEmail });
    setResending(false);
    if (resendError) {
      setResendOk(false);
      setResendNote(t("auth.resendFail"));
      return;
    }
    setResendOk(true);
    setResendNote(t("auth.resent"));
    setCooldown(RESEND_COOLDOWN_SECONDS);
  }

  if (pendingEmail) {
    return (
      <main className="auth-main">
        <div className="auth-card">
          <div className="auth-brand">
            <Logo variant="lockup" />
          </div>
          <div className="auth-verify-icon">
            <MailCheck size={28} />
          </div>
          <h1 className="auth-title">{t("auth.checkEmail")}</h1>
          <p className="auth-subtitle">
            {t("auth.confirmSentTo")}{" "}
            <span className="auth-verify-email" dir="ltr">{pendingEmail}</span>
            {" "}{t("auth.confirmFollowup")}
          </p>

          {resendNote ? <div className={resendOk ? "auth-success" : "auth-error"}>{resendNote}</div> : null}

          <button className="auth-btn" onClick={handleResend} disabled={resending || cooldown > 0}>
            {resending
              ? <Loader2 size={18} className="auth-spin" />
              : cooldown > 0
                ? t("auth.resendIn", { n: cooldown })
                : t("auth.resendLink")}
          </button>

          <p className="auth-link-row">
            <button className="auth-link" onClick={() => navigate("/login")}>{t("auth.backToLogin")}</button>
          </p>
        </div>
      </main>
    );
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
        <h1 className="auth-title">{t("auth.registerTitle")}</h1>
        <p className="auth-subtitle">{t("auth.registerSub")}</p>

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
            <input
              className="auth-input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              required
              dir="ltr"
            />
          </label>

          <label className="auth-field">
            <span>{t("auth.confirmPassword")}</span>
            <input
              className="auth-input"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              required
              dir="ltr"
            />
          </label>

          {error ? <div className="auth-error">{t(error)}</div> : null}

          <button className="auth-btn" type="submit" disabled={submitting}>
            {submitting ? <Loader2 size={18} className="auth-spin" /> : t("auth.createBtn")}
          </button>
        </form>

        <p className="auth-link-row">
          {t("auth.hasAccount")}{" "}
          <button className="auth-link" onClick={() => navigate("/login")}>
            {t("auth.signIn")}
          </button>
        </p>
      </div>
    </main>
  );
}
