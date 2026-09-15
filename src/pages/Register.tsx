import { useEffect, useState, type FormEvent } from "react";
import { AlertCircle, CheckCircle2, Eye, EyeOff, Globe, Loader2, MailCheck } from "lucide-react";
import { useAuth } from "../auth";
import { useRouter } from "../router";
import { MaakMark } from "../components/BrandMark";
import { supabase } from "../lib/supabaseClient";
import { useLanguage } from "../i18n";
import { consumeReturnTo } from "../lib/returnTo";

const RESEND_COOLDOWN_SECONDS = 60;

export default function Register() {
  const { t, lang, toggleLang } = useLanguage();
  const { signUp } = useAuth();
  const { navigate } = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
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

    navigate(consumeReturnTo() ?? "/");
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

  const langToggle = (
    <div className="mk-auth-lang">
      <button className="mk-langbtn" type="button" onClick={toggleLang} aria-label={t("lang.label")}>
        <Globe size={13} aria-hidden="true" />
        <span>{lang === "ar" ? "FR" : "ع"}</span>
      </button>
    </div>
  );

  if (pendingEmail) {
    return (
      <main className="mk-auth auth-main">
        <div className="mk-auth-card auth-card">
          {langToggle}
          <MaakMark size={46} />
          <div className="mk-auth-verify-icon" aria-hidden="true">
            <MailCheck size={26} />
          </div>
          <h1 className="mk-auth-title">{t("auth.checkEmail")}</h1>
          <p className="mk-auth-sub">
            {t("auth.confirmSentTo")}{" "}
            <b dir="ltr">{pendingEmail}</b>{" "}
            {t("auth.confirmFollowup")}
          </p>

          {resendNote ? (
            <div className={resendOk ? "mk-auth-success" : "mk-auth-error"} role={resendOk ? "status" : "alert"}>
              {resendOk ? <CheckCircle2 size={15} aria-hidden="true" /> : <AlertCircle size={15} aria-hidden="true" />}
              <span>{resendNote}</span>
            </div>
          ) : null}

          <button className="mk-btn mk-btn--lg mk-btn--block" onClick={handleResend} disabled={resending || cooldown > 0}>
            {resending
              ? <Loader2 size={18} className="spin" aria-hidden="true" />
              : cooldown > 0
                ? t("auth.resendIn", { n: cooldown })
                : t("auth.resendLink")}
          </button>

          <p className="mk-auth-links">
            <button className="mk-auth-link" type="button" onClick={() => navigate("/login")}>{t("auth.backToLogin")}</button>
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="mk-auth auth-main">
      <div className="mk-auth-card auth-card">
        {langToggle}
        <MaakMark size={46} />
        <h1 className="mk-auth-title">{t("auth.registerTitle")}</h1>
        <p className="mk-auth-sub">{t("auth.registerSub")}</p>

        <form onSubmit={handleSubmit}>
          <div className="mk-field">
            <label className="mk-label" htmlFor="reg-email">{t("common.email")}</label>
            <input
              id="reg-email"
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
            <label className="mk-label" htmlFor="reg-password">{t("common.password")}</label>
            <div className="mk-passwrap">
              <input
                id="reg-password"
                className="mk-input"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
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
            <p className="mk-hint">{t("auth.pwMin")}</p>
          </div>

          <div className="mk-field">
            <label className="mk-label" htmlFor="reg-confirm">{t("auth.confirmPassword")}</label>
            <div className="mk-passwrap">
              <input
                id="reg-confirm"
                className="mk-input"
                type={showConfirm ? "text" : "password"}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                autoComplete="new-password"
                required
                dir="ltr"
              />
              <button
                className="mk-passtoggle"
                type="button"
                onClick={() => setShowConfirm((visible) => !visible)}
                aria-label={showConfirm ? t("v2.hidePassword") : t("v2.showPassword")}
              >
                {showConfirm ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
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
            {submitting ? <Loader2 size={18} className="spin" aria-hidden="true" /> : t("auth.createBtn")}
          </button>
        </form>

        <p className="mk-auth-links">
          {t("auth.hasAccount")}{" "}
          <button className="mk-auth-link" type="button" onClick={() => navigate("/login")}>
            {t("auth.signIn")}
          </button>
        </p>
      </div>
    </main>
  );
}
