import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Activity, ArrowDownRight, ArrowUpRight, BarChart3, Bell, CalendarCheck2, ChevronLeft,
  ChevronRight, CircleAlert, LayoutDashboard, Menu, Search, ShieldCheck, Store, Users,
  UserRoundCheck, X, Zap,
} from "lucide-react";
import * as admin from "../lib/admin";
import type { AdminApplication, AdminBooking, AdminCustomer } from "../lib/admin";
import type { VerificationStatus } from "../types";

type Page = "dashboard" | "bookings" | "verification" | "providers" | "customers" | "marketplace" | "reports";
const nav: Array<{ id: Page; label: string; icon: typeof LayoutDashboard }> = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "bookings", label: "Bookings", icon: CalendarCheck2 },
  { id: "verification", label: "Verification", icon: ShieldCheck },
  { id: "providers", label: "Providers", icon: UserRoundCheck },
  { id: "customers", label: "Customers", icon: Users },
  { id: "marketplace", label: "Marketplace", icon: Store },
  { id: "reports", label: "Analytics", icon: BarChart3 },
];

function formatDate(value: string | null) {
  return value ? new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—";
}
function statusLabel(value: string) {
  return value.replaceAll("_", " ").replace(/\b\w/g, (m) => m.toUpperCase());
}
function Status({ value }: { value: string }) {
  const s = value.toLowerCase();
  const tone = ["approved", "active", "completed", "accepted", "confirmed"].includes(s) ? "good" : ["rejected", "suspended", "cancelled"].includes(s) ? "bad" : "warn";
  return <span className={`m2-status ${tone}`}>{statusLabel(value)}</span>;
}
function StatCard({ label, value, icon, note, tone = "teal" }: { label: string; value: string; icon: ReactNode; note: string; tone?: string }) {
  return <article className="m2-stat-card"><div className={`m2-stat-icon ${tone}`}>{icon}</div><p>{label}</p><strong>{value}</strong><span className="m2-stat-note">{note}</span></article>;
}

