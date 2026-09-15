import { useEffect, useState, type FormEvent } from "react";
import { AlertCircle, CheckCircle2, Loader2, MailCheck } from "lucide-react";
import { useRouter } from "../router";
import { MaakMark } from "../components/BrandMark";
import { supabase } from "../lib/supabaseClient";
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
      <main className="mk-auth auth-main">
        <div className="mk-auth-card auth-card">
          <MaakMark size={46} />
          <div className="mk-auth-verify-icon" aria-hidden="true">
            <MailCheck size={26} />
          </div>
          <h1 className="mk-auth-title">{t("auth.resetCheck")}</h1>
          <p className="mk-auth-sub">
            {t("auth.resetSentTo")} <b dir="ltr">{sentTo}</b> {t("auth.resetFollowup")}
          </p>

          {resendNote ? (
            <div className={resendOk ? "mk-auth-success" : "mk-auth-error"} role={resendOk ? "status" : "alert"}>
              {resendOk ? <CheckCircle2 size={15} aria-hidden="true" /> : <AlertCircle size={15} aria-hidden="true" />}
              <span>{resendNote}</span>
            </div>
          ) : null}

          <button className="mk-btn mk-btn--lg mk-btn--block" onClick={() => void requestReset(sentTo, true)} disabled={resending || cooldown > 0}>
            {resending
              ? <Loader2 size={18} className="spin" aria-hidden="true" />
              : cooldown > 0
                ? t("auth.resendIn", { n: cooldown })
                : t("auth.resendResetLink")}
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
        <MaakMark size={46} />
        <h1 className="mk-auth-title">{t("auth.forgotTitle")}</h1>
        <p className="mk-auth-sub">{t("auth.forgotSub")}</p>

        <form onSubmit={handleSubmit}>
          <div className="mk-field">
            <label className="mk-label" htmlFor="forgot-email">{t("common.email")}</label>
            <input
              id="forgot-email"
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

          {error ? (
            <div className="mk-auth-error" role="alert">
              <AlertCircle size={16} aria-hidden="true" />
              <span>{t(error)}</span>
            </div>
          ) : null}

          <button className="mk-btn mk-btn--lg mk-btn--block" type="submit" disabled={submitting}>
            {submitting ? <Loader2 size={18} className="spin" aria-hidden="true" /> : t("auth.sendResetLink")}
          </button>
        </form>

        <p className="mk-auth-links">
          <button className="mk-auth-link" type="button" onClick={() => navigate("/login")}>{t("auth.backToLogin")}</button>
        </p>
      </div>
    </main>
  );
}
