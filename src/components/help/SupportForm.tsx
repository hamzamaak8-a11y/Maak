import { FormEvent, useState } from "react";
import { Mail, Send } from "lucide-react";
import { sendSupportMessage } from "../../lib/help";

type Props = { onSent?: () => void };

export default function SupportForm({ onSent }: Props) {
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
      setStatus({ type: "success", text: "Your support message is ready in your email app." });
      setForm({ name: form.name, email: form.email, subject: "", message: "" });
      onSent?.();
    } catch (error) {
      setStatus({ type: "error", text: error instanceof Error ? error.message : "Unable to prepare the support message." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="help-support" aria-labelledby="help-support-heading">
      <div className="help-section-head">
        <span>SUPPORT</span>
        <h2 id="help-support-heading">Still need help?</h2>
        <p>Send the support team a clear message and include the email linked to your Maak account.</p>
      </div>
      <form className="help-support-form" onSubmit={submit} noValidate>
        <div className="help-form-grid">
          <label>
            <span>Name</span>
            <input value={form.name} onChange={(e) => update("name", e.target.value)} autoComplete="name" required />
          </label>
          <label>
            <span>Email</span>
            <input value={form.email} onChange={(e) => update("email", e.target.value)} type="email" autoComplete="email" required />
          </label>
        </div>
        <label>
          <span>Subject</span>
          <input value={form.subject} onChange={(e) => update("subject", e.target.value)} required />
        </label>
        <label>
          <span>Message</span>
          <textarea value={form.message} onChange={(e) => update("message", e.target.value)} rows={6} required />
        </label>
        {status.type !== "idle" ? <p className={`help-form-status ${status.type}`} role="status">{status.text}</p> : null}
        <button className="primary help-submit" type="submit" disabled={busy}>
          {busy ? <Mail size={17} aria-hidden="true" /> : <Send size={17} aria-hidden="true" />}
          {busy ? "Preparing…" : "Contact support"}
        </button>
      </form>
    </section>
  );
}