export default function AdminV2() {
  const [page, setPage] = useState<Page>("dashboard");
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [notice, setNotice] = useState("Live data from Maak");
  const [pending, setPending] = useState(0);
  const [approved, setApproved] = useState(0);
  const [rejected, setRejected] = useState(0);
  const [customers, setCustomers] = useState<{ rows: AdminCustomer[]; total: number }>({ rows: [], total: 0 });
  const [bookings, setBookings] = useState<{ rows: AdminBooking[]; total: number }>({ rows: [], total: 0 });
  const [providers, setProviders] = useState<AdminApplication[]>([]);
  const [marketplace, setMarketplace] = useState<{ total: number; rows: admin.AdminMarketplaceListing[] }>({ total: 0, rows: [] });
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = async () => {
    setLoadError(null);
    try {
      const [p, a, r, c, b, apps, listings] = await Promise.all([
        admin.countByStatus("pending"),
        admin.countByStatus("approved"),
        admin.countByStatus("rejected"),
        admin.listCustomers(),
        admin.listBookings(),
        admin.listApplications("pending" as VerificationStatus),
        admin.listMarketplace(),
      ]);
      setPending(p); setApproved(a); setRejected(r); setCustomers(c); setBookings(b); setProviders(apps); setMarketplace(listings);
      setNotice("Live data from Maak");
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Unable to load admin data");
      setNotice("Some live data could not be loaded");
    } finally { setLoading(false); }
  };

  useEffect(() => { void load(); }, []);

  const filteredBookings = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return bookings.rows;
    return bookings.rows.filter((b) => [b.id, b.customer_name, b.provider_name, b.service_category, b.status, b.location_text].some((v) => String(v ?? "").toLowerCase().includes(q)));
  }, [bookings.rows, search]);
  const filteredCustomers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return customers.rows;
    return customers.rows.filter((c) => [c.full_name, c.phone, c.city, c.account_status].some((v) => String(v ?? "").toLowerCase().includes(q)));
  }, [customers.rows, search]);
  const filteredProviders = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return providers;
    return providers.filter((p) => [p.full_name, p.phone, p.city, p.profession, p.service_category, p.verification_status].some((v) => String(v ?? "").toLowerCase().includes(q)));
  }, [providers, search]);
  const go = (next: Page) => { setPage(next); setMobileOpen(false); setSearch(""); window.scrollTo({ top: 0, behavior: "smooth" }); };

  if (loading) return <div className="admin-pro admin-loading"><LoaderDots /><span>Loading live admin data…</span></div>;

  return <div className="m2-shell">
    <button className="m2-mobile-trigger" aria-label="Open admin navigation" onClick={() => setMobileOpen(true)}><Menu size={21}/></button>
    <aside className={`m2-sidebar ${collapsed ? "collapsed" : ""} ${mobileOpen ? "mobile-open" : ""}`}>
      <div className="m2-sidebar-inner">
        <div className="m2-brand-row"><div className="m2-brand-mark">m<span/></div>{!collapsed && <div><b>maak<span>.</span></b><small>CONTROL CENTER</small></div>}<button className="m2-icon-btn mobile-only" aria-label="Close navigation" onClick={() => setMobileOpen(false)}><X size={18}/></button></div>
        {!collapsed && <button className="m2-search" onClick={() => document.getElementById("m2-global-search")?.focus()}><Search size={16}/><span>Search anything…</span><kbd>⌘ K</kbd></button>}
        <nav className="m2-nav" aria-label="Admin navigation">
          <p>WORKSPACE</p>{nav.slice(0,1).map((item) => <NavButton key={item.id} item={item} page={page} collapsed={collapsed} go={go}/>) }
          <p>OPERATIONS</p>{nav.slice(1,6).map((item) => <NavButton key={item.id} item={item} page={page} collapsed={collapsed} go={go} badge={item.id === "verification" ? pending : item.id === "bookings" ? bookings.total : undefined}/>) }
          <p>INSIGHTS</p>{nav.slice(6).map((item) => <NavButton key={item.id} item={item} page={page} collapsed={collapsed} go={go}/>) }
        </nav>
        <div className="m2-sidebar-bottom">{!collapsed && <div className="m2-health"><span><i/>Live connection</span><small>Supabase · Auth · Storage</small><button onClick={() => void load()}>Refresh <Zap size={14}/></button></div>}<div className="m2-admin-user"><span className="m2-avatar">AD</span>{!collapsed && <div><b>Maak Admin</b><small>Authenticated administrator</small></div>}</div></div>
        <button className="m2-collapse" onClick={() => setCollapsed((v) => !v)} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>{collapsed ? <ChevronRight size={16}/> : <ChevronLeft size={16}/>}</button>
      </div>
    </aside>
    <main className="m2-main">
      <header className="m2-topbar"><div className="m2-breadcrumb"><span>Maak</span><ChevronRight size={14}/><strong>{nav.find((n) => n.id === page)?.label}</strong></div><div className="m2-top-actions"><label className="m2-global-search"><Search size={16}/><input id="m2-global-search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search live data…"/></label><button className="m2-icon-btn" aria-label="Refresh data" onClick={() => void load()}><Bell size={18}/></button><span className="m2-profile-pill">AD <span>Admin</span></span></div></header>
      {loadError && <div className="m2-notice error" role="alert">{loadError}</div>}
      {page === "dashboard" && <Dashboard pending={pending} approved={approved} rejected={rejected} customers={customers.total} bookings={bookings.total} listings={marketplace.total} filteredBookings={filteredBookings} notice={notice} go={go}/>} 
      {page === "bookings" && <DataPage title="Bookings" kicker="OPERATIONS" rows={filteredBookings.map((b) => [b.id, b.customer_name ?? "—", b.provider_name ?? "—", b.service_category, b.status, formatDate(b.service_date)])} headers={["Booking","Customer","Provider","Service","Status","Service date"]} empty="No bookings yet."/>}
      {page === "customers" && <DataPage title="Customers" kicker="CUSTOMER BASE" rows={filteredCustomers.map((c) => [c.full_name ?? "Unnamed", c.phone ?? "—", c.city ?? "—", c.account_status, formatDate(c.created_at)])} headers={["Customer","Phone","City","Status","Created"]} empty="No customer accounts yet."/>}
      {page === "verification" && <DataPage title="Provider verification" kicker="TRUST & SAFETY" rows={filteredProviders.map((p) => [p.full_name ?? "Unnamed", p.profession ?? "—", p.city ?? "—", p.experience_years == null ? "—" : `${p.experience_years} yrs`, p.verification_status, formatDate(p.updated_at)])} headers={["Applicant","Profession","City","Experience","Status","Updated"]} empty="No pending applications."/>}
      {page === "providers" && <DataPage title="Providers" kicker="PROVIDER NETWORK" rows={providers.map((p) => [p.full_name ?? "Unnamed", p.profession ?? "—", p.service_category ?? "—", p.city ?? "—", p.verification_status])} headers={["Provider","Profession","Category","City","Status"]} empty="No provider profiles yet."/>}
      {page === "marketplace" && <DataPage title="Marketplace" kicker="PUBLISHED INVENTORY" rows={marketplace.rows.map((r) => [r.name, r.job, r.city, r.rating == null ? "—" : String(r.rating), r.published_at ? formatDate(r.published_at) : "—"])} headers={["Listing","Service","City","Rating","Published"]} empty="No published real listings yet."/>}
      {page === "reports" && <section className="m2-placeholder"><span className="m2-placeholder-icon"><BarChart3 size={22}/></span><span className="m2-kicker">REPORTING</span><h1>Live platform snapshot</h1><p>The current database exposes operational counts and booking records, but it does not contain a booking amount/revenue field. This screen therefore avoids inventing revenue figures.</p><div className="m2-grid m2-grid-4"><StatCard label="Customers" value={String(customers.total)} icon={<Users size={18}/>} note="Live count"/><StatCard label="Bookings" value={String(bookings.total)} icon={<CalendarCheck2 size={18}/>} note="Live count" tone="blue"/><StatCard label="Published listings" value={String(marketplace.total)} icon={<Store size={18}/>} note="Real listings only" tone="gold"/><StatCard label="Pending review" value={String(pending)} icon={<ShieldCheck size={18}/>} note="Verification queue" tone="clay"/></div></section>}
    </main>
  </div>;
}

