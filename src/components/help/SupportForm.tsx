import { FormEvent, useState } from "react";
import { CheckCircle2, Loader2, Send } from "lucide-react";
import { sendSupportMessage } from "../../lib/help";
import { useLanguage } from "../../i18n";

type Props = { onSent?: () => void };

export default function SupportForm({ onSent }: Props) {
  const { t } = useLanguage();
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [status, setStatus] = useState<{ type: "idle" | "error" | "success"; text: string }>({ type: "idle", text: "" });
  const [busy, setBusy] = useState(false);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
    if (status.type !== "idle") setStatus({ type: "idle", text: "" });
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setStatus({ type: "idle", text: "" });
    try {
      await sendSupportMessage(form);
      setStatus({ type: "success", text: t("v2.supportOk") });
      setForm({ name: form.name, email: form.email, subject: "", message: "" });
      onSent?.();
    } catch (error) {
      const key = error instanceof Error ? error.message : "v2.supportFail";
      setStatus({ type: "error", text: t(key) === key ? t("v2.supportFail") : t(key) });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="help-support-heading">
      <div className="mk-section-head" style={{ flexDirection: "column", alignItems: "flex-start", gap: 2, marginBottom: 10 }}>
        <span className="mk-kicker">{t("v2.supportKicker")}</span>
        <h2 id="help-support-heading">{t("v2.supportTitle")}</h2>
        <p style={{ fontSize: 12.5, color: "var(--mk-ink-3)" }}>{t("v2.supportSub")}</p>
      </div>

      <form className="mk-card mk-card--pad" onSubmit={submit} noValidate>
        <div style={{ display: "grid", gap: 0, gridTemplateColumns: "1fr" }}>
          <div style={{ display: "grid", gap: "0 12px" }} className="mk-support-grid">
            <div className="mk-field">
              <label className="mk-label" htmlFor="support-name">{t("v2.supportName")}</label>
              <input id="support-name" className="mk-input" value={form.name} onChange={(e) => update("name", e.target.value)} autoComplete="name" required />
            </div>
            <div className="mk-field">
              <label className="mk-label" htmlFor="support-email">{t("v2.supportEmail")}</label>
              <input id="support-email" className="mk-input" value={form.email} onChange={(e) => update("email", e.target.value)} type="email" autoComplete="email" required dir="ltr" />
            </div>
          </div>
          <div className="mk-field">
            <label className="mk-label" htmlFor="support-subject">{t("v2.supportSubject")}</label>
            <input id="support-subject" className="mk-input" value={form.subject} onChange={(e) => update("subject", e.target.value)} required />
          </div>
          <div className="mk-field">
            <label className="mk-label" htmlFor="support-message">{t("v2.supportMessage")}</label>
            <textarea id="support-message" className="mk-textarea" value={form.message} onChange={(e) => update("message", e.target.value)} rows={5} required />
          </div>
        </div>

        {status.type !== "idle" ? (
          <div className={status.type === "success" ? "mk-auth-success" : "mk-auth-error"} role="status">
            {status.type === "success" ? <CheckCircle2 size={15} aria-hidden="true" /> : null}
            <span>{status.text}</span>
          </div>
        ) : null}

        <button className="mk-btn" type="submit" disabled={busy}>
          {busy ? <Loader2 size={16} className="spin" aria-hidden="true" /> : <Send size={16} aria-hidden="true" />}
          {busy ? t("v2.supportPreparing") : t("v2.supportSubmit")}
        </button>
      </form>
    </section>
  );
}
