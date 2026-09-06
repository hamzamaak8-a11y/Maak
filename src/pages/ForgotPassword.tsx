import { useEffect, useState, type FormEvent } from "react";
import { Loader2, MailCheck } from "lucide-react";
import { useRouter } from "../router";
import { Logo } from "../components/atoms";
import { supabase } from "../lib/supabaseClient";
import "../styles/auth.css";
import { useLanguage } from "../i18n";

const RESEND_COOLDOWN_SECONDS = 60;

/** Recovery emails land on /reset-password at the GitHub Pages origin. */
const RESET_REDIRECT_URL = "https://hamzamaak8-a11y.github.io/Maak/reset-password";

export default function ForgotPassword() {
  const { t } = useLanguage();
  const { navigate } = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [resending, setResending] = useState(false);
  const [resendNote, setResendNote] = useState<string | null>(null);
  const [resendOk, setResendOk] = useState(true);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  async function requestReset(target: string, isResend: boolean) {
    if (isResend) {
      if (resending || cooldown > 0) return;
      setResending(true);
      setResendNote(null);
    } else {
      setSubmitting(true);
      setError(null);
    }

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(target, {
      redirectTo: RESET_REDIRECT_URL,
    });

    if (isResend) setResending(false);
    else setSubmitting(false);

    if (resetError) {
      const m = String(resetError.message ?? "").toLowerCase();
      const tooMany = m.includes("rate limit") || m.includes("too many") || m.includes("for security");
      const network = m.includes("network") || m.includes("fetch") || m.includes("failed");
      if (tooMany || network) {
        const note = tooMany
          ? t("auth.err.rateLimit")
          : t("auth.err.network");
        if (isResend) {
          setResendOk(false);
          setResendNote(note);
        } else {
          setError(note);
        }
        return;
      }
    }

    // Generic success for any other outcome — never reveal whether the email is registered.
    if (isResend) {
      setResendOk(true);
      setResendNote(t("auth.resetSent"));
    }
    setSentTo(target);
    setCooldown(RESEND_COOLDOWN_SECONDS);
  }

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    void requestReset(email.trim(), false);
  }

  if (sentTo) {
    return (
      <main className="auth-main">
        <div className="auth-card">
          <div className="auth-brand">
            <Logo variant="lockup" />
          </div>
          <div className="auth-verify-icon">
            <MailCheck size={28} />
          </div>
          <h1 className="auth-title">{t("auth.resetCheck")}</h1>
          <p className="auth-subtitle">
            {t("auth.resetSentTo")}{" "}
            <span className="auth-verify-email" dir="ltr">{sentTo}</span>
            {" "}{t("auth.resetFollowup")}
          </p>

          {resendNote ? <div className={resendOk ? "auth-success" : "auth-error"}>{resendNote}</div> : null}

          <button className="auth-btn" onClick={() => void requestReset(sentTo, true)} disabled={resending || cooldown > 0}>
            {resending
              ? <Loader2 size={18} className="auth-spin" />
              : cooldown > 0
                ? t("auth.resendIn", { n: cooldown })
                : t("auth.resendResetLink")}
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
        <div className="auth-brand">
          <Logo variant="lockup" />
        </div>
        <h1 className="auth-title">{t("auth.forgotTitle")}</h1>
        <p className="auth-subtitle">{t("auth.forgotSub")}</p>

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

          {error ? <div className="auth-error">{t(error)}</div> : null}

          <button className="auth-btn" type="submit" disabled={submitting}>
            {submitting ? <Loader2 size={18} className="auth-spin" /> : t("auth.sendResetLink")}
          </button>
        </form>

        <p className="auth-link-row">
          <button className="auth-link" onClick={() => navigate("/login")}>{t("auth.backToLogin")}</button>
        </p>
      </div>
    </main>
  );
}
