import { useEffect, useState } from "react";
import {
  AlertCircle, ArrowLeft, Ban, Check, Clock, ExternalLink, FileText, Loader2,
  ShieldCheck, X,
} from "lucide-react";
import { Logo } from "../components/atoms";
import { useAuth } from "../auth";
import { useToast } from "../context";
import * as admin from "../lib/admin";
import type { AdminApplication, AdminDocument } from "../lib/admin";
import type { VerificationStatus } from "../types";
import { useLanguage } from "../i18n";

const TABS = ["adm.tabOverview", "adm.tabVerify"] as const;
type Tab = (typeof TABS)[number];

type CountStatus = "pending" | "approved" | "rejected";

const STATUS_FILTERS: { key: CountStatus; label: string }[] = [
  { key: "pending", label: "adm.pendingReview" },
  { key: "approved", label: "adm.approved" },
  { key: "rejected", label: "adm.rejectedBadge" },
];

type TranslateFunc = (key: string, vars?: Record<string, string | number>) => string;

function statusBadge(status: VerificationStatus, t: TranslateFunc) {
  if (status === "approved") return <span className="vk-badge ok"><Check size={11} /> {t("adm.approved")}</span>;
  if (status === "rejected") return <span className="vk-badge no"><X size={11} /> {t("adm.rejectedBadge")}</span>;
  if (status === "pending") return <span className="vk-badge wait"><Clock size={11} /> {t("adm.pendingReview")}</span>;
  if (status === "suspended") return <span className="vk-badge no"><Ban size={11} /> {t("adm.suspended")}</span>;
  return <span className="vk-badge">{status}</span>;
}

type ReviewDrawerProps = {
  app: AdminApplication;
  docs: AdminDocument[];
  docsLoading: boolean;
  docUrls: Record<string, string>;
  onOpenDoc: (d: AdminDocument) => void;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
  actionLoading: boolean;
  actionError: { message: string; tech: string } | null;
  rejecting: boolean;
  rejectReason: string;
  setRejectReason: (v: string) => void;
  confirmReject: () => void;
  cancelReject: () => void;
};

