import { useEffect, useState } from "react";
import { Camera, Check, Edit3, Loader2, UserRound, X } from "lucide-react";
import type { Profile } from "../../types";
import { updateCustomerProfile, type CustomerProfileUpdate } from "../../lib/customer";
import { useLanguage } from "../../i18n";

type Props = { profile: Profile; onSaved: (profile: Profile) => void };

export default function CustomerProfileCard({ profile, onSaved }: Props) {
  const { t } = useLanguage();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<CustomerProfileUpdate>({
    full_name: profile.full_name,
    phone: profile.phone,
    city: profile.city,
    avatar_url: profile.avatar_url,
  });

  useEffect(() => {
    setForm({ full_name: profile.full_name, phone: profile.phone, city: profile.city, avatar_url: profile.avatar_url });
  }, [profile]);

  const displayName = profile.full_name || t("customer.profileFallback");

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const next = await updateCustomerProfile(form);
      onSaved(next);
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "customer.saveFailed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="customer-card customer-profile-card" aria-labelledby="customer-profile-heading">
      <div className="customer-card-head">
        <div>
          <span className="section-kicker">{t("customer.profileKicker")}</span>
          <h2 id="customer-profile-heading">{t("customer.profileTitle")}</h2>
        </div>
        {!editing ? (
          <button className="ghost-button" onClick={() => setEditing(true)}><Edit3 size={16} /> {t("customer.editProfile")}</button>
        ) : null}
      </div>

      <div className="customer-profile-hero">
        <div className="customer-avatar-wrap">
          {profile.avatar_url ? <img src={profile.avatar_url} alt="" className="customer-avatar" /> : <div className="customer-avatar customer-avatar-fallback"><UserRound size={28} /></div>}
          {editing ? <span className="customer-avatar-edit"><Camera size={14} /></span> : null}
        </div>
        <div>
          <h3>{displayName}</h3>
          <p>{profile.role === "customer" ? t("account.roleCustomer") : t("customer.accountUser")}</p>
        </div>
      </div>

      {editing ? (
        <div className="customer-form-grid">
          <label>{t("common.name")}<input className="field" value={form.full_name ?? ""} onChange={(e) => setForm((v) => ({ ...v, full_name: e.target.value }))} maxLength={120} /></label>
          <label>{t("common.phone")}<input className="field" value={form.phone ?? ""} onChange={(e) => setForm((v) => ({ ...v, phone: e.target.value }))} maxLength={30} inputMode="tel" /></label>
          <label>{t("common.city")}<input className="field" value={form.city ?? ""} onChange={(e) => setForm((v) => ({ ...v, city: e.target.value }))} maxLength={100} /></label>
          <label>{t("customer.photoUrl")}<input className="field" value={form.avatar_url ?? ""} onChange={(e) => setForm((v) => ({ ...v, avatar_url: e.target.value }))} maxLength={500} type="url" placeholder="https://..." /></label>
          {error ? <p className="customer-error" role="alert">{t(error)}</p> : null}
          <div className="customer-form-actions">
            <button className="primary" onClick={() => void save()} disabled={busy}>{busy ? <Loader2 className="spin" size={16} /> : <Check size={16} />} {t("customer.saveProfile")}</button>
            <button className="secondary" onClick={() => { setEditing(false); setError(null); setForm({ full_name: profile.full_name, phone: profile.phone, city: profile.city, avatar_url: profile.avatar_url }); }} disabled={busy}><X size={16} /> {t("common.cancel")}</button>
          </div>
        </div>
      ) : (
        <div className="customer-detail-grid">
          <div><span>{t("common.name")}</span><strong>{profile.full_name || "—"}</strong></div>
          <div><span>{t("common.email")}</span><strong>{profile.id ? profile.id === "" ? "—" : "" : ""}</strong></div>
          <div><span>{t("common.phone")}</span><strong>{profile.phone || "—"}</strong></div>
          <div><span>{t("common.city")}</span><strong>{profile.city || "—"}</strong></div>
        </div>
      )}
    </section>
  );
}
