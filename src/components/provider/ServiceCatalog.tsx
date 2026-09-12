import { useCallback, useEffect, useState } from "react";
import type { FormEvent } from "react";
import { Clock3, Edit3, Loader2, Plus, Trash2 } from "lucide-react";
import { useToast } from "../../context";
import { useLanguage } from "../../i18n";
import { addService, deleteService, getServices, updateService, type ProviderService, type ProviderServiceInput } from "../../lib/provider";
import "../../styles/provider-services.css";

const emptyForm: ProviderServiceInput = { name: "", description: "", price: null, currency: "USD", duration_minutes: null, is_active: true };

export default function ServiceCatalog() {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const [services, setServices] = useState<ProviderService[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProviderServiceInput>(emptyForm);

  const load = useCallback(async () => {
    setLoading(true);
    try { setServices(await getServices()); }
    catch (error) { showToast(t(error instanceof Error ? error.message : "providerServices.loadFail")); }
    finally { setLoading(false); }
  }, [showToast, t]);

  useEffect(() => { void load(); }, [load]);

  const reset = () => { setEditingId(null); setForm(emptyForm); };
  const startEdit = (service: ProviderService) => {
    setEditingId(service.id);
    setForm({ name: service.name, description: service.description ?? "", price: service.price, currency: service.currency, duration_minutes: service.duration_minutes, is_active: service.is_active });
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    try {
      const row = editingId ? await updateService(editingId, form) : await addService(form);
      setServices((current) => editingId ? current.map((service) => service.id === row.id ? row : service) : [...current, row]);
      showToast(t(editingId ? "providerServices.saved" : "providerServices.created"));
      reset();
    } catch (error) {
      showToast(t(error instanceof Error ? error.message : "providerServices.saveFail"));
    } finally { setSaving(false); }
  };

  const remove = async (service: ProviderService) => {
    if (!window.confirm(t("providerServices.deleteConfirm"))) return;
    setSaving(true);
    try {
      await deleteService(service.id);
      setServices((current) => current.filter((item) => item.id !== service.id));
      if (editingId === service.id) reset();
      showToast(t("providerServices.deleted"));
    } catch (error) {
      showToast(t(error instanceof Error ? error.message : "providerServices.deleteFail"));
    } finally { setSaving(false); }
  };

  return (
    <section className="provider-service-catalog">
      <div className="admin-top">
        <div>
          <span className="section-kicker">{t("providerServices.title")}</span>
          <h1>{t("providerServices.title")}</h1>
          <p className="onb-step-sub">{t("providerServices.subtitle")}</p>
        </div>
        {!editingId ? <button className="primary" type="button" onClick={() => setForm(emptyForm)}><Plus size={16} /> {t("providerServices.add")}</button> : null}
      </div>

      <div className="provider-service-grid">
        <div className="provider-service-list">
          {loading ? <div className="empty-state"><Loader2 className="spin" size={20} /><p>{t("providerServices.loading")}</p></div> : services.length === 0 ? <div className="empty-state"><p>{t("providerServices.empty")}</p></div> : services.map((service) => (
            <article className="provider-service-card" key={service.id}>
              <div className="provider-service-card-top">
                <div><h3>{service.name}</h3><span className={service.is_active ? "status active" : "status"}>{t(service.is_active ? "providerServices.active" : "providerServices.inactive")}</span></div>
                <div className="cta-row">
                  <button className="ghost-button" type="button" onClick={() => startEdit(service)}><Edit3 size={15} /> {t("providerServices.edit")}</button>
                  <button className="secondary" type="button" disabled={saving} onClick={() => void remove(service)}><Trash2 size={15} /> {t("providerServices.delete")}</button>
                </div>
              </div>
              {service.description ? <p>{service.description}</p> : null}
              <div className="provider-service-meta">
                {service.price != null ? <strong>{service.price.toFixed(2)} {service.currency}</strong> : null}
                {service.duration_minutes != null ? <span><Clock3 size={14} /> {service.duration_minutes} min</span> : null}
              </div>
            </article>
          ))}
        </div>

        <form className="provider-service-form" onSubmit={(event) => void submit(event)}>
          <div className="section-heading"><div><span className="section-kicker">{editingId ? t("providerServices.edit") : t("providerServices.add")}</span><h2>{editingId ? t("providerServices.edit") : t("providerServices.add")}</h2></div></div>
          <label className="onb-field"><span>{t("providerServices.name")}</span><input className="field" required value={form.name} onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))} placeholder={t("providerServices.namePlaceholder")} /></label>
          <label className="onb-field"><span>{t("providerServices.description")}</span><textarea className="field" rows={4} value={form.description ?? ""} onChange={(e) => setForm((current) => ({ ...current, description: e.target.value }))} placeholder={t("providerServices.descriptionPlaceholder")} /></label>
          <div className="provider-service-form-row">
            <label className="onb-field"><span>{t("providerServices.price")}</span><input className="field" type="number" min="0" step="0.01" value={form.price ?? ""} onChange={(e) => setForm((current) => ({ ...current, price: e.target.value === "" ? null : Number(e.target.value) }))} placeholder={t("providerServices.pricePlaceholder")} /></label>
            <label className="onb-field"><span>{t("providerServices.currency")}</span><input className="field" maxLength={3} value={form.currency ?? "USD"} onChange={(e) => setForm((current) => ({ ...current, currency: e.target.value.toUpperCase() }))} placeholder={t("providerServices.currencyPlaceholder")} /></label>
          </div>
          <label className="onb-field"><span>{t("providerServices.duration")}</span><input className="field" type="number" min="1" step="1" value={form.duration_minutes ?? ""} onChange={(e) => setForm((current) => ({ ...current, duration_minutes: e.target.value === "" ? null : Number(e.target.value) }))} placeholder={t("providerServices.durationPlaceholder")} /></label>
          <label className="provider-service-toggle"><input type="checkbox" checked={form.is_active !== false} onChange={(e) => setForm((current) => ({ ...current, is_active: e.target.checked }))} /><span>{t("providerServices.active")}</span></label>
          <div className="cta-row"><button className="primary" disabled={saving} type="submit">{saving ? <Loader2 className="spin" size={15} /> : null}{editingId ? t("providerServices.save") : t("providerServices.create")}</button>{editingId ? <button className="ghost-button" type="button" onClick={reset}>{t("providerServices.cancel")}</button> : null}</div>
        </form>
      </div>
    </section>
  );
}
