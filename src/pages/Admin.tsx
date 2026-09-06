import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity, Ban, BookOpen, CalendarDays, Check, ChevronLeft, ChevronRight, Clock3,
  ExternalLink, FileText, LayoutDashboard, Loader2, LogOut, Menu, RefreshCw, Search,
  Settings, ShieldCheck, UserRoundCheck, UserRoundX, Users, X,
} from "lucide-react";
import { Logo } from "../components/atoms";
import { useAuth } from "../auth";
import { useToast } from "../context";
import * as admin from "../lib/admin";
import type { AdminApplication, AdminBooking, AdminCustomer, AdminDocument } from "../lib/admin";
import { BOOKING_STATUS_LABELS } from "../lib/bookings";
import type { BookingStatus, VerificationStatus } from "../types";
import { useLanguage } from "../i18n";
import "../styles/admin-command-center.css";

type Section = "overview" | "providers" | "customers" | "bookings" | "system";
type Copy = Record<string, string>;

const AR: Copy = {
  dashboard:"الرئيسية", providers:"مقدمو الخدمات", customers:"العملاء", bookings:"الحجوزات", system:"الإعدادات",
  control:"الإدارة", subtitle:"نظرة سريعة على منصة Maak", refresh:"تحديث", verification:"طلبات التحقق", pending:"قيد المراجعة",
  approved:"معتمد", rejected:"مرفوض", totalUsers:"الحسابات", totalBookings:"الحجوزات", recent:"آخر الحجوزات", noData:"لا توجد بيانات",
  search:"بحث", review:"عرض", suspend:"تعليق", reactivate:"تفعيل", cancel:"إلغاء الحجز", close:"إغلاق", details:"عرض الكل",
  active:"نشط", suspended:"معلّق", role:"الدور", city:"المدينة", phone:"الهاتف", created:"تاريخ الإنشاء", service:"الخدمة",
  status:"الحالة", date:"التاريخ", customer:"العميل", provider:"مقدم الخدمة", account:"الحساب", systemTitle:"الإعدادات",
  documents:"الوثائق", accept:"اعتماد", reject:"رفض", rejectReason:"سبب الرفض", confirm:"تأكيد", back:"العودة إلى التطبيق",
  admin:"المسؤول", signout:"تسجيل الخروج", profile:"حساب المسؤول", language:"اللغة", accountInfo:"معلومات الحساب", open:"فتح",
  providerReview:"ملف مقدم الخدمة", customerDetails:"تفاصيل العميل", bookingDetails:"تفاصيل الحجز", all:"الكل", roleAdmin:"مسؤول",
  roleProvider:"مقدم خدمة", roleCustomer:"عميل", emptyProviders:"لا توجد طلبات في هذه الفئة", emptyCustomers:"لا يوجد عملاء",
  emptyBookings:"لا توجد حجوزات", cancelConfirm:"هل تريد إلغاء هذا الحجز؟", accountConfirm:"هل تريد تغيير حالة هذا الحساب؟",
  menu:"القائمة", activity:"النشاط", overview:"نظرة عامة"
};
const FR: Copy = {
  dashboard:"Accueil", providers:"Prestataires", customers:"Clients", bookings:"Réservations", system:"Paramètres",
  control:"Administration", subtitle:"Vue d’ensemble de Maak", refresh:"Actualiser", verification:"Vérifications", pending:"En attente",
  approved:"Approuvés", rejected:"Refusés", totalUsers:"Comptes", totalBookings:"Réservations", recent:"Dernières réservations", noData:"Aucune donnée",
  search:"Rechercher", review:"Voir", suspend:"Suspendre", reactivate:"Activer", cancel:"Annuler", close:"Fermer", details:"Tout voir",
  active:"Actif", suspended:"Suspendu", role:"Rôle", city:"Ville", phone:"Téléphone", created:"Créé le", service:"Service",
  status:"Statut", date:"Date", customer:"Client", provider:"Prestataire", account:"Compte", systemTitle:"Paramètres",
  documents:"Documents", accept:"Approuver", reject:"Refuser", rejectReason:"Motif", confirm:"Confirmer", back:"Retour",
  admin:"Administrateur", signout:"Déconnexion", profile:"Compte administrateur", language:"Langue", accountInfo:"Compte",
  open:"Ouvrir", providerReview:"Fiche prestataire", customerDetails:"Fiche client", bookingDetails:"Détails réservation", all:"Tous",
  roleAdmin:"Administrateur", roleProvider:"Prestataire", roleCustomer:"Client", emptyProviders:"Aucune demande dans cette catégorie",
  emptyCustomers:"Aucun client", emptyBookings:"Aucune réservation", cancelConfirm:"Annuler cette réservation ?",
  accountConfirm:"Modifier le statut de ce compte ?", menu:"Menu", activity:"Activité", overview:"Vue d’ensemble"
};