function ReviewDrawer(props: ReviewDrawerProps) {
  const { t } = useLanguage();
  const {
    app, docs, docsLoading, docUrls, onOpenDoc, onClose, onApprove, onReject,
    actionLoading, actionError, rejecting, rejectReason, setRejectReason, confirmReject, cancelReject,
  } = props;
  return (
    <div className="vk-drawer-overlay" onClick={onClose}>
      <div className="vk-drawer" onClick={(e) => e.stopPropagation()}>
        <div className="vk-drawer-head">
          <div>
            <span className="section-kicker">{t("adm.reviewApplication")}</span>
            <h2>{app.full_name || t("adm.applicant")}</h2>
          </div>
          <button className="ghost-button" onClick={onClose}><X size={16} /> {t("adm.close")}</button>
        </div>
        <div className="vk-drawer-body">
          <section className="vk-section">
            <h3>{t("adm.personalInfo")}</h3>
            {app.avatar_url ? (
              <div className="profile-image-wrap" style={{ marginBottom: 14 }}>
                <img src={app.avatar_url} alt={app.full_name || ""} />
              </div>
            ) : null}
            <div className="vk-rows">
              <div className="vk-row"><span>{t("adm.fullName")}</span><b>{app.full_name || "—"}</b></div>
              <div className="vk-row"><span>{t("adm.phone")}</span><b dir="ltr">{app.phone || "—"}</b></div>
              <div className="vk-row"><span>{t("adm.city")}</span><b>{app.city || "—"}</b></div>
            </div>
          </section>
          <section className="vk-section">
            <h3>{t("adm.professionalInfo")}</h3>
            <div className="vk-rows">
              <div className="vk-row"><span>{t("adm.profession")}</span><b>{app.profession || "—"}</b></div>
              <div className="vk-row"><span>{t("adm.serviceCategory")}</span><b>{app.service_category || "—"}</b></div>
              <div className="vk-row"><span>{t("adm.experienceYears")}</span><b>{app.experience_years ?? "—"}</b></div>
              <div className="vk-row vk-row-stack"><span>{t("adm.bio")}</span><b>{app.bio || "—"}</b></div>
            </div>
          </section>
          <section className="vk-section">
            <h3>{t("adm.uploadedDocs")}</h3>
            {docsLoading ? (
              <div className="state-loading"><Loader2 className="spin" size={18} /><p>{t("adm.loadingDocs")}</p></div>
            ) : docs.length === 0 ? (
              <p className="vk-empty">{t("adm.noDocs")}</p>
            ) : (
              <div className="vk-docs">
                {docs.map((d) => (
                  <div className="vk-doc" key={d.id}>
                    <span className="vk-doc-icon"><FileText size={15} /></span>
                    <div className="vk-doc-info">
                      <b>{t(admin.DOC_LABELS[d.document_type] || d.document_type)}</b>
                      <span>{t("adm.statusLabel")}: {d.status}</span>
                    </div>
                    <button className="mini-button" type="button" onClick={() => onOpenDoc(d)}>
                      <ExternalLink size={13} /> {t("adm.view")}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </section>
          {app.verification_status === "rejected" && app.rejection_reason ? (
            <div className="vk-reason"><b>{t("bk.rejectionReason")}::</b> <span>{app.rejection_reason}</span></div>
          ) : null}
        </div>
        <div className="vk-drawer-foot">
          {actionError ? (
            <div className="vk-action-error" role="alert">
              <AlertCircle size={14} /> {actionError.message}
              {actionError.tech ? (
                <div className="vk-action-error-tech">{actionError.tech}</div>
              ) : null}
            </div>
          ) : null}
          {rejecting ? (
            <>
              <textarea
                className="vk-textarea"
                rows={3}
                placeholder={t("adm.rejectPlaceholder")}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
              />
              <div className="cta-row" style={{ margin: 0 }}>
                <button className="primary" type="button" onClick={confirmReject} disabled={actionLoading}>
                  {actionLoading ? <Loader2 className="spin" size={15} /> : null} {t("pm.confirmReject")}
                </button>
                <button className="secondary" type="button" onClick={cancelReject} disabled={actionLoading}>{t("adm.cancel")}</button>
              </div>
            </>
          ) : (
            <div className="cta-row" style={{ margin: 0 }}>
              <button className="primary" type="button" onClick={onApprove} disabled={actionLoading}>
                {actionLoading ? <Loader2 className="spin" size={15} /> : <ShieldCheck size={15} />} {t("adm.acceptProvider")}
              </button>
              <button className="secondary" type="button" onClick={onReject} disabled={actionLoading}>
                <Ban size={15} /> {t("pm.rejectRequest")}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* Map raw RPC/network errors to actionable Arabic messages; the raw error
   is also captured in the console for development diagnostics. */
function explainActionError(raw: string, t: TranslateFunc): string {
  const s = raw.toLowerCase();
  if (s.includes("jwt") || s.includes("token") || s.includes("session") || s.includes("expired")) {
    return t("adm.errSession");
  }
  if (s.includes("forbidden")) return t("adm.errForbidden");
  if (s.includes("could not find the function")) return t("adm.errInvalidId");
  if (s.includes("not allowed")) return t("adm.errDbConstraint");
  return t("adm.errApproveFail");
}

export default function Admin({ switchRole }: { switchRole: () => void }) {
  const { t, lang, toggleLang } = useLanguage();
  const { profile } = useAuth();
  const { showToast } = useToast();

  const [tab, setTab] = useState<Tab>("adm.tabVerify");
  const [loading, setLoading] = useState(true);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [counts, setCounts] = useState<Record<CountStatus, number>>({ pending: 0, approved: 0, rejected: 0 });
  const [filter, setFilter] = useState<VerificationStatus>("pending");
  const [apps, setApps] = useState<AdminApplication[]>([]);
  const [listLoading, setListLoading] = useState(false);
  const [selected, setSelected] = useState<AdminApplication | null>(null);
  const [docs, setDocs] = useState<AdminDocument[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [docUrls, setDocUrls] = useState<Record<string, string>>({});
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<{ message: string; tech: string } | null>(null);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState("");

  async function reloadCounts() {
    try {
      const [p, a, r] = await Promise.all([
        admin.countByStatus("pending"),
        admin.countByStatus("approved"),
        admin.countByStatus("rejected"),
      ]);
      setCounts({ pending: p, approved: a, rejected: r });
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : t("adm.loadStatsFail"));
    }
  }

  async function reloadList(status: VerificationStatus) {
    setListLoading(true);
    try {
      setApps(await admin.listApplications(status));
      setLoadErr(null);
    } catch (e) {
      setLoadErr(e instanceof Error ? e.message : t("adm.loadAppsFail"));
      setApps([]);
    } finally {
      setListLoading(false);
    }
  }

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      await reloadCounts();
      if (active) setLoading(false);
    })();
    return () => { active = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      setListLoading(true);
      try {
        const list = await admin.listApplications(filter);
        if (active) { setApps(list); setLoadErr(null); }
      } catch (e) {
        if (active) { setLoadErr(e instanceof Error ? e.message : t("adm.loadAppsFail")); setApps([]); }
      } finally {
        if (active) setListLoading(false);
      }
    })();
    return () => { active = false; };
  }, [filter]);

  async function openReview(app: AdminApplication) {
    setSelected(app);
    setDocs([]);
    setDocUrls({});
    setActionError(null);
    setDocsLoading(true);
    try {
      setDocs(await admin.listApplicationDocuments(app.id));
    } catch (e) {
      showToast(t(e instanceof Error ? e.message : "adm.loadDocsFail"));
    } finally {
      setDocsLoading(false);
    }
  }

  async function openDoc(doc: AdminDocument) {
    const cached = docUrls[doc.id];
    if (cached) { window.open(cached, "_blank", "noopener"); return; }
    try {
      const url = await admin.signedDocumentUrl(doc.storage_path);
      setDocUrls((m) => ({ ...m, [doc.id]: url }));
      window.open(url, "_blank", "noopener");
    } catch (e) {
      showToast(t(e instanceof Error ? e.message : "adm.openDocFail"));
    }
  }

  async function handleApprove() {
    if (!selected?.id) {
      setActionError({ message: t("adm.errInvalidIdRetry"), tech: "" });
      return;
    }
    setActionError(null);
    setActionLoading(true);
    try {
      await admin.approveProvider(selected.id);
      showToast(t("adm.providerAccepted"));
      setSelected(null);
      await Promise.all([reloadCounts(), reloadList(filter)]);
    } catch (e) {
      const err = e as { message?: string; code?: string; details?: string | null; hint?: string | null };
      const raw = typeof err?.message === "string" && err.message ? err.message : String(e);
      const tech = [err?.code, raw, err?.details, err?.hint].filter((v) => v != null && v !== "").join(" · ");
      console.error("[admin] approve failed — provider_profile_id:", selected.id, "| full error object:", e);
      const message = explainActionError(raw, t);
      setActionError({ message, tech });
      showToast(message);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReject() {
    if (!selected?.id) {
      setActionError({ message: t("adm.errInvalidIdRetry"), tech: "" });
      return;
    }
    setActionError(null);
    setActionLoading(true);
    try {
      await admin.rejectProvider(selected.id, rejectReason);
      showToast(t("status.rejected"));
      setRejectOpen(false);
      setRejectReason("");
      setSelected(null);
      await Promise.all([reloadCounts(), reloadList(filter)]);
    } catch (e) {
      const err = e as { message?: string; code?: string; details?: string | null; hint?: string | null };
      const raw = typeof err?.message === "string" && err.message ? err.message : String(e);
      const tech = [err?.code, raw, err?.details, err?.hint].filter((v) => v != null && v !== "").join(" · ");
      console.error("[admin] reject failed — provider_profile_id:", selected.id, "| full error object:", e);
      const message = explainActionError(raw, t);
      setActionError({ message, tech });
      showToast(message);
    } finally {
      setActionLoading(false);
    }
  }

  const adminName = profile?.full_name || t("adm.adminFallback");

  return (
    <div className="admin">
      <aside className="admin-side">
        <Logo inverse />
        <div className="provider-side-title">
          <span>{t("adm.dashboard")}</span>
          <b>{adminName}</b>
        </div>
        {TABS.map((item) => (
          <button key={item} className={tab === item ? "active" : ""} onClick={() => setTab(item)}>{t(item)}</button>
        ))}
        <button className="return-app" onClick={switchRole}>{t("acct.signOut")}</button>
      </aside>
      <main className="admin-main">
        <div className="admin-top">
          <div>
            <span className="section-kicker">{t("adm.adminKicker")}</span>
            <h1>{t(tab)}</h1>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <button className="lang-toggle-btn" onClick={toggleLang} aria-label={t("lang.label")}>
              <span>{lang === "ar" ? "FR" : "عربي"}</span>
            </button>
            <span className="avatar">{t("adm.avatarLetter")}</span>
          </div>
        </div>

        {loading ? (
          <div className="state-loading"><Loader2 className="spin" size={26} /><p>{t("adm.loadingVerification")}</p></div>
        ) : tab === "adm.tabOverview" ? (
          <>
            <div className="metric-row">
              <div className="metric"><small>{t("adm.metricPending")}</small><strong>{counts.pending}</strong><span>{t("adm.awaitingDecision")}</span></div>
              <div className="metric"><small>{t("adm.metricApproved")}</small><strong>{counts.approved}</strong><span>{t("adm.verified")}</span></div>
              <div className="metric"><small>{t("adm.metricRejected")}</small><strong>{counts.rejected}</strong><span>{t("adm.needsFollowUp")}</span></div>
            </div>
            <div className="panel">
              <h2>{t("adm.verifyProviders")}</h2>
              <p>{t("adm.verifyDesc")}</p>
              <button className="primary" onClick={() => setTab("adm.tabVerify")}>{t("adm.openVerifyList")} <ArrowLeft size={15} /></button>
            </div>
          </>
        ) : loadErr && apps.length === 0 && !listLoading ? (
          <div className="state-error">
            <AlertCircle size={26} />
            <h3>{t("adm.loadFail")}</h3>
            <p>{t(loadErr)}</p>
            <button className="secondary" onClick={() => window.location.reload()}>{t("common.retryBtn")}</button>
          </div>
        ) : (
          <>
            <div className="chips" style={{ marginBottom: 18 }}>
              {STATUS_FILTERS.map((s) => (
                <button
                  key={s.key}
                  className={"filter-button" + (filter === s.key ? " active" : "")}
                  onClick={() => setFilter(s.key)}
                >
                  {t(s.label)} · {counts[s.key]}
                </button>
              ))}
            </div>
            {listLoading ? (
              <div className="state-loading"><Loader2 className="spin" size={24} /><p>{t("adm.loadingApps")}</p></div>
            ) : apps.length === 0 ? (
              <div className="panel"><p>{t("bookings.emptyFiltered")}</p></div>
            ) : (
              <div className="vk-list">
                {apps.map((app) => (
                  <div className="vk-card" key={app.id}>
                    <div className="vk-card-main">
                      <div className="vk-avatar">{(app.full_name || app.id).charAt(0)}</div>
                      <div className="vk-card-info">
                        <div className="vk-card-head">{app.full_name || t("adm.applicant")} {statusBadge(app.verification_status, t)}</div>
                        <p>{app.profession || "—"} · {app.city || "—"}</p>
                      </div>
                    </div>
                    <button className="secondary" onClick={() => openReview(app)}>{t("adm.review")} <ArrowLeft size={14} /></button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {selected ? (
          <ReviewDrawer
            app={selected}
            docs={docs}
            docsLoading={docsLoading}
            docUrls={docUrls}
            onOpenDoc={openDoc}
            onClose={() => setSelected(null)}
            onApprove={handleApprove}
            onReject={() => { setRejectOpen(true); setRejectReason(""); setActionError(null); }}
            actionLoading={actionLoading}
            actionError={actionError}
            rejecting={rejectOpen}
            rejectReason={rejectReason}
            setRejectReason={setRejectReason}
            confirmReject={handleReject}
            cancelReject={() => { setRejectOpen(false); setRejectReason(""); }}
          />
        ) : null}
      </main>
    </div>
  );
}