function NavButton({ item, page, collapsed, go, badge }: { item: (typeof nav)[number]; page: Page; collapsed: boolean; go: (next: Page) => void; badge?: number }) { const Icon = item.icon; return <button className={page === item.id ? "active" : ""} onClick={() => go(item.id)} title={collapsed ? item.label : undefined}><Icon size={18}/>{!collapsed && <span>{item.label}</span>}{!collapsed && badge != null && badge > 0 && <b>{badge > 99 ? "99+" : badge}</b>}</button>; }
function LoaderDots() { return <span className="m2-loader" aria-hidden="true"><i/><i/><i/></span>; }
function DataPage({ title, kicker, rows, headers, empty }: { title: string; kicker: string; rows: string[][]; headers: string[]; empty: string }) { return <section className="m2-placeholder"><span className="m2-kicker">{kicker}</span><h1>{title}</h1><p>Live records from the existing Maak data layer.</p><div className="m2-card"><div className="m2-table-wrap"><table><thead><tr>{headers.map((h) => <th key={h}>{h}</th>)}</tr></thead><tbody>{rows.length ? rows.map((row, i) => <tr key={i}>{row.map((cell, j) => <td key={j}>{j === headers.length - 2 ? <Status value={cell}/> : cell}</td>)}</tr>) : <tr><td colSpan={headers.length}><span className="m2-empty">{empty}</span></td></tr>}</tbody></table></div></div></section>; }
function Dashboard({ pending, approved, rejected, customers, bookings, listings, filteredBookings, notice, go }: { pending: number; approved: number; rejected: number; customers: number; bookings: number; listings: number; filteredBookings: AdminBooking[]; notice: string; go: (next: Page) => void }) {
  return <>
    <section className="m2-hero"><div><span className="m2-kicker"><i/>LIVE OPERATIONS · MAAK</span><h1>Admin control, <em>grounded in live data.</em></h1><p>The control center is connected to the existing Maak Supabase layer. No demo records are inserted into production.</p><div className="m2-hero-actions"><button className="m2-btn primary" onClick={() => go("verification")}><ShieldCheck size={16}/> Review queue · {pending}</button><button className="m2-btn light" onClick={() => go("bookings")}><CalendarCheck2 size={16}/> Open bookings</button></div></div><div className="m2-hero-mini-grid"><div><span>PENDING</span><b>{pending}</b><small>verification</small></div><div><span>APPROVED</span><b>{approved}</b><small>providers</small></div><div><span>REJECTED</span><b>{rejected}</b><small>applications</small></div><div><span>LISTINGS</span><b>{listings}</b><small>published</small></div></div></section>
    <section className="m2-grid m2-grid-4" aria-label="Live metrics"><StatCard label="Customers" value={String(customers)} icon={<Users size={18}/>} note="Live account count"/><StatCard label="Bookings" value={String(bookings)} icon={<CalendarCheck2 size={18}/>} note="Live booking count" tone="blue"/><StatCard label="Published listings" value={String(listings)} icon={<Store size={18}/>} note="Real listings only" tone="gold"/><StatCard label="Verification queue" value={String(pending)} icon={<ShieldCheck size={18}/>} note="Pending applications" tone="clay"/></section>
    <section className="m2-grid m2-grid-main"><article className="m2-card m2-attention"><div className="m2-card-head"><div><span className="m2-kicker clay">NEEDS ACTION</span><h2>Priority queue</h2></div><span className="m2-critical">{pending} pending</span></div><button className="m2-action-row" onClick={() => go("verification")}><span className="m2-action-icon"><CircleAlert size={17}/></span><span><b>Provider verification</b><small>{pending} applications currently pending</small></span><ChevronRight size={16}/></button><button className="m2-action-row" onClick={() => go("bookings")}><span className="m2-action-icon"><CalendarCheck2 size={17}/></span><span><b>Booking operations</b><small>{bookings} total records</small></span><ChevronRight size={16}/></button><button className="m2-action-row" onClick={() => go("marketplace")}><span className="m2-action-icon"><Store size={17}/></span><span><b>Marketplace</b><small>{listings} published real listings</small></span><ChevronRight size={16}/></button></article><article className="m2-card m2-side-card"><div className="m2-card-head"><div><span className="m2-kicker muted">PLATFORM PULSE</span><h2>Today</h2></div><Activity size={17}/></div><div className="m2-pulse"><div><span>Pending provider review</span><b>{pending}</b><i><em style={{ width: `${Math.min(100, pending * 4)}%` }}/></i></div><div><span>Approved providers</span><b>{approved}</b><i><em style={{ width: `${Math.min(100, approved * 4)}%` }}/></i></div><div><span>Rejected applications</span><b>{rejected}</b><i><em style={{ width: `${Math.min(100, rejected * 4)}%` }}/></i></div></div><div className="m2-notice">{notice}</div></article></section>
    <section className="m2-card"><div className="m2-card-head"><div><span className="m2-kicker muted">RECENT BOOKING ACTIVITY</span><h2>Latest operations</h2></div><button className="m2-link" onClick={() => go("bookings")}>View all <ChevronRight size={14}/></button></div><div className="m2-table-wrap"><table><thead><tr><th>Booking</th><th>Customer</th><th>Provider</th><th>Service</th><th>Status</th><th>Date</th></tr></thead><tbody>{filteredBookings.length ? filteredBookings.slice(0, 8).map((b) => <tr key={b.id}><td><b>{b.id}</b><small>{b.location_text ?? "—"}</small></td><td>{b.customer_name ?? "—"}</td><td>{b.provider_name ?? "—"}</td><td>{b.service_category}</td><td><Status value={b.status}/></td><td>{formatDate(b.created_at)}</td></tr>) : <tr><td colSpan={6}><span className="m2-empty">No bookings yet.</span></td></tr>}</tbody></table></div></section>
  </>;
}