function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  const ok = ["approved","active","completed","accepted"].includes(s);
  const no = ["rejected","suspended","cancelled"].includes(s);
  return <span className={`ap-badge ${ok ? "ok" : no ? "no" : "warn"}`}>{status}</span>;
}
function initials(name: string | null) { return (name || "M").trim().split(/\s+/).slice(0,2).map(x => x[0]).join("").toUpperCase(); }

export default function Admin({ switchRole }: { switchRole: () => void }) {
  const { lang, toggleLang } = useLanguage();
  const { profile } = useAuth();
  const { showToast } = useToast();
  const t = lang === "fr" ? FR : AR;
  const [section, setSection] = useState<Section>("overview");
  const [counts, setCounts] = useState({ pending: 0, approved: 0, rejected: 0 });
  const [customers, setCustomers] = useState<{ rows: AdminCustomer[]; total: number }>({ rows: [], total: 0 });
  const [bookings, setBookings] = useState<{ rows: AdminBooking[]; total: number }>({ rows: [], total: 0 });
  const [providerStatus, setProviderStatus] = useState<VerificationStatus>("pending");
  const [providers, setProviders] = useState<AdminApplication[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<AdminApplication | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<AdminCustomer | null>(null);
  const [selectedBooking, setSelectedBooking] = useState<AdminBooking | null>(null);
  const [documents, setDocuments] = useState<AdminDocument[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const loadCore = async () => {
    setRefreshing(true);
    try {
      const [pending, approved, rejected, users, bks, apps] = await Promise.all([
        admin.countByStatus("pending"), admin.countByStatus("approved"), admin.countByStatus("rejected"),
        admin.listCustomers(), admin.listBookings(), admin.listApplications(providerStatus)
      ]);
      setCounts({ pending, approved, rejected }); setCustomers(users); setBookings(bks); setProviders(apps);
    } catch (e) { showToast(e instanceof Error ? e.message : "Error"); }
    finally { setRefreshing(false); setLoading(false); }
  };
  useEffect(() => { void loadCore(); }, [providerStatus]);

  const filteredUsers = useMemo(() => { const q = search.trim().toLowerCase(); return q ? customers.rows.filter(u => [u.full_name,u.phone,u.city,u.role].some(v => String(v ?? "").toLowerCase().includes(q))) : customers.rows; }, [customers.rows, search]);
  const filteredProviders = useMemo(() => { const q = search.trim().toLowerCase(); return q ? providers.filter(p => [p.full_name,p.phone,p.city,p.profession,p.service_category].some(v => String(v ?? "").toLowerCase().includes(q))) : providers; }, [providers, search]);
  const filteredBookings = useMemo(() => { const q = search.trim().toLowerCase(); return q ? bookings.rows.filter(b => [b.customer_name,b.provider_name,b.service_category,b.status,b.location_text].some(v => String(v ?? "").toLowerCase().includes(q))) : bookings.rows; }, [bookings.rows, search]);
  const fmt = (iso: string | null) => iso ? new Intl.DateTimeFormat(lang === "fr" ? "fr-FR" : "ar-MA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(iso)) : "—";
  const roleLabel = (r: string) => r === "admin" ? t.roleAdmin : r === "provider" ? t.roleProvider : t.roleCustomer;
  const bookingLabel = (s: string) => { const k = BOOKING_STATUS_LABELS[s as BookingStatus]; return k ? t[k] ?? s : s; };

  async function openProvider(p: AdminApplication) {
    setSelectedProvider(p); setRejecting(false); setRejectReason(""); setDocuments([]); setDocsLoading(true);
    try { setDocuments(await admin.listApplicationDocuments(p.id)); } catch (e) { showToast(e instanceof Error ? e.message : "Error"); }
    finally { setDocsLoading(false); }
  }
  async function providerAction(action: "approve" | "reject") {
    if (!selectedProvider) return; setBusyId(selectedProvider.id);
    try {
      if (action === "approve") await admin.approveProvider(selectedProvider.id); else await admin.rejectProvider(selectedProvider.id, rejectReason);
      showToast(action === "approve" ? t.accept : t.reject); setSelectedProvider(null); await loadCore();
    } catch (e) { showToast(e instanceof Error ? e.message : "Error"); } finally { setBusyId(null); }
  }
  async function accountAction(u: AdminCustomer | AdminApplication) {
    if (u.id === profile?.id) return; const next = u.account_status === "suspended" ? "active" : "suspended"; setBusyId(u.id);
    try { await admin.setAccountStatus(u.id, next); showToast(next === "active" ? t.reactivate : t.suspend); setSelectedCustomer(null); setSelectedProvider(null); await loadCore(); }
    catch (e) { showToast(e instanceof Error ? e.message : "Error"); } finally { setBusyId(null); }
  }
  async function cancelBooking() {
    if (!selectedBooking) return; setBusyId(selectedBooking.id);
    try { await admin.cancelBooking(selectedBooking.id, "Administrative cancellation"); showToast(t.cancel); setSelectedBooking(null); await loadCore(); }
    catch (e) { showToast(e instanceof Error ? e.message : "Error"); } finally { setBusyId(null); }
  }
  async function openDocument(path: string) { try { window.open(await admin.signedDocumentUrl(path), "_blank", "noopener,noreferrer"); } catch (e) { showToast(e instanceof Error ? e.message : "Error"); } }

  function navButton(key: Section, icon: ReactNode, label: string, count?: number) {
    return <button className={section === key ? "active" : ""} onClick={() => { setSection(key); setSearch(""); setMobileMenu(false); }}>{icon}<span>{label}</span>{count ? <b className="nav-count">{count}</b> : null}</button>;
  }
  if (loading) return <div className="admin-pro admin-loading"><Loader2 className="spin" size={30} /></div>;

  return <div className="admin-pro" dir={lang === "fr" ? "ltr" : "rtl"}>
    <aside className="admin-pro-side">
      <div className="admin-pro-brand"><Logo /><div><strong>Maak</strong><small>{t.control}</small></div></div>
      <nav className="admin-pro-nav">
        {navButton("overview", <LayoutDashboard />, t.dashboard)}
        {navButton("providers", <UserRoundCheck />, t.providers, counts.pending)}
        {navButton("customers", <Users />, t.customers, customers.total)}
        {navButton("bookings", <BookOpen />, t.bookings, bookings.total)}
        {navButton("system", <Settings />, t.system)}
      </nav>
      <div className="admin-pro-side-footer">
        <button onClick={toggleLang}><Activity /><span>{lang === "fr" ? "العربية" : "Français"}</span></button>
        <button onClick={switchRole}><LogOut /><span>{t.signout}</span></button>
      </div>
    </aside>

    {mobileMenu && <div className="admin-mobile-overlay" onClick={() => setMobileMenu(false)} />}
    <main className="admin-pro-main">
      <header className="admin-pro-top">
        <button className="ap-mobile-menu" onClick={() => setMobileMenu(v => !v)} aria-label={t.menu}><Menu /></button>
        <div className="admin-pro-title"><span className="ap-eyebrow">Maak · {t.control}</span><h1>{section === "overview" ? t.dashboard : section === "providers" ? t.providers : section === "customers" ? t.customers : section === "bookings" ? t.bookings : t.system}</h1><p>{t.subtitle}</p></div>
        <div className="admin-pro-actions"><button className="ap-icon" onClick={() => void loadCore()} disabled={refreshing} aria-label={t.refresh}><RefreshCw className={refreshing ? "spin" : ""} /></button><button className="ap-primary" onClick={() => setSection("providers")}><ShieldCheck />{t.verification}<span>{counts.pending}</span></button></div>
      </header>

      <section className="admin-pro-kpis">
        <button className="ap-kpi accent" onClick={() => { setSection("providers"); setProviderStatus("pending"); }}><div className="ap-kpi-top"><span>{t.pending}</span><Clock3 /></div><strong>{counts.pending}</strong><small>{t.verification}</small><i style={{ width: `${Math.min(100, counts.pending * 12)}%` }} /></button>
        <button className="ap-kpi" onClick={() => { setSection("providers"); setProviderStatus("approved"); }}><div className="ap-kpi-top"><span>{t.approved}</span><Check /></div><strong>{counts.approved}</strong><small>{t.providers}</small><i style={{ width: `${Math.min(100, counts.approved * 4)}%` }} /></button>
        <button className="ap-kpi" onClick={() => setSection("customers")}><div className="ap-kpi-top"><span>{t.totalUsers}</span><Users /></div><strong>{customers.total}</strong><small>{t.account}</small><i style={{ width: `${Math.min(100, customers.total * 5)}%` }} /></button>
        <button className="ap-kpi" onClick={() => setSection("bookings")}><div className="ap-kpi-top"><span>{t.totalBookings}</span><CalendarDays /></div><strong>{bookings.total}</strong><small>{t.bookings}</small><i style={{ width: `${Math.min(100, bookings.total * 5)}%` }} /></button>
      </section>

      {section === "overview" && <div className="admin-pro-grid">
        <section className="ap-panel ap-panel-featured"><div className="ap-panel-head"><div><span className="ap-section-label">{t.verification}</span><h2>{t.pending}</h2></div><button className="ap-btn" onClick={() => setSection("providers")}>{t.details}<ChevronLeft /></button></div><div className="ap-panel-body"><div className="ap-list">{providers.slice(0,6).map(p => <div className="ap-row" key={p.id}><div className="ap-avatar">{p.avatar_url ? <img src={p.avatar_url} alt="" /> : <span>{initials(p.full_name)}</span>}</div><div className="ap-row-main"><strong>{p.full_name || "—"}<StatusBadge status={p.verification_status} /></strong><span>{p.profession || p.service_category || "—"} · {p.city || "—"}</span></div><button className="ap-btn" onClick={() => void openProvider(p)}>{t.review}<ChevronLeft /></button></div>)}{!providers.length && <div className="ap-empty">{t.emptyProviders}</div>}</div></div></section>
        <section className="ap-panel"><div className="ap-panel-head"><div><span className="ap-section-label">{t.activity}</span><h2>{t.recent}</h2></div><button className="ap-btn" onClick={() => setSection("bookings")}>{t.details}<ChevronLeft /></button></div><div className="ap-panel-body"><div className="ap-activity">{bookings.rows.slice(0,6).map(b => <button className="ap-activity-item" key={b.id} onClick={() => setSelectedBooking(b)}><div className="ap-activity-icon"><BookOpen /></div><div><strong>{b.service_category}</strong><span>{b.customer_name || "—"}</span></div><StatusBadge status={bookingLabel(b.status)} /></button>)}{!bookings.rows.length && <div className="ap-empty">{t.emptyBookings}</div>}</div></div></section>
      </div>}

      {section === "providers" && <section className="ap-panel ap-page-panel"><div className="ap-panel-head"><div><span className="ap-section-label">{t.verification}</span><h2>{t.providers}</h2></div></div><div className="ap-panel-body"><div className="ap-toolbar"><div className="ap-search"><Search /><input value={search} onChange={e => setSearch(e.target.value)} placeholder={t.search} /></div><div className="ap-filters">{(["pending","approved","rejected"] as VerificationStatus[]).map(s => <button key={s} className={`ap-filter ${providerStatus === s ? "active" : ""}`} onClick={() => setProviderStatus(s)}>{s === "pending" ? t.pending : s === "approved" ? t.approved : t.rejected}</button>)}</div></div><div className="ap-list">{filteredProviders.map(p => <div className="ap-row" key={p.id}><div className="ap-avatar">{p.avatar_url ? <img src={p.avatar_url} alt="" /> : <span>{initials(p.full_name)}</span>}</div><div className="ap-row-main"><strong>{p.full_name || "—"}<StatusBadge status={p.verification_status}/>{p.account_status === "suspended" && <StatusBadge status={t.suspended}/>}</strong><span>{p.profession || p.service_category || "—"} · {p.city || "—"} · {p.phone || "—"}</span></div><div className="ap-actions"><button className="ap-btn" onClick={() => void openProvider(p)}>{t.review}</button>{p.id !== profile?.id && <button className={`ap-btn ${p.account_status === "suspended" ? "success" : "danger"}`} onClick={() => void accountAction(p)} disabled={busyId === p.id}>{p.account_status === "suspended" ? t.reactivate : t.suspend}</button>}</div></div>)}{!filteredProviders.length && <div className="ap-empty">{t.emptyProviders}</div>}</div></div></section>}

      {section === "customers" && <section className="ap-panel ap-page-panel"><div className="ap-panel-head"><div><span className="ap-section-label">{t.account}</span><h2>{t.customers}</h2></div></div><div className="ap-panel-body"><div className="ap-toolbar"><div className="ap-search"><Search /><input value={search} onChange={e => setSearch(e.target.value)} placeholder={t.search} /></div></div><div className="ap-table-wrap"><table className="ap-table"><thead><tr><th>{t.customer}</th><th>{t.role}</th><th>{t.city}</th><th>{t.created}</th><th>{t.status}</th><th /></tr></thead><tbody>{filteredUsers.map(u => <tr key={u.id}><td><button className="ap-person" onClick={() => setSelectedCustomer(u)}><span className="ap-mini-avatar">{initials(u.full_name)}</span><span><strong>{u.full_name || "—"}</strong><small>{u.phone || "—"}</small></span></button></td><td>{roleLabel(u.role)}</td><td>{u.city || "—"}</td><td>{fmt(u.created_at)}</td><td><StatusBadge status={u.account_status === "suspended" ? t.suspended : t.active}/></td><td><button className="ap-more" onClick={() => setSelectedCustomer(u)}>···</button></td></tr>)}</tbody></table>{!filteredUsers.length && <div className="ap-empty">{t.emptyCustomers}</div>}</div></div></section>}

      {section === "bookings" && <section className="ap-panel ap-page-panel"><div className="ap-panel-head"><div><span className="ap-section-label">{t.activity}</span><h2>{t.bookings}</h2></div></div><div className="ap-panel-body"><div className="ap-toolbar"><div className="ap-search"><Search /><input value={search} onChange={e => setSearch(e.target.value)} placeholder={t.search} /></div></div><div className="ap-table-wrap"><table className="ap-table"><thead><tr><th>{t.service}</th><th>{t.customer}</th><th>{t.provider}</th><th>{t.date}</th><th>{t.status}</th><th /></tr></thead><tbody>{filteredBookings.map(b => <tr key={b.id}><td><button className="ap-text-link" onClick={() => setSelectedBooking(b)}>{b.service_category}</button></td><td>{b.customer_name || "—"}</td><td>{b.provider_name || "—"}</td><td>{fmt(b.service_date || b.created_at)}</td><td><StatusBadge status={bookingLabel(b.status)}/></td><td>{!["completed","cancelled","rejected"].includes(b.status) && <button className="ap-btn danger" onClick={() => setSelectedBooking(b)}>{t.cancel}</button>}</td></tr>)}</tbody></table>{!filteredBookings.length && <div className="ap-empty">{t.emptyBookings}</div>}</div></div></section>}

      {section === "system" && <section className="ap-panel ap-page-panel"><div className="ap-panel-head"><div><span className="ap-section-label">{t.accountInfo}</span><h2>{t.profile}</h2></div></div><div className="ap-panel-body"><div className="ap-settings-card"><div className="ap-settings-icon"><Settings /></div><div><strong>{profile?.full_name || t.admin}</strong><span>{profile?.role ? roleLabel(profile.role) : t.admin}</span></div></div><div className="ap-settings-grid"><div><span>{t.language}</span><strong>{lang === "fr" ? "Français" : "العربية"}</strong><button className="ap-btn" onClick={toggleLang}>{lang === "fr" ? "العربية" : "Français"}</button></div><div><span>{t.account}</span><strong>{profile?.account_status === "suspended" ? t.suspended : t.active}</strong></div></div></div></section>}
    </main>

    <nav className="ap-mobile-nav">{navButton("overview", <LayoutDashboard />, t.dashboard)}{navButton("providers", <UserRoundCheck />, t.providers, counts.pending)}{navButton("customers", <Users />, t.customers)}{navButton("bookings", <BookOpen />, t.bookings)}{navButton("system", <Settings />, t.system)}</nav>

    {selectedProvider && <div className="ap-drawer-overlay" onMouseDown={() => setSelectedProvider(null)}><aside className="ap-drawer" onMouseDown={e => e.stopPropagation()}><div className="ap-drawer-head"><div><span className="ap-section-label">{t.providerReview}</span><h2>{selectedProvider.full_name || "—"}</h2><p>{selectedProvider.profession || selectedProvider.service_category || "—"}</p></div><button className="ap-icon" onClick={() => setSelectedProvider(null)}><X /></button></div><div className="ap-drawer-body"><div className="ap-info"><h3>{t.accountInfo}</h3><div className="ap-info-grid"><div><span>{t.city}</span><strong>{selectedProvider.city || "—"}</strong></div><div><span>{t.phone}</span><strong>{selectedProvider.phone || "—"}</strong></div><div><span>{t.status}</span><strong><StatusBadge status={selectedProvider.verification_status}/></strong></div><div><span>{t.created}</span><strong>{fmt(selectedProvider.created_at)}</strong></div></div></div><div className="ap-info"><h3>{t.documents}</h3>{docsLoading ? <Loader2 className="spin" /> : documents.length ? <div className="ap-docs">{documents.map(d => <button key={d.id} onClick={() => void openDocument(d.storage_path)}><FileText /><span>{d.document_type}</span><ExternalLink /></button>)}</div> : <div className="ap-empty">{t.noData}</div>}</div>{rejecting && <div className="ap-confirm"><p>{t.rejectReason}</p><textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} /></div>}</div><div className="ap-drawer-foot">{selectedProvider.verification_status === "pending" && <><button className="ap-primary" onClick={() => void providerAction("approve")} disabled={busyId === selectedProvider.id}><Check />{t.accept}</button><button className="ap-btn danger" onClick={() => rejecting ? void providerAction("reject") : setRejecting(true)} disabled={busyId === selectedProvider.id}><UserRoundX />{rejecting ? t.confirm : t.reject}</button></>}{selectedProvider.id !== profile?.id && <button className={`ap-btn ${selectedProvider.account_status === "suspended" ? "success" : "danger"}`} onClick={() => void accountAction(selectedProvider)} disabled={busyId === selectedProvider.id}>{selectedProvider.account_status === "suspended" ? t.reactivate : t.suspend}</button>}</div></aside></div>}

    {selectedCustomer && <div className="ap-drawer-overlay" onMouseDown={() => setSelectedCustomer(null)}><aside className="ap-drawer ap-drawer-short" onMouseDown={e => e.stopPropagation()}><div className="ap-drawer-head"><div><span className="ap-section-label">{t.customerDetails}</span><h2>{selectedCustomer.full_name || "—"}</h2></div><button className="ap-icon" onClick={() => setSelectedCustomer(null)}><X /></button></div><div className="ap-drawer-body"><div className="ap-info-grid"><div><span>{t.role}</span><strong>{roleLabel(selectedCustomer.role)}</strong></div><div><span>{t.status}</span><strong><StatusBadge status={selectedCustomer.account_status === "suspended" ? t.suspended : t.active}/></strong></div><div><span>{t.city}</span><strong>{selectedCustomer.city || "—"}</strong></div><div><span>{t.phone}</span><strong>{selectedCustomer.phone || "—"}</strong></div><div><span>{t.created}</span><strong>{fmt(selectedCustomer.created_at)}</strong></div></div></div><div className="ap-drawer-foot"><button className={`ap-btn ${selectedCustomer.account_status === "suspended" ? "success" : "danger"}`} onClick={() => void accountAction(selectedCustomer)} disabled={busyId === selectedCustomer.id}>{selectedCustomer.account_status === "suspended" ? t.reactivate : t.suspend}</button></div></aside></div>}

    {selectedBooking && <div className="ap-drawer-overlay" onMouseDown={() => setSelectedBooking(null)}><aside className="ap-drawer ap-drawer-short" onMouseDown={e => e.stopPropagation()}><div className="ap-drawer-head"><div><span className="ap-section-label">{t.bookingDetails}</span><h2>{selectedBooking.service_category}</h2></div><button className="ap-icon" onClick={() => setSelectedBooking(null)}><X /></button></div><div className="ap-drawer-body"><div className="ap-info-grid"><div><span>{t.customer}</span><strong>{selectedBooking.customer_name || "—"}</strong></div><div><span>{t.provider}</span><strong>{selectedBooking.provider_name || "—"}</strong></div><div><span>{t.date}</span><strong>{fmt(selectedBooking.service_date || selectedBooking.created_at)}</strong></div><div><span>{t.status}</span><strong><StatusBadge status={bookingLabel(selectedBooking.status)}/></strong></div></div><div className="ap-confirm"><p>{t.cancelConfirm}</p></div></div><div className="ap-drawer-foot">{!["completed","cancelled","rejected"].includes(selectedBooking.status) && <button className="ap-btn danger" onClick={() => void cancelBooking()} disabled={busyId === selectedBooking.id}><Ban />{t.cancel}</button>}</div></aside></div>}
  </div>;
}
