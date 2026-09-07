import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity, BarChart3, Bell, BookOpen, CalendarDays, Check, ChevronLeft, ChevronRight,
  FileText, Globe2, LayoutDashboard, Loader2, LogOut, Menu, MessageSquare, RefreshCw,
  Search, Settings, ShieldCheck, Store, UserCog, UserRoundCheck, Users, Wallet, X, Ban
} from "lucide-react";
import { Logo } from "../components/atoms";
import { useAuth } from "../auth";
import { useToast } from "../context";
import * as admin from "../lib/admin";
import type { AdminApplication, AdminBooking, AdminCustomer, AdminDocument } from "../lib/admin";
import { BOOKING_STATUS_LABELS } from "../lib/bookings";
import type { BookingStatus, VerificationStatus } from "../types";
import { useLanguage } from "../i18n";
import { supabase } from "../lib/supabaseClient";
import "../styles/admin-control-center.css";

type Section =
  | "overview" | "verification" | "bookings" | "messages" | "providers" | "customers"
  | "marketplace" | "payments" | "content" | "reports" | "audit" | "admins" | "system";
type Copy = Record<string, string>;

const AR: Copy = {
  overview:"لوحة التحكم", verification:"التحقق من مقدمي الخدمات", bookings:"الحجوزات", messages:"الرسائل",
  providers:"مقدمو الخدمات", customers:"العملاء", marketplace:"السوق", payments:"المدفوعات", content:"المحتوى",
  reports:"التقارير والتحليلات", audit:"سجل النشاط", admins:"حسابات المسؤولين", system:"الإعدادات",
  control:"مركز التحكم", subtitle:"إدارة منصة Maak", search:"بحث", refresh:"تحديث", period:"آخر 30 يوماً",
  pending:"قيد المراجعة", approved:"معتمد", rejected:"مرفوض", users:"المستخدمون", totalBookings:"الحجوزات",
  verifiedProviders:"المقدمون المعتمدون", recentBookings:"أحدث الحجوزات", pendingProviders:"مقدمو الخدمات بانتظار التحقق",
  viewAll:"عرض الكل", review:"مراجعة", status:"الحالة", service:"الخدمة", customer:"العميل", provider:"مقدم الخدمة",
  date:"التاريخ", location:"الموقع", actions:"الإجراءات", active:"نشط", suspended:"معلّق", suspend:"تعليق",
  reactivate:"تفعيل", cancel:"إلغاء", close:"إغلاق", documents:"الوثائق", profile:"الملف", phone:"الهاتف", city:"المدينة",
  experience:"الخبرة", serviceArea:"نطاق الخدمة", applied:"تاريخ الطلب", bio:"نبذة", accept:"اعتماد", reject:"رفض",
  reason:"سبب الرفض", confirm:"تأكيد", noPending:"لا توجد طلبات تحقق حالياً", noBookings:"لا توجد حجوزات حتى الآن",
  noCustomers:"لا توجد حسابات عملاء", noProviders:"لا توجد حسابات مقدمي خدمات", noMessages:"لا توجد رسائل متاحة حالياً",
  noMarketplace:"لا توجد خدمات منشورة حالياً", noPayments:"لا توجد بيانات مدفوعات متاحة", noContent:"لا توجد بيانات محتوى متاحة",
  noAudit:"لا يوجد نشاط مسجل حالياً", noAdmins:"لا توجد حسابات إدارة متاحة", noChart:"لا توجد بيانات كافية لعرض الاتجاه",
  accountInfo:"معلومات الحساب", language:"اللغة", admin:"المسؤول", signout:"تسجيل الخروج", back:"العودة إلى التطبيق",
  role:"الدور", accountStatus:"حالة الحساب", created:"تاريخ الإنشاء", bookingStatus:"حالة الحجز", noData:"لا توجد بيانات",
  completed:"مكتمل", inProgress:"قيد التنفيذ", accepted:"مقبول", cancelled:"ملغى", rejectedBooking:"مرفوض",
  activity:"النشاط", target:"الهدف", time:"الوقت", systemInfo:"الحساب والصلاحيات", menu:"القائمة",
  messagesUnavailable:"وحدة الرسائل غير متاحة حالياً", reportsEmpty:"ستظهر التحليلات عندما تتوفر بيانات فعلية.",
  paymentsEmpty:"ستظهر المدفوعات بعد ربط مصدر دفع فعلي.", contentEmpty:"ستظهر عناصر المحتوى بعد إدخال محتوى فعلي.",
  marketplaceEmpty:"لا يتم عرض أي مزود إلا بعد اعتماد ملفه ونشره فعلياً.",
};
const FR: Copy = {
  overview:"Tableau de bord", verification:"Vérification des prestataires", bookings:"Réservations", messages:"Messages",
  providers:"Prestataires", customers:"Clients", marketplace:"Marché", payments:"Paiements", content:"Contenu",
  reports:"Rapports & analyses", audit:"Journal d’activité", admins:"Comptes administrateurs", system:"Paramètres",
  control:"Centre de contrôle", subtitle:"Gestion de la plateforme Maak", search:"Rechercher", refresh:"Actualiser", period:"30 derniers jours",
  pending:"En attente", approved:"Approuvés", rejected:"Refusés", users:"Utilisateurs", totalBookings:"Réservations",
  verifiedProviders:"Prestataires approuvés", recentBookings:"Dernières réservations", pendingProviders:"Prestataires en attente de vérification",
  viewAll:"Tout voir", review:"Revoir", status:"Statut", service:"Service", customer:"Client", provider:"Prestataire",
  date:"Date", location:"Lieu", actions:"Actions", active:"Actif", suspended:"Suspendu", suspend:"Suspendre",
  reactivate:"Activer", cancel:"Annuler", close:"Fermer", documents:"Documents", profile:"Profil", phone:"Téléphone", city:"Ville",
  experience:"Expérience", serviceArea:"Zone de service", applied:"Date de demande", bio:"Présentation", accept:"Approuver", reject:"Refuser",
  reason:"Motif", confirm:"Confirmer", noPending:"Aucune demande de vérification", noBookings:"Aucune réservation pour le moment",
  noCustomers:"Aucun compte client", noProviders:"Aucun compte prestataire", noMessages:"Aucun message disponible", noMarketplace:"Aucun service publié",
  noPayments:"Aucune donnée de paiement disponible", noContent:"Aucune donnée de contenu disponible", noAudit:"Aucune activité enregistrée",
  noAdmins:"Aucun compte administrateur", noChart:"Données insuffisantes pour afficher une tendance", accountInfo:"Informations du compte",
  language:"Langue", admin:"Administrateur", signout:"Déconnexion", back:"Retour", role:"Rôle", accountStatus:"Statut du compte",
  created:"Créé le", bookingStatus:"Statut de la réservation", noData:"Aucune donnée", completed:"Terminée", inProgress:"En cours",
  accepted:"Acceptée", cancelled:"Annulée", rejectedBooking:"Refusée", activity:"Activité", target:"Cible", time:"Heure", systemInfo:"Compte et accès",
  menu:"Menu", messagesUnavailable:"La messagerie n’est pas encore disponible", reportsEmpty:"Les analyses apparaîtront avec des données réelles.",
  paymentsEmpty:"Les paiements apparaîtront après la connexion d’un moyen de paiement réel.", contentEmpty:"Le contenu apparaîtra après l’ajout de données réelles.",
  marketplaceEmpty:"Un prestataire n’apparaît qu’après validation et publication réelles.",
};

