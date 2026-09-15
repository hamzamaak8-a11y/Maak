import { useEffect, useState, type FormEvent } from "react";
import { AlertCircle, AlertTriangle, KeyRound, Loader2, ShieldCheck } from "lucide-react";
import { useAuth } from "../auth";
import { useRouter } from "../router";
import { MaakMark } from "../components/BrandMark";
import { supabase } from "../lib/supabaseClient";
import { useLanguage } from "../i18n";

type PageStatus = "checking" | "ready" | "invalid" | "success";

type TranslateFunc = (key: string, vars?: Record<string, string | number>) => string;

function translateUpdateError(error: unknown, t: TranslateFunc): string {
  const message =
    error && typeof error === "object" && "message" in error
      ? String((error as { message?: unknown }).message ?? "")
      : String(error ?? "");
  const m = message.toLowerCase();
  if (m.includes("should be") || m.includes("weak") || m.includes("at least"))
    return t("auth.err.weakPassword");
  if (m.includes("rate limit") || m.includes("too many"))
    return t("auth.err.rateLimit");
  if (m.includes("session") || m.includes("not found") || m.includes("expired"))
    return t("auth.sessionExpired");
  if (m.includes("network") || m.includes("fetch") || m.includes("failed"))
    return t("auth.err.network");
  return t("auth.resetFail");
}

export default function ResetPassword() {
  const { t } = useLanguage();
  const { signOut } = useAuth();
  const { navigate } = useRouter();
  const [status, setStatus] = useState<PageStatus>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function checkRecoverySession() {
      const params = new URLSearchParams(window.location.search);
      const urlError = params.get("error") || params.get("error_description");
      const code = params.get("code");

      if (urlError) {
        if (!cancelled) setStatus("invalid");
        return;
      }

      if (code) {
        // PKCE flow: exchange the one-time code for a recovery session.
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
        if (!cancelled && !exchangeError) {
          setStatus("ready");
          return;
        }
      }

      // The client may have already exchanged the link (detectSessionInUrl).
      const { data } = await supabase.auth.getSession();
      if (!cancelled) setStatus(data.session ? "ready" : "invalid");
    }

    void checkRecoverySession();
    return () => {
      cancelled = true;
    };
  }, []);

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
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setSubmitting(false);

    if (updateError) {
      setError(translateUpdateError(updateError, t));
      return;
    }

    setStatus("success");
  }

  async function goToLogin() {
    await signOut();
    navigate("/login");
  }

  return (
    <main className="mk-auth auth-main">
      <div className="mk-auth-card auth-card">
        <MaakMark size={46} />

        {status === "checking" ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, padding: "24px 0", color: "var(--mk-brand)" }} aria-busy="true">
            <Loader2 size={26} className="spin" aria-hidden="true" />
            <p className="mk-auth-sub" style={{ margin: 0 }}>{t("auth.verifying")}</p>
          </div>
        ) : null}

        {status === "ready" ? (
          <>
            <div className="mk-auth-verify-icon" aria-hidden="true">
              <KeyRound size={26} />
            </div>
            <h1 className="mk-auth-title">{t("auth.resetTitle")}</h1>
            <p className="mk-auth-sub">{t("auth.resetSub")}</p>
            <form onSubmit={handleSubmit}>
              <div className="mk-field">
                <label className="mk-label" htmlFor="reset-password">{t("auth.newPassword")}</label>
                <input
                  id="reset-password"
                  className="mk-input"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                  dir="ltr"
                />
              </div>
              <div className="mk-field">
                <label className="mk-label" htmlFor="reset-confirm">{t("auth.confirmPassword")}</label>
                <input
                  id="reset-confirm"
                  className="mk-input"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
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
                {submitting ? <Loader2 size={18} className="spin" aria-hidden="true" /> : t("auth.resetBtn")}
              </button>
            </form>
          </>
        ) : null}

        {status === "success" ? (
          <>
            <div className="mk-auth-verify-icon" aria-hidden="true">
              <ShieldCheck size={26} />
            </div>
            <h1 className="mk-auth-title">{t("auth.resetOk")}</h1>
            <p className="mk-auth-sub">{t("auth.resetOkBody")}</p>
            <button className="mk-btn mk-btn--lg mk-btn--block" onClick={() => void goToLogin()}>{t("auth.loginTitle")}</button>
          </>
        ) : null}

        {status === "invalid" ? (
          <>
            <div className="mk-auth-verify-icon" style={{ background: "var(--mk-warn-tint)", color: "var(--mk-warn)" }} aria-hidden="true">
              <AlertTriangle size={26} />
            </div>
            <h1 className="mk-auth-title">{t("auth.linkExpired")}</h1>
            <p className="mk-auth-sub">{t("auth.linkExpiredBody")}</p>
            <button className="mk-btn mk-btn--lg mk-btn--block" onClick={() => navigate("/forgot-password")}>{t("auth.requestNewLink")}</button>
            <p className="mk-auth-links">
              <button className="mk-auth-link" type="button" onClick={() => navigate("/login")}>{t("auth.backToLogin")}</button>
            </p>
          </>
        ) : null}
      </div>
    </main>
  );
}
