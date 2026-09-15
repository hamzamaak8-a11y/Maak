import { useEffect, useState } from "react";
import { Check, ChevronRight, CircleOff, Info, Loader2, MapPin } from "lucide-react";
import { isBookable, useProvider } from "../hooks/useProviders";
import { useBookings } from "../context";
import { Avatar } from "../components/atoms";
import { useAuth } from "../auth";
import { useRouter } from "../router";
import { BOOKING_STATUS_LABELS, mapBookingError } from "../lib/bookings";
import { getProviderAvailability, type ProviderAvailability } from "../lib/availability";
import TimeSlotPicker from "../components/availability/TimeSlotPicker";
import type { BookingRow } from "../types";
import { useLanguage } from "../i18n";
import { rememberReturnTo } from "../lib/returnTo";

const STEPS = ["bflow.service", "bflow.details", "bflow.schedule", "bflow.review"];
type FormState = { service: string; description: string; serviceDate: string; location: string };

function formatAppointment(iso: string | null, lang: string) {
  if (!iso) return "—";
  return new Intl.DateTimeFormat(lang === "fr" ? "fr-FR" : "ar-MA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso));
}

export default function BookingFlow({ id }: { id: number }) {
  const { t, lang, dir } = useLanguage();
  const { navigate } = useRouter();
  const { user } = useAuth();
  const { createBooking } = useBookings();
  const { provider, status } = useProvider(id);
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>({ service: "", description: "", serviceDate: "", location: "" });
  const [availability, setAvailability] = useState<ProviderAvailability[]>([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityError, setAvailabilityError] = useState(false);
  const [errors, setErrors] = useState<{ service?: string; location?: string; serviceDate?: string }>({});
  const [submitting, setSubmitting] = useState(false);
  const [failMsg, setFailMsg] = useState("");
  const [completed, setCompleted] = useState<BookingRow | null>(null);

  useEffect(() => { if (provider && provider.services[0] && !form.service) setForm(current => ({ ...current, service: provider.services[0] })); }, [provider, form.service]);
  useEffect(() => {
    if (!provider || !user || !isBookable(provider)) return;
    let active = true;
    setAvailabilityLoading(true);
    setAvailabilityError(false);
    getProviderAvailability(provider.id)
      .then(rows => { if (active) setAvailability(rows); })
      .catch(() => { if (active) setAvailabilityError(true); })
      .finally(() => { if (active) setAvailabilityLoading(false); });
    return () => { active = false; };
  }, [provider, user]);

  const update = (key: keyof FormState, value: string) => setForm(current => ({ ...current, [key]: value }));
  const goBack = () => step > 0 ? setStep(step - 1) : navigate(provider ? "/provider/" + provider.id : "/discover");
  const next = () => {
    const nextErrors: { service?: string; location?: string; serviceDate?: string } = {};
    if (step === 0 && !form.service.trim()) nextErrors.service = t("bflow.pickService");
    if (step === 2 && !form.serviceDate) nextErrors.serviceDate = t("availability.slotRequired");
    if (step === 2 && !form.location.trim()) nextErrors.location = t("bflow.pickLocation");
    if (Object.keys(nextErrors).length) { setErrors(nextErrors); return; }
    setErrors({});
    if (step < 3) setStep(step + 1);
    else void submit();
  };
  const submit = async () => {
    if (!isBookable(provider) || submitting || !form.serviceDate) return;
    setSubmitting(true);
    setFailMsg("");
    try {
      setCompleted(await createBooking({ providerListingId: provider.id, serviceCategory: form.service.trim(), serviceDescription: form.description.trim(), serviceDate: form.serviceDate, locationText: form.location.trim() }));
    } catch (err) {
      setFailMsg(mapBookingError(err));
    } finally {
      setSubmitting(false);
    }
  };

  const backBtn = (target: string, label: string) => (
    <div className="mk-backrow">
      <button type="button" className="mk-backbtn" onClick={() => navigate(target)}>
        <ChevronRight size={15} aria-hidden="true" style={dir === "ltr" ? { transform: "scaleX(-1)" } : undefined} />
        {label}
      </button>
    </div>
  );

  if (status === "loading") {
    return (
      <main className="screen booking" aria-busy="true">
        {backBtn("/discover", t("bk.back"))}
        <div className="mk-card" style={{ pointerEvents: "none", padding: 20 }}>
          <span className="mk-skel" style={{ height: 16, width: "45%", display: "block" }} />
          <span className="mk-skel" style={{ height: 12, width: "70%", display: "block", marginTop: 12 }} />
          <span className="mk-skel" style={{ height: 12, width: "60%", display: "block", marginTop: 10 }} />
        </div>
      </main>
    );
  }
  if (status === "error") {
    return (
      <main className="screen booking">
        {backBtn("/discover", t("bk.back"))}
        <div className="mk-state" role="alert">
          <span className="mk-state-icon danger"><CircleOff size={24} aria-hidden="true" /></span>
          <h3>{t("pdetail.error")}</h3>
          <p>{t("bk.tryAgain")}</p>
          <button type="button" className="mk-btn mk-btn--secondary mk-btn--sm" onClick={() => navigate("/discover")}>{t("pdetail.back")}</button>
        </div>
      </main>
    );
  }
  if (!provider) {
    return (
      <main className="screen booking">
        {backBtn("/discover", t("bk.back"))}
        <div className="mk-state">
          <span className="mk-state-icon"><MapPin size={24} aria-hidden="true" /></span>
          <h3>{t("pdetail.notFound")}</h3>
        </div>
      </main>
    );
  }
  if (!isBookable(provider)) {
    return (
      <main className="screen booking">
        {backBtn("/discover", t("bk.back"))}
        <div className="mk-state">
          <span className="mk-state-icon warn"><CircleOff size={24} aria-hidden="true" /></span>
          <h3>{t("pdetail.notBookable")}</h3>
          <p>{t("bflow.cannotBook")}</p>
          <button type="button" className="mk-btn mk-btn--secondary mk-btn--sm" onClick={() => navigate("/discover")}>{t("pdetail.back")}</button>
        </div>
      </main>
    );
  }

  if (!user) {
    const goAuth = (target: "/login" | "/register") => {
      rememberReturnTo("/provider/" + provider.id + "/booking");
      navigate(target);
    };
    return (
      <main className="screen booking">
        {backBtn("/provider/" + provider.id, t("bk.backToFile"))}
        <div className="mk-state">
          <span className="mk-state-icon"><Check size={24} aria-hidden="true" /></span>
          <h3>{t("bflow.loginRequired")}</h3>
          <p>{t("bflow.preserved")}</p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center", marginTop: 6 }}>
            <button type="button" className="mk-btn" onClick={() => goAuth("/login")}>{t("adminLogin.signIn")}</button>
            <button type="button" className="mk-btn mk-btn--secondary" onClick={() => goAuth("/register")}>{t("auth.createAccountBtn")}</button>
          </div>
        </div>
      </main>
    );
  }

  if (completed) {
    return (
      <main className="screen booking">
        {backBtn("/provider/" + provider.id, t("bk.backToFile"))}
        <section className="mk-success" aria-labelledby="booking-success-title">
          <span className="mk-success-ok"><Check size={30} aria-hidden="true" /></span>
          <h1 id="booking-success-title">{t("bflow.sent")}</h1>
          <p>{t("bflow.sentBody")}</p>
          <span className="mk-status mk-status--pending">{t(BOOKING_STATUS_LABELS.pending)}</span>
          <div className="mk-rows" style={{ width: "100%", marginTop: 10 }} aria-label={t("bflow.review")}>
            <div className="mk-row"><span className="k">{t("bk.providerLabel")}</span><span className="v">{provider.name}</span></div>
            <div className="mk-row"><span className="k">{t("pm.service")}</span><span className="v">{t(completed.service_category)}</span></div>
            <div className="mk-row"><span className="k">{t("availability.dateLabel")}</span><span className="v">{formatAppointment(completed.service_date, lang)}</span></div>
            <div className="mk-row"><span className="k">{t("pm.location")}</span><span className="v">{completed.location_text ?? "—"}</span></div>
            <div className="mk-row"><span className="k">{t("financial.price")}</span><span className="v">{completed.price == null ? t("financial.pricePending") : completed.price.toFixed(2) + " " + completed.currency}</span></div>
          </div>
          <div className="mk-success-actions">
            <button type="button" className="mk-btn mk-btn--block" onClick={() => navigate("/bookings")}>{t("bk.viewMyRequests")}</button>
            <button type="button" className="mk-btn mk-btn--ghost mk-btn--block" onClick={() => navigate("/discover")}>{t("pdetail.back")}</button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="screen booking" aria-busy={submitting}>
      <div className="mk-backrow">
        <button type="button" className="mk-backbtn" onClick={goBack}>
          <ChevronRight size={15} aria-hidden="true" style={dir === "ltr" ? { transform: "scaleX(-1)" } : undefined} />
          {t("bk.back")}
        </button>
      </div>

      <div className="mk-page-head" style={{ paddingTop: 4, marginBottom: 10 }}>
        <div>
          <span className="mk-kicker">{t("bflow.request")}</span>
          <h1>{t("bk.bookWith")} {provider.name}</h1>
        </div>
      </div>

      <div className="mk-booking-provider">
        <Avatar name={provider.name} src={provider.image} size="sm" />
        <div style={{ minWidth: 0 }}>
          <div className="n">{provider.name}</div>
          <div className="j">{provider.job} · {provider.city}</div>
        </div>
      </div>

      <div className="mk-stepper" aria-hidden="true">
        {STEPS.map((label, index) => (
          <span key={label} className={"mk-step-dot" + (index === step ? " on" : index < step ? " done" : "")} />
        ))}
      </div>
      <p className="mk-step-label">
        <b>{t(STEPS[step])}</b>
        <span>{step + 1} / {STEPS.length}</span>
      </p>

      {failMsg ? (
        <div className="mk-notice mk-notice--danger" role="alert" style={{ marginBottom: 12 }}>
          <Info size={16} aria-hidden="true" />
          <span>{t(failMsg)}</span>
        </div>
      ) : null}

      <div className="mk-card mk-card--pad" style={{ marginBottom: 8 }}>
        {step === 0 ? (
          <div className="mk-field" style={{ marginBottom: 0 }}>
            <span className="mk-label">{t("bflow.serviceType")}</span>
            <p className="mk-hint">{t("bflow.pickServiceHint")}</p>
            <div className="mk-opt-grid" role="group" aria-label={t("bflow.serviceType")}>
              {provider.services.map(service => (
                <button
                  type="button"
                  aria-pressed={form.service === service}
                  className="mk-opt"
                  key={service}
                  onClick={() => { update("service", service); setErrors(current => ({ ...current, service: undefined })); }}
                >
                  {t(service)}
                </button>
              ))}
            </div>
            {errors.service ? <p className="mk-err" role="alert">{errors.service}</p> : null}
          </div>
        ) : null}

        {step === 1 ? (
          <div className="mk-field" style={{ marginBottom: 0 }}>
            <label className="mk-label" htmlFor="booking-description">{t("bflow.desc")}</label>
            <p className="mk-hint">{t("bk.notesHint")}</p>
            <textarea
              id="booking-description"
              className="mk-textarea"
              rows={5}
              maxLength={500}
              placeholder={t("bflow.descExample")}
              value={form.description}
              onChange={event => update("description", event.target.value)}
            />
            <p className="mk-counter">{form.description.length}/500</p>
          </div>
        ) : null}

        {step === 2 ? (
          <>
            <div className="mk-field">
              <span className="mk-label">{t("bflow.schedule")}</span>
              <p className="mk-hint">{t("availability.chooseDateHint")}</p>
              {availabilityLoading ? (
                <div className="empty-state" aria-busy="true" style={{ padding: 24 }}>
                  <Loader2 className="spin" size={20} aria-hidden="true" />
                  <p>{t("common.loading")}</p>
                </div>
              ) : availabilityError ? (
                <div className="mk-notice mk-notice--warn" role="alert">
                  <Info size={16} aria-hidden="true" />
                  <span>{t("availability.loadSlotsError")}</span>
                </div>
              ) : (
                <TimeSlotPicker
                  providerId={provider.id}
                  availability={availability}
                  value={form.serviceDate}
                  onChange={iso => { update("serviceDate", iso); setErrors(current => ({ ...current, serviceDate: undefined })); setFailMsg(""); }}
                />
              )}
              {form.serviceDate ? <p className="mk-hint" style={{ fontWeight: 700, color: "var(--mk-brand-strong)" }}>{t("availability.dateLabel")}: {formatAppointment(form.serviceDate, lang)}</p> : null}
              {errors.serviceDate ? <p className="mk-err" role="alert">{errors.serviceDate}</p> : null}
            </div>
            <div className="mk-field" style={{ marginBottom: 0 }}>
              <label className="mk-label" htmlFor="booking-location">{t("bflow.locTitle")}</label>
              <p className="mk-hint">{t("bflow.locHint")}</p>
              <input
                id="booking-location"
                className="mk-input"
                aria-invalid={Boolean(errors.location)}
                aria-describedby={errors.location ? "booking-location-error" : undefined}
                value={form.location}
                placeholder={t("bflow.locExample")}
                onChange={event => { update("location", event.target.value); setErrors(current => ({ ...current, location: undefined })); }}
              />
              {errors.location ? <p id="booking-location-error" className="mk-err" role="alert">{errors.location}</p> : null}
            </div>
          </>
        ) : null}

        {step === 3 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <span className="mk-label">{t("bflow.review")}</span>
            <p className="mk-hint" style={{ marginTop: -6 }}>{t("bflow.reviewHint")}</p>
            <div className="mk-rows">
              <div className="mk-row"><span className="k">{t("bk.providerLabel")}</span><span className="v">{provider.name}</span></div>
              <div className="mk-row"><span className="k">{t("pm.service")}</span><span className="v">{t(form.service)}</span></div>
              <div className="mk-row"><span className="k">{t("availability.dateLabel")}</span><span className="v">{formatAppointment(form.serviceDate, lang)}</span></div>
              <div className="mk-row"><span className="k">{t("pm.location")}</span><span className="v">{form.location}</span></div>
              <div className="mk-row"><span className="k">{t("bflow.extra")}</span><span className="v">{form.description.trim() || "—"}</span></div>
              <div className="mk-row"><span className="k">{t("financial.price")}</span><span className="v">{t("financial.pricePending")}</span></div>
            </div>
            <div className="mk-notice">
              <Info size={16} aria-hidden="true" />
              <span>{t("bk.priceInfo")}</span>
            </div>
          </div>
        ) : null}
      </div>

      <div className="mk-stickybar-pad" />
      <div className="mk-stickybar" aria-label={t("bflow.review")}>
        <div className="mk-stickybar-inner">
          <button type="button" className="mk-btn mk-btn--secondary" onClick={goBack} disabled={submitting}>
            {step > 0 ? t("onb.prev") : t("common.cancel")}
          </button>
          <button type="button" className="mk-btn" style={{ flex: 1 }} onClick={next} disabled={submitting}>
            {submitting ? (
              <><Loader2 className="spin" size={17} aria-hidden="true" /> {t("bk.submitting")}…</>
            ) : step < 3 ? (
              t("bk.continue")
            ) : (
              t("bk.submitRequest")
            )}
          </button>
        </div>
      </div>
    </main>
  );
}