function initials(name: string | null) {
  return (name || "M").trim().split(/\s+/).slice(0, 2).map((x) => x[0]).join("").toUpperCase();
}
function Badge({ value, label }: { value: string; label?: string }) {
  const ok = ["approved","active","accepted","completed"].includes(value);
  const no = ["rejected","suspended","cancelled"].includes(value);
  return <span className={`cc-badge ${ok ? "ok" : no ? "no" : "warn"}`}><i />{label ?? value}</span>;
}
function Empty({ icon, children }: { icon: ReactNode; children: ReactNode }) {
  return <div className="cc-empty">{icon}<strong>{children}</strong></div>;
}
function SectionTitle({ eyebrow, title, action }: { eyebrow: string; title: string; action?: ReactNode }) {
  return <div className="cc-section-head"><div><span>{eyebrow}</span><h2>{title}</h2></div>{action}</div>;
}

type MarketplaceRow = { id:number; name:string|null; job:string|null; city:string|null; price:string|null; rating:string|null; reviews:number|null; image:string|null; available:boolean|null; services:unknown; experience:string|null; intro:string|null; provider_profile_id:string|null; listing_kind:string; published_at:string|null };
type AuditRow = { id:string; admin_id:string; action:string; target_type:string|null; target_id:string|null; metadata:Record<string,unknown>|null; created_at:string };
type AdminRow = { id:string; role:string; full_name:string|null; phone:string|null; city:string|null; created_at:string; account_status:"active"|"suspended" };

export default function AdminControlCenter({ switchRole }: { switchRole: () => void }) {
  const { lang, toggleLang, t } = useLanguage();
  const { profile } = useAuth();
  const { showToast } = useToast();
  const copy = lang === "fr" ? FR : AR;
  const [section, setSection] = useState<Section>("overview");
  const [status, setStatus] = useState<VerificationStatus>("pending");
  const [counts, setCounts] = useState({ pending:0, approved:0, rejected:0 });
  const [customers, setCustomers] = useState<{rows:AdminCustomer[]; total:number}>({rows:[],total:0});
  const [bookings, setBookings] = useState<{rows:AdminBooking[]; total:number}>({rows:[],total:0});
  const [providers, setProviders] = useState<AdminApplication[]>([]);
  const [marketplace, setMarketplace] = useState<MarketplaceRow[]>([]);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [adminAccounts, setAdminAccounts] = useState<AdminRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<AdminApplication|null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<AdminCustomer|null>(null);
  const [selectedBooking, setSelectedBooking] = useState<AdminBooking|null>(null);
  const [documents, setDocuments] = useState<AdminDocument[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [busyId, setBusyId] = useState<string|null>(null);

  async function loadCore() {
    setRefreshing(true);
    try {
      const [pending, approved, rejected, users, bks, apps] = await Promise.all([
        admin.countByStatus("pending"), admin.countByStatus("approved"), admin.countByStatus("rejected"),
        admin.listCustomers(), admin.listBookings(), admin.listApplications(status),
      ]);
      setCounts({ pending, approved, rejected }); setCustomers(users); setBookings(bks); setProviders(apps);
      const [market, auditRes, adminsRes] = await Promise.all([
        supabase.from("providers").select("id,name,job,city,price,rating,reviews,image,available,services,experience,intro,provider_profile_id,listing_kind,published_at").eq("listing_kind","real").not("published_at","is",null).not("provider_profile_id","is",null).order("published_at", {ascending:false}).limit(50),
        supabase.from("admin_audit_log").select("id,admin_id,action,target_type,target_id,metadata,created_at").order("created_at", {ascending:false}).limit(50),
        supabase.from("profiles").select("id,role,full_name,phone,city,created_at,account_status").eq("role","admin").order("created_at", {ascending:true}),
      ]);
      setMarketplace((market.data ?? []) as MarketplaceRow[]);
      setAudit((auditRes.data ?? []) as AuditRow[]);
      setAdminAccounts((adminsRes.data ?? []) as AdminRow[]);
    } catch (e) {
      showToast(e instanceof Error ? e.message : t("common.error"));
    } finally { setRefreshing(false); setLoading(false); }
  }
  useEffect(() => { void loadCore(); }, [status]);

  const filteredProviders = useMemo(() => filterRows(providers, search), [providers, search]);
  const filteredCustomers = useMemo(() => filterRows(customers.rows, search), [customers.rows, search]);
  const filteredBookings = useMemo(() => filterRows(bookings.rows, search), [bookings.rows, search]);
  const filteredMarketplace = useMemo(() => filterRows(marketplace, search), [marketplace, search]);
  const filteredAudit = useMemo(() => filterRows(audit, search), [audit, search]);
  const filteredAdmins = useMemo(() => filterRows(adminAccounts, search), [adminAccounts, search]);
  function filterRows<T extends Record<string, unknown>>(rows:T[], query:string):T[] {
    const q=query.trim().toLowerCase(); if (!q) return rows;
    return rows.filter(row => Object.values(row).some(v => String(v ?? "").toLowerCase().includes(q)));
  }

  const fmt = (iso:string|null) => iso ? new Intl.DateTimeFormat(lang === "fr" ? "fr-FR" : "ar-MA", {dateStyle:"medium", timeStyle:"short"}).format(new Date(iso)) : "—";
  const bookingLabel = (s:string) => { const key = BOOKING_STATUS_LABELS[s as BookingStatus]; return key ? t(key) : s; };
  const navigate = (next:Section) => { setSection(next); setSearch(""); setMobileMenu(false); };
  const statusCount = (s:VerificationStatus) => s === "pending" ? counts.pending : s === "approved" ? counts.approved : counts.rejected;
  const actionLabel = (action:string) => ({ approve_provider: lang === "fr" ? "Approbation d’un prestataire" : "اعتماد مقدم خدمة", reject_provider: lang === "fr" ? "Refus d’un prestataire" : "رفض مقدم خدمة", suspend_account: lang === "fr" ? "Suspension d’un compte" : "تعليق حساب", reactivate_account: lang === "fr" ? "Réactivation d’un compte" : "إعادة تفعيل حساب", cancel_booking: lang === "fr" ? "Annulation d’une réservation" : "إلغاء حجز" } as Record<string,string>)[action] ?? action;

  async function openProvider(p:AdminApplication) { setSelectedProvider(p); setRejectReason(""); setDocuments([]); setDocsLoading(true); try { setDocuments(await admin.listApplicationDocuments(p.id)); } catch(e) { showToast(e instanceof Error ? e.message : t("common.error")); } finally { setDocsLoading(false); } }
  async function providerAction(action:"approve"|"reject") {
    if (!selectedProvider) return;
    if (action === "reject" && !rejectReason.trim()) { showToast(t("adm.errReasonRequired")); return; }
    setBusyId(selectedProvider.id);
    try { if (action === "approve") await admin.approveProvider(selectedProvider.id); else await admin.rejectProvider(selectedProvider.id, rejectReason); setSelectedProvider(null); showToast(action === "approve" ? copy.accept : copy.reject); await loadCore(); }
    catch(e) { showToast(e instanceof Error ? e.message : t("common.error")); } finally { setBusyId(null); }
  }
  async function accountAction(user:AdminCustomer|AdminApplication) {
    if (user.id === profile?.id) return;
    const next = user.account_status === "suspended" ? "active" : "suspended"; setBusyId(user.id);
    try { await admin.setAccountStatus(user.id, next); setSelectedCustomer(null); setSelectedProvider(null); showToast(next === "active" ? copy.reactivate : copy.suspend); await loadCore(); }
    catch(e) { showToast(e instanceof Error ? e.message : t("common.error")); } finally { setBusyId(null); }
  }
  async function cancelSelectedBooking() {
    if (!selectedBooking) return; setBusyId(selectedBooking.id);
    try { await admin.cancelBooking(selectedBooking.id, lang === "fr" ? "Annulation administrative" : "إلغاء إداري"); setSelectedBooking(null); showToast(copy.cancel); await loadCore(); }
    catch(e) { showToast(e instanceof Error ? e.message : t("common.error")); } finally { setBusyId(null); }
  }
  async function openDocument(path:string) { try { window.open(await admin.signedDocumentUrl(path), "_blank", "noopener,noreferrer"); } catch(e) { showToast(e instanceof Error ? e.message : t("common.error")); } }

  function nav(key:Section, icon:ReactNode, label:string, count?:number) {
    return <button className={section === key ? "active" : ""} onClick={() => navigate(key)}>{icon}<span>{label}</span>{count && count > 0 ? <b className="nav-count">{count > 99 ? "99+" : count}</b> : null}</button>;
  }
  const mobileNav: Array<[Section,ReactNode,string]> = [["overview",<LayoutDashboard/>,copy.overview],["verification",<ShieldCheck/>,copy.verification],["bookings",<BookOpen/>,copy.bookings],["customers",<Users/>,copy.customers],["system",<Settings/>,copy.system]];

  if (loading) return <div className="admin-cc admin-loading"><Logo variant="lockup" size="sm"/><Loader2 className="cc-spin" size={26}/></div>;

  return <div className="admin-cc" dir={lang === "fr" ? "ltr" : "rtl"}>
    <aside className={`cc-side ${mobileMenu ? "open" : ""}`}>
      <div className="cc-brand"><Logo variant="lockup" size="sm"/><div><strong>Maak</strong><small>{copy.control}</small></div></div>
      <div className="cc-nav-group"><span>Maak</span>{nav("overview",<LayoutDashboard/>,copy.overview)}</div>
      <div className="cc-nav-group"><span>{lang === "fr" ? "Opérations" : "العمليات"}</span>{nav("verification",<UserRoundCheck/>,copy.verification,counts.pending)}{nav("bookings",<BookOpen/>,copy.bookings,bookings.total)}{nav("messages",<MessageSquare/>,copy.messages)}{nav("providers",<Users/>,copy.providers,counts.approved)}{nav("customers",<Users/>,copy.customers,customers.total)}{nav("marketplace",<Store/>,copy.marketplace,marketplace.length)}</div>
      <div className="cc-nav-group"><span>{lang === "fr" ? "Gestion" : "الإدارة"}</span>{nav("payments",<Wallet/>,copy.payments)}{nav("content",<FileText/>,copy.content)}{nav("reports",<BarChart3/>,copy.reports)}{nav("audit",<Activity/>,copy.audit)}{nav("admins",<UserCog/>,copy.admins)}{nav("system",<Settings/>,copy.system)}</div>
      <div className="cc-side-footer"><button onClick={toggleLang}><Globe2/><span>{lang === "fr" ? "العربية" : "Français"}</span></button><button onClick={switchRole}><LogOut/><span>{copy.signout}</span></button></div>
    </aside>
    {mobileMenu ? <button className="cc-overlay" onClick={() => setMobileMenu(false)} aria-label={copy.close}/> : null}
    <main className="cc-main">
      <header className="cc-top">
        <button className="cc-menu" onClick={() => setMobileMenu(v => !v)} aria-label={copy.menu}><Menu/></button>
        <div className="cc-top-title"><span>Maak · {copy.control}</span><h1>{copy[section]}</h1></div>
        <div className="cc-top-search"><Search/><input value={search} onChange={e => setSearch(e.target.value)} placeholder={copy.search}/></div>
        <div className="cc-top-actions"><button className="cc-icon" onClick={() => void loadCore()} disabled={refreshing} aria-label={copy.refresh}><RefreshCw className={refreshing ? "cc-spin" : ""}/></button><button className="cc-icon cc-notify" onClick={() => navigate("verification")} aria-label={copy.verification}><Bell/>{counts.pending > 0 ? <i>{counts.pending}</i> : null}</button><div className="cc-avatar">{initials(profile?.full_name ?? "A")}</div></div>
      </header>

      {section === "overview" && <Overview counts={counts} bookings={bookings.rows} providers={providers} marketplace={marketplace} copy={copy} fmt={fmt} bookingLabel={bookingLabel} onBookings={() => navigate("bookings")} onVerification={() => { navigate("verification"); setStatus("pending"); }} onOpenProvider={openProvider} />}
      {section === "verification" && <Verification providers={filteredProviders} status={status} setStatus={(s) => setStatus(s)} counts={counts} copy={copy} fmt={fmt} onOpen={openProvider}/>} 
      {section === "providers" && <Providers providers={filteredProviders} status={status} setStatus={setStatus} counts={counts} copy={copy} fmt={fmt} onOpen={openProvider} onAccount={accountAction} busyId={busyId}/>} 
      {section === "customers" && <Customers rows={filteredCustomers} total={customers.total} copy={copy} fmt={fmt} onOpen={setSelectedCustomer} onAccount={accountAction} busyId={busyId}/>} 
      {section === "bookings" && <Bookings rows={filteredBookings} copy={copy} fmt={fmt} bookingLabel={bookingLabel} onOpen={setSelectedBooking}/>} 
      {section === "messages" && <Placeholder title={copy.messages} icon={<MessageSquare/>}>{copy.noMessages}</Placeholder>}
      {section === "marketplace" && <Marketplace rows={filteredMarketplace} copy={copy} fmt={fmt}/>} 
      {section === "payments" && <Placeholder title={copy.payments} icon={<Wallet/>}>{copy.noPayments}</Placeholder>}
      {section === "content" && <Placeholder title={copy.content} icon={<FileText/>}>{copy.noContent}</Placeholder>}
      {section === "reports" && <Reports bookings={bookings.rows} total={bookings.total} copy={copy} bookingLabel={bookingLabel}/>} 
      {section === "audit" && <Audit rows={filteredAudit} copy={copy} fmt={fmt} actionLabel={actionLabel}/>} 
      {section === "admins" && <Admins rows={filteredAdmins} copy={copy} fmt={fmt} currentId={profile?.id ?? null}/>} 
      {section === "system" && <System profile={profile} copy={copy} lang={lang} onToggle={toggleLang} />}
    </main>
    <nav className="cc-mobile-nav">{mobileNav.map(([key,icon,label]) => <button key={key} className={section === key ? "active" : ""} onClick={() => navigate(key)}>{icon}<span>{label}</span></button>)}</nav>

    {selectedProvider && <Drawer title={copy.provider} onClose={() => setSelectedProvider(null)}>
      <div className="cc-profile-head"><div className="cc-big-avatar">{selectedProvider.avatar_url ? <img src={selectedProvider.avatar_url} alt=""/> : initials(selectedProvider.full_name)}</div><div><h2>{selectedProvider.full_name || "—"}</h2><p>{selectedProvider.profession || selectedProvider.service_category || "—"}</p></div><Badge value={selectedProvider.verification_status} label={selectedProvider.verification_status === "pending" ? copy.pending : selectedProvider.verification_status === "approved" ? copy.approved : copy.rejected}/></div>
      <div className="cc-info-grid"><div><span>{copy.phone}</span><strong>{selectedProvider.phone || "—"}</strong></div><div><span>{copy.city}</span><strong>{selectedProvider.city || "—"}</strong></div><div><span>{copy.experience}</span><strong>{selectedProvider.experience_years == null ? "—" : `${selectedProvider.experience_years} ${lang === "fr" ? "ans" : "سنوات"}`}</strong></div><div><span>{copy.applied}</span><strong>{fmt(selectedProvider.created_at)}</strong></div></div>
      {selectedProvider.bio ? <div className="cc-info"><h3>{copy.bio}</h3><p>{selectedProvider.bio}</p></div> : null}
      <div className="cc-info"><h3>{copy.documents}</h3>{docsLoading ? <div className="cc-loading"><Loader2 className="cc-spin" size={20}/></div> : documents.length === 0 ? <Empty icon={<FileText/>}>{copy.noData}</Empty> : <div className="cc-docs">{documents.map(doc => <button key={doc.id} onClick={() => void openDocument(doc.storage_path)}><FileText/><span>{t(admin.DOC_LABELS[doc.document_type] ?? "common.document")}</span><ChevronLeft/></button>)}</div>}</div>
      {selectedProvider.verification_status === "pending" ? <div className="cc-drawer-actions"><button className="cc-primary" disabled={busyId === selectedProvider.id} onClick={() => void providerAction("approve")}>{busyId === selectedProvider.id ? <Loader2 className="cc-spin"/> : <Check/>}{copy.accept}</button><button className="cc-danger" disabled={busyId === selectedProvider.id} onClick={() => { if (!rejectReason.trim()) { setRejectReason(" "); } }}>{copy.reject}</button></div> : null}
      {selectedProvider.verification_status === "pending" && <div className="cc-reject-box"><label>{copy.reason}</label><textarea value={rejectReason} onChange={e => setRejectReason(e.target.value)} placeholder={copy.reason}/><button className="cc-btn cc-danger" disabled={busyId === selectedProvider.id || !rejectReason.trim()} onClick={() => void providerAction("reject")}>{copy.confirm}</button></div>}
    </Drawer>}
    {selectedCustomer && <Drawer title={copy.customers} onClose={() => setSelectedCustomer(null)}><div className="cc-profile-head"><div className="cc-big-avatar">{initials(selectedCustomer.full_name)}</div><div><h2>{selectedCustomer.full_name || "—"}</h2><p>{copy.customers}</p></div><Badge value={selectedCustomer.account_status} label={selectedCustomer.account_status === "active" ? copy.active : copy.suspended}/></div><div className="cc-info-grid"><div><span>{copy.phone}</span><strong>{selectedCustomer.phone || "—"}</strong></div><div><span>{copy.city}</span><strong>{selectedCustomer.city || "—"}</strong></div><div><span>{copy.created}</span><strong>{fmt(selectedCustomer.created_at)}</strong></div><div><span>{copy.role}</span><strong>{selectedCustomer.role}</strong></div></div><div className="cc-drawer-actions"><button className="cc-btn" disabled={busyId === selectedCustomer.id || selectedCustomer.id === profile?.id} onClick={() => void accountAction(selectedCustomer)}>{busyId === selectedCustomer.id ? <Loader2 className="cc-spin"/> : <Ban/>}{selectedCustomer.account_status === "suspended" ? copy.reactivate : copy.suspend}</button></div></Drawer>}
    {selectedBooking && <Drawer title={copy.bookings} onClose={() => setSelectedBooking(null)}><div className="cc-info-grid"><div><span>{copy.customer}</span><strong>{selectedBooking.customer_name || "—"}</strong></div><div><span>{copy.provider}</span><strong>{selectedBooking.provider_name || "—"}</strong></div><div><span>{copy.service}</span><strong>{selectedBooking.service_category || "—"}</strong></div><div><span>{copy.date}</span><strong>{fmt(selectedBooking.service_date || selectedBooking.created_at)}</strong></div><div><span>{copy.location}</span><strong>{selectedBooking.location_text || "—"}</strong></div><div><span>{copy.status}</span><Badge value={selectedBooking.status} label={bookingLabel(selectedBooking.status)}/></div></div><div className="cc-drawer-actions">{!['cancelled','completed','rejected'].includes(selectedBooking.status) ? <button className="cc-btn cc-danger" disabled={busyId === selectedBooking.id} onClick={() => void cancelSelectedBooking()}>{busyId === selectedBooking.id ? <Loader2 className="cc-spin"/> : <Ban/>}{copy.cancel}</button> : null}</div></Drawer>}
  </div>;
}

function Overview({counts,bookings,providers,marketplace,copy,fmt,bookingLabel,onBookings,onVerification,onOpenProvider}:{counts:{pending:number;approved:number;rejected:number};bookings:AdminBooking[];providers:AdminApplication[];marketplace:MarketplaceRow[];copy:Copy;fmt:(s:string|null)=>string;bookingLabel:(s:string)=>string;onBookings:()=>void;onVerification:()=>void;onOpenProvider:(p:AdminApplication)=>void}) {
  const recent = bookings.slice(0,5); const pending = providers.slice(0,5);
  const completed = bookings.filter(b => b.status === "completed").length; const active = bookings.filter(b => ["accepted","in_progress"].includes(b.status)).length;
  return <div className="cc-content">
    <div className="cc-toolbar"><div><span className="cc-eyebrow">{copy.overview}</span><h2>{copy.dashboardTitle ?? copy.overview}</h2></div><select aria-label={copy.period}><option>{copy.period}</option></select></div>
    <section className="cc-kpis"><button className="cc-kpi featured" onClick={onVerification}><span>{copy.pending}</span><strong>{counts.pending}</strong><small>{copy.verification}</small><ShieldCheck/></button><button className="cc-kpi" onClick={onVerification}><span>{copy.approved}</span><strong>{counts.approved}</strong><small>{copy.verifiedProviders}</small><UserRoundCheck/></button><button className="cc-kpi"><span>{copy.totalBookings}</span><strong>{bookings.length}</strong><small>{copy.bookings}</small><CalendarDays/></button><button className="cc-kpi"><span>{copy.users}</span><strong>—</strong><small>{copy.noData}</small><Users/></button></section>
    <div className="cc-grid-wide"><section className="cc-panel"><SectionTitle eyebrow={copy.activity} title={copy.recentBookings} action={<button className="cc-link" onClick={onBookings}>{copy.viewAll}<ChevronLeft/></button>}/><div className="cc-panel-body">{recent.length === 0 ? <Empty icon={<CalendarDays/>}>{copy.noBookings}</Empty> : <div className="cc-list">{recent.map(b => <div className="cc-row" key={b.id}><div className="cc-avatar">{initials(b.customer_name)}</div><div className="cc-row-main"><strong>{b.service_category || "—"}</strong><span>{b.customer_name || "—"}</span></div><div><Badge value={b.status} label={bookingLabel(b.status)}/><small>{fmt(b.created_at)}</small></div></div>)}</div>}</div></section><section className="cc-panel"><SectionTitle eyebrow={copy.pendingProviders} title={copy.pendingProviders} action={<button className="cc-link" onClick={onVerification}>{copy.viewAll}<ChevronLeft/></button>}/><div className="cc-panel-body">{pending.length === 0 ? <Empty icon={<ShieldCheck/>}>{copy.noPending}</Empty> : <div className="cc-list">{pending.map(p => <button className="cc-row cc-row-button" key={p.id} onClick={() => onOpenProvider(p)}><div className="cc-avatar">{p.avatar_url ? <img src={p.avatar_url} alt=""/> : initials(p.full_name)}</div><div className="cc-row-main"><strong>{p.full_name || "—"}</strong><span>{p.profession || p.service_category || "—"}</span></div><span className="cc-action">{copy.review}<ChevronLeft/></span></button>)}</div>}</div></section></div>
    <section className="cc-panel"><SectionTitle eyebrow={copy.marketplace} title={copy.marketplace}/><div className="cc-panel-body">{marketplace.length === 0 ? <Empty icon={<Store/>}>{copy.marketplaceEmpty}</Empty> : <div className="cc-market-inline">{marketplace.slice(0,6).map(p => <div className="cc-market-card" key={p.id}><div className="cc-avatar">{p.image ? <img src={p.image} alt=""/> : initials(p.name)}</div><strong>{p.name || "—"}</strong><span>{p.job || "—"}{p.city ? ` · ${p.city}` : ""}</span></div>)}</div>}</div></section>
  </div>;
}

function Verification({providers,status,setStatus,counts,copy,fmt,onOpen}:{providers:AdminApplication[];status:VerificationStatus;setStatus:(s:VerificationStatus)=>void;counts:{pending:number;approved:number;rejected:number};copy:Copy;fmt:(s:string)=>string;onOpen:(p:AdminApplication)=>void}){ return <div className="cc-content"><div className="cc-toolbar"><div><span className="cc-eyebrow">{copy.verification}</span><h2>{copy.pendingProviders}</h2></div><div className="cc-filters">{(["pending","approved","rejected"] as VerificationStatus[]).map(s => <button key={s} className={status===s?"active":""} onClick={() => setStatus(s)}>{s === "pending" ? copy.pending : s === "approved" ? copy.approved : copy.rejected}<b>{s === "pending" ? counts.pending : s === "approved" ? counts.approved : counts.rejected}</b></button>)}</div></div><section className="cc-panel"><div className="cc-table-wrap"><table className="cc-table"><thead><tr><th>{copy.provider}</th><th>{copy.service}</th><th>{copy.city}</th><th>{copy.applied}</th><th>{copy.status}</th><th>{copy.actions}</th></tr></thead><tbody>{providers.length===0?<tr><td colSpan={6}><Empty icon={<ShieldCheck/>}>{copy.noPending}</Empty></td></tr>:providers.map(p => <tr key={p.id}><td><div className="cc-table-person"><div className="cc-avatar">{p.avatar_url ? <img src={p.avatar_url} alt=""/> : initials(p.full_name)}</div><span><strong>{p.full_name || "—"}</strong><small>{p.phone || "—"}</small></span></div></td><td>{p.profession || p.service_category || "—"}</td><td>{p.city || "—"}</td><td>{fmt(p.created_at)}</td><td><Badge value={p.verification_status} label={p.verification_status === "pending" ? copy.pending : p.verification_status === "approved" ? copy.approved : copy.rejected}/></td><td><button className="cc-btn" onClick={() => onOpen(p)}>{copy.review}<ChevronLeft/></button></td></tr>)}</tbody></table></div></section></div>; }
function Providers({providers,status,setStatus,counts,copy,fmt,onOpen,onAccount,busyId}:{providers:AdminApplication[];status:VerificationStatus;setStatus:(s:VerificationStatus)=>void;counts:{pending:number;approved:number;rejected:number};copy:Copy;fmt:(s:string)=>string;onOpen:(p:AdminApplication)=>void;onAccount:(p:AdminApplication)=>void;busyId:string|null}){ return <Verification providers={providers} status={status} setStatus={setStatus} counts={counts} copy={copy} fmt={fmt} onOpen={onOpen}/>; }
function Customers({rows,total,copy,fmt,onOpen,onAccount,busyId}:{rows:AdminCustomer[];total:number;copy:Copy;fmt:(s:string)=>string;onOpen:(u:AdminCustomer)=>void;onAccount:(u:AdminCustomer)=>void;busyId:string|null}){ return <div className="cc-content"><div className="cc-toolbar"><div><span className="cc-eyebrow">{copy.customers}</span><h2>{total}</h2></div></div><section className="cc-panel"><div className="cc-table-wrap"><table className="cc-table"><thead><tr><th>{copy.customer}</th><th>{copy.phone}</th><th>{copy.city}</th><th>{copy.created}</th><th>{copy.status}</th><th>{copy.actions}</th></tr></thead><tbody>{rows.length===0?<tr><td colSpan={6}><Empty icon={<Users/>}>{copy.noCustomers}</Empty></td></tr>:rows.map(u => <tr key={u.id}><td><div className="cc-table-person"><div className="cc-avatar">{initials(u.full_name)}</div><span><strong>{u.full_name || "—"}</strong><small>{u.role}</small></span></div></td><td>{u.phone || "—"}</td><td>{u.city || "—"}</td><td>{fmt(u.created_at)}</td><td><Badge value={u.account_status} label={u.account_status === "active" ? copy.active : copy.suspended}/></td><td><button className="cc-btn" onClick={() => onOpen(u)}>{copy.profile}<ChevronLeft/></button></td></tr>)}</tbody></table></div></section></div>; }
function Bookings({rows,copy,fmt,bookingLabel,onOpen}:{rows:AdminBooking[];copy:Copy;fmt:(s:string)=>string;bookingLabel:(s:string)=>string;onOpen:(b:AdminBooking)=>void}){ return <div className="cc-content"><div className="cc-toolbar"><div><span className="cc-eyebrow">{copy.bookings}</span><h2>{rows.length}</h2></div></div><section className="cc-panel"><div className="cc-table-wrap"><table className="cc-table"><thead><tr><th>{copy.customer}</th><th>{copy.provider}</th><th>{copy.service}</th><th>{copy.date}</th><th>{copy.status}</th><th>{copy.actions}</th></tr></thead><tbody>{rows.length===0?<tr><td colSpan={6}><Empty icon={<CalendarDays/>}>{copy.noBookings}</Empty></td></tr>:rows.map(b => <tr key={b.id}><td>{b.customer_name || "—"}</td><td>{b.provider_name || "—"}</td><td>{b.service_category || "—"}</td><td>{fmt(b.service_date || b.created_at)}</td><td><Badge value={b.status} label={bookingLabel(b.status)}/></td><td><button className="cc-btn" onClick={() => onOpen(b)}>{copy.profile}<ChevronLeft/></button></td></tr>)}</tbody></table></div></section></div>; }
function Marketplace({rows,copy,fmt}:{rows:MarketplaceRow[];copy:Copy;fmt:(s:string|null)=>string}){ return <div className="cc-content"><div className="cc-toolbar"><div><span className="cc-eyebrow">{copy.marketplace}</span><h2>{rows.length}</h2></div></div><section className="cc-panel"><div className="cc-table-wrap"><table className="cc-table"><thead><tr><th>{copy.provider}</th><th>{copy.service}</th><th>{copy.city}</th><th>{copy.created}</th><th>{copy.status}</th></tr></thead><tbody>{rows.length===0?<tr><td colSpan={5}><Empty icon={<Store/>}>{copy.marketplaceEmpty}</Empty></td></tr>:rows.map(p => <tr key={p.id}><td><div className="cc-table-person"><div className="cc-avatar">{p.image ? <img src={p.image} alt=""/> : initials(p.name)}</div><span><strong>{p.name || "—"}</strong><small>{p.job || "—"}</small></span></div></td><td>{p.job || "—"}</td><td>{p.city || "—"}</td><td>{fmt(p.published_at)}</td><td><Badge value="approved" label={copy.approved}/></td></tr>)}</tbody></table></div></section></div>; }
function Reports({bookings,total,copy,bookingLabel}:{bookings:AdminBooking[];total:number;copy:Copy;bookingLabel:(s:string)=>string}) { const statuses = ["pending","accepted","in_progress","completed","rejected","cancelled"]; const counts = statuses.map(s => ({s,n:bookings.filter(b=>b.status===s).length})); const max = Math.max(1,...counts.map(x=>x.n)); return <div className="cc-content"><div className="cc-toolbar"><div><span className="cc-eyebrow">{copy.reports}</span><h2>{total}</h2></div></div><div className="cc-report-grid"><section className="cc-panel"><SectionTitle eyebrow={copy.activity} title={copy.reports}/><div className="cc-panel-body">{total===0?<Empty icon={<BarChart3/>}>{copy.noChart}</Empty>:<div className="cc-bars">{counts.filter(x=>x.n>0).map(x=><div key={x.s}><span>{bookingLabel(x.s)}</span><div><i style={{width:`${Math.max(6,(x.n/max)*100)}%`}}/></div><b>{x.n}</b></div>)}</div>}</div></section><section className="cc-panel"><SectionTitle eyebrow={copy.bookings} title={copy.status}/><div className="cc-panel-body cc-stat-list">{counts.map(x => <div key={x.s}><span>{bookingLabel(x.s)}</span><strong>{x.n}</strong></div>)}</div></section></div></div>; }
function Audit({rows,copy,fmt,actionLabel}:{rows:AuditRow[];copy:Copy;fmt:(s:string)=>string;actionLabel:(s:string)=>string}) { return <div className="cc-content"><div className="cc-toolbar"><div><span className="cc-eyebrow">{copy.audit}</span><h2>{rows.length}</h2></div></div><section className="cc-panel"><div className="cc-panel-body">{rows.length===0?<Empty icon={<Activity/>}>{copy.noAudit}</Empty>:<div className="cc-timeline">{rows.map(r => <div key={r.id}><div className="cc-activity-icon"><Activity/></div><div><strong>{actionLabel(r.action)}</strong><span>{r.target_type || "—"}{r.target_id ? ` · ${r.target_id.slice(0,8)}…` : ""}</span><small>{fmt(r.created_at)}</small></div></div>)}</div>}</div></section></div>; }
function Admins({rows,copy,fmt,currentId}:{rows:AdminRow[];copy:Copy;fmt:(s:string)=>string;currentId:string|null}) { return <div className="cc-content"><div className="cc-toolbar"><div><span className="cc-eyebrow">{copy.admins}</span><h2>{rows.length}</h2></div></div><section className="cc-panel"><div className="cc-table-wrap"><table className="cc-table"><thead><tr><th>{copy.admin}</th><th>{copy.phone}</th><th>{copy.city}</th><th>{copy.created}</th><th>{copy.status}</th></tr></thead><tbody>{rows.length===0?<tr><td colSpan={5}><Empty icon={<UserCog/>}>{copy.noAdmins}</Empty></td></tr>:rows.map(a => <tr key={a.id}><td><div className="cc-table-person"><div className="cc-avatar">{initials(a.full_name)}</div><span><strong>{a.full_name || "—"}{a.id===currentId ? " · " + (copy.admin) : ""}</strong><small>{a.role}</small></span></div></td><td>{a.phone || "—"}</td><td>{a.city || "—"}</td><td>{fmt(a.created_at)}</td><td><Badge value={a.account_status} label={a.account_status === "active" ? copy.active : copy.suspended}/></td></tr>)}</tbody></table></div></section></div>; }
function System({profile,copy,lang,onToggle}:{profile:{full_name:string|null;phone:string|null;city:string|null;role:string}|null;copy:Copy;lang:"ar"|"fr";onToggle:()=>void}) { return <div className="cc-content"><div className="cc-toolbar"><div><span className="cc-eyebrow">{copy.system}</span><h2>{copy.accountInfo}</h2></div></div><div className="cc-settings-grid"><section className="cc-panel"><div className="cc-panel-body"><h3>{copy.accountInfo}</h3><div className="cc-info-grid"><div><span>{copy.admin}</span><strong>{profile?.full_name || "—"}</strong></div><div><span>{copy.role}</span><strong>{profile?.role || "—"}</strong></div><div><span>{copy.phone}</span><strong>{profile?.phone || "—"}</strong></div><div><span>{copy.city}</span><strong>{profile?.city || "—"}</strong></div></div></div></section><section className="cc-panel"><div className="cc-panel-body"><h3>{copy.language}</h3><button className="cc-setting" onClick={onToggle}><Globe2/><span>{lang === "fr" ? "Français" : "العربية"}</span><ChevronLeft/></button></div></section></div></div>; }
function Placeholder({title,icon,children}:{title:string;icon:ReactNode;children:ReactNode}) { return <div className="cc-content"><div className="cc-toolbar"><div><span className="cc-eyebrow">Maak</span><h2>{title}</h2></div></div><section className="cc-panel"><div className="cc-panel-body"><Empty icon={icon}>{children}</Empty></div></section></div>; }
function Drawer({title,onClose,children}:{title:string;onClose:()=>void;children:ReactNode}) { return <div className="cc-drawer-overlay" role="presentation" onMouseDown={e=>{if(e.currentTarget===e.target)onClose();}}><section className="cc-drawer" role="dialog" aria-modal="true"><header><h2>{title}</h2><button className="cc-icon" onClick={onClose} aria-label="Close"><X/></button></header><div className="cc-drawer-body">{children}</div></section></div>; }
