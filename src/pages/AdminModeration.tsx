import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Eye, EyeOff, RotateCcw, Search, ShieldCheck, Trash2, UserCheck, UserX, XCircle } from "lucide-react";
import * as admin from "../lib/admin";
import type { AdminApplication, AdminBooking, AdminReview, AdminUser } from "../lib/admin";
import type { VerificationStatus } from "../types";
import "../styles/admin-moderation.css";

type Tab = "users" | "providers" | "bookings" | "reviews";
type ProviderStatus = VerificationStatus | "all";
const providerStatuses: ProviderStatus[] = ["all", "pending", "approved", "rejected"];
const bookingStatuses = ["all", "pending", "accepted", "in_progress", "completed", "cancelled", "rejected"];
const displayStatus = (value: string) => value.split("_").join(" ");

function ActionButton({ label, onClick, tone = "default", disabled = false, icon }: { label: string; onClick: () => void; tone?: "default" | "danger" | "success"; disabled?: boolean; icon: ReactNode }) {
  return <button className={`adm-action ${tone}`} type="button" onClick={onClick} disabled={disabled}>{icon}<span>{label}</span></button>;
}
function Status({ value }: { value: string }) { return <span className={`adm-pill ${value}`}>{displayStatus(value)}</span>; }
function Empty({ text }: { text: string }) { return <div className="adm-empty"><ShieldCheck size={22} /><p>{text}</p></div>; }

export default function AdminModeration() {
  const [tab, setTab] = useState<Tab>("users");
  const [query, setQuery] = useState("");
  const [providerStatus, setProviderStatus] = useState<ProviderStatus>("all");
  const [bookingStatus, setBookingStatus] = useState("all");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [providers, setProviders] = useState<AdminApplication[]>([]);
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [reviews, setReviews] = useState<AdminReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setNotice("");
    try {
      const [userPage, pending, approved, rejected, bookingPage, reviewPage] = await Promise.all([
        admin.getAdminUsers(), admin.getAdminProviders("pending"), admin.getAdminProviders("approved"), admin.getAdminProviders("rejected"), admin.getAdminBookings(), admin.getAdminReviews(),
      ]);
      setUsers(userPage.rows);
      setProviders([...pending, ...approved, ...rejected].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()));
      setBookings(bookingPage.rows); setReviews(reviewPage.rows);
    } catch (error) { setNotice(error instanceof Error ? error.message : "Unable to load moderation data"); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const q = query.trim().toLowerCase();
  const filteredUsers = useMemo(() => users.filter((u) => [u.full_name, u.phone, u.city, u.role, u.account_status].some((v) => String(v ?? "").toLowerCase().includes(q))), [users, q]);
  const filteredProviders = useMemo(() => providers.filter((p) => (providerStatus === "all" || p.verification_status === providerStatus) && [p.full_name, p.phone, p.city, p.profession, p.service_category, p.verification_status, p.account_status].some((v) => String(v ?? "").toLowerCase().includes(q))), [providers, providerStatus, q]);
  const filteredBookings = useMemo(() => bookings.filter((b) => (bookingStatus === "all" || b.status === bookingStatus) && [b.id, b.customer_name, b.provider_name, b.service_category, b.status, b.payment_status, b.payment_method, b.location_text].some((v) => String(v ?? "").toLowerCase().includes(q))), [bookings, bookingStatus, q]);
  const filteredReviews = useMemo(() => reviews.filter((r) => [r.id, r.booking_id, r.customer_name, r.provider_name, r.comment, r.rating, r.is_hidden ? "hidden" : "visible"].some((v) => String(v ?? "").toLowerCase().includes(q))), [reviews, q]);

  async function act(id: string, fn: () => Promise<void>, success: string) { setBusy(id); try { await fn(); setNotice(success); await load(); } catch (error) { setNotice(error instanceof Error ? error.message : "Action failed"); } finally { setBusy(null); } }
  function confirmDelete(label: string) { return window.confirm(`Delete ${label}? This action cannot be undone.`); }

  return <section className="adm-center">
    <header className="adm-head"><div><span className="adm-kicker">ADMIN MODERATION</span><h1>Control &amp; moderation</h1><p>Manage users, provider applications, bookings and customer reviews from one secure workspace.</p></div><button className="adm-refresh" type="button" onClick={() => void load()} disabled={loading}><RotateCcw size={16} /> Refresh</button></header>
    {notice && <div className="adm-notice" role="status"><span>{notice}</span><button type="button" aria-label="Dismiss" onClick={() => setNotice("")}><XCircle size={16} /></button></div>}
    <div className="adm-toolbar"><label className="adm-search"><Search size={17} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search users, providers, bookings or reviews" aria-label="Search moderation data" /></label></div>
    <nav className="adm-tabs" aria-label="Moderation sections">{(["users", "providers", "bookings", "reviews"] as Tab[]).map((id) => <button key={id} className={tab === id ? "active" : ""} type="button" onClick={() => setTab(id)}>{id[0].toUpperCase() + id.slice(1)}<span>{id === "users" ? users.length : id === "providers" ? providers.length : id === "bookings" ? bookings.length : reviews.length}</span></button>)}</nav>
    {loading ? <div className="adm-loading"><RotateCcw size={20} className="adm-spin" />Loading moderation data…</div> : tab === "users" ? <UserTable rows={filteredUsers} busy={busy} onSuspend={(id) => void act(id, () => admin.suspendUser(id), "User suspended")} onActivate={(id) => void act(id, () => admin.activateUser(id), "User activated")} onDelete={(id) => { if (confirmDelete("this suspended user")) void act(id, () => admin.deleteUser(id), "User deleted"); }} /> : tab === "providers" ? <ProviderTable rows={filteredProviders} status={providerStatus} onStatus={setProviderStatus} busy={busy} onApprove={(id) => void act(id, () => admin.approveProvider(id), "Provider approved")} onReject={(id) => { const reason = window.prompt("Rejection reason:", "")?.trim(); if (reason) void act(id, () => admin.rejectProvider(id, reason), "Provider rejected"); }} /> : tab === "bookings" ? <BookingTable rows={filteredBookings} status={bookingStatus} onStatus={setBookingStatus} busy={busy} onCancel={(id) => { const reason = window.prompt("Cancellation reason:", "") ?? ""; void act(id, () => admin.cancelBooking(id, reason), "Booking cancelled"); }} onComplete={(id) => void act(id, () => admin.markBookingCompleted(id), "Booking marked completed")} onRefund={(id) => { if (confirmDelete("this payment/refund")) void act(id, () => admin.refundBooking(id, "Admin refund"), "Booking refunded"); }} /> : <ReviewTable rows={filteredReviews} busy={busy} onToggle={(id) => void act(id, () => admin.toggleReviewVisibility(id).then(() => undefined), "Review visibility updated")} onDelete={(id) => { if (confirmDelete("this review")) void act(id, () => admin.deleteReview(id), "Review deleted"); }} />}
  </section>;
}

function UserTable({ rows, busy, onSuspend, onActivate, onDelete }: { rows: AdminUser[]; busy: string | null; onSuspend: (id: string) => void; onActivate: (id: string) => void; onDelete: (id: string) => void }) {
  return <div className="adm-card"><div className="adm-card-title"><div><span>ACCOUNT MANAGEMENT</span><h2>Users</h2></div><b>{rows.length}</b></div><div className="adm-table-wrap"><table><thead><tr><th>User</th><th>Role</th><th>City</th><th>Created</th><th>Status</th><th>Actions</th></tr></thead><tbody>{rows.map((u) => <tr key={u.id}><td><strong>{u.full_name || "Unnamed user"}</strong><small>{u.phone || u.id}</small></td><td><Status value={u.role} /></td><td>{u.city || "—"}</td><td>{new Date(u.created_at).toLocaleDateString("en-GB")}</td><td><Status value={u.account_status} /></td><td className="adm-actions">{u.account_status === "active" ? <ActionButton label="Suspend" tone="danger" disabled={busy === u.id} onClick={() => onSuspend(u.id)} icon={<UserX size={15} />} /> : <ActionButton label="Activate" tone="success" disabled={busy === u.id} onClick={() => onActivate(u.id)} icon={<UserCheck size={15} />} />}<ActionButton label="Delete" tone="danger" disabled={busy === u.id || u.account_status !== "suspended"} onClick={() => onDelete(u.id)} icon={<Trash2 size={15} />} /></td></tr>)}</tbody></table>{!rows.length && <Empty text="No users match the current filters." />}</div></div>;
}

function ProviderTable({ rows, status, onStatus, busy, onApprove, onReject }: { rows: AdminApplication[]; status: ProviderStatus; onStatus: (s: ProviderStatus) => void; busy: string | null; onApprove: (id: string) => void; onReject: (id: string) => void }) {
  return <div className="adm-card"><div className="adm-card-title"><div><span>PROVIDER MODERATION</span><h2>Provider applications &amp; accounts</h2></div><select value={status} onChange={(e) => onStatus(e.target.value as ProviderStatus)} aria-label="Provider status"><option value="all">All</option>{providerStatuses.slice(1).map((s) => <option key={s} value={s}>{s}</option>)}</select></div><div className="adm-table-wrap"><table><thead><tr><th>Provider</th><th>Profession</th><th>City</th><th>Verification</th><th>Account</th><th>Actions</th></tr></thead><tbody>{rows.map((p) => <tr key={p.id}><td><strong>{p.full_name || "Unnamed provider"}</strong><small>{p.phone || p.id}</small></td><td>{p.profession || p.service_category || "—"}</td><td>{p.city || "—"}</td><td><Status value={p.verification_status} /></td><td><Status value={p.account_status} /></td><td className="adm-actions">{p.verification_status === "pending" && <><ActionButton label="Approve" tone="success" disabled={busy === p.id} onClick={() => onApprove(p.id)} icon={<CheckCircle2 size={15} />} /><ActionButton label="Reject" tone="danger" disabled={busy === p.id} onClick={() => onReject(p.id)} icon={<AlertTriangle size={15} />} /></>}</td></tr>)}</tbody></table>{!rows.length && <Empty text="No provider applications match the current filters." />}</div></div>;
}

function BookingTable({ rows, status, onStatus, busy, onCancel, onComplete, onRefund }: { rows: AdminBooking[]; status: string; onStatus: (s: string) => void; busy: string | null; onCancel: (id: string) => void; onComplete: (id: string) => void; onRefund: (id: string) => void }) {
  return <div className="adm-card"><div className="adm-card-title"><div><span>BOOKING MODERATION</span><h2>All bookings</h2></div><select value={status} onChange={(e) => onStatus(e.target.value)} aria-label="Booking status">{bookingStatuses.map((s) => <option key={s} value={s}>{displayStatus(s)}</option>)}</select></div><div className="adm-table-wrap"><table><thead><tr><th>Booking</th><th>Customer</th><th>Provider</th><th>Service</th><th>Status</th><th>Payment</th><th>Amount</th><th>Actions</th></tr></thead><tbody>{rows.map((b) => <tr key={b.id}><td><strong>{b.id.slice(0, 8)}</strong><small>{b.service_date ? new Date(b.service_date).toLocaleString("en-GB") : "No date"}</small></td><td>{b.customer_name || "—"}</td><td>{b.provider_name || "—"}</td><td>{b.service_category || "—"}</td><td><Status value={b.status} /></td><td><Status value={b.payment_status} /></td><td>{b.price == null ? "—" : `${b.price.toFixed(2)} ${b.currency}`}</td><td className="adm-actions">{!["completed", "cancelled", "rejected"].includes(b.status) && <ActionButton label="Cancel" tone="danger" disabled={busy === b.id} onClick={() => onCancel(b.id)} icon={<XCircle size={15} />} />}{b.status === "in_progress" && <ActionButton label="Complete" tone="success" disabled={busy === b.id} onClick={() => onComplete(b.id)} icon={<CheckCircle2 size={15} />} />}{b.payment_status === "paid" && <ActionButton label="Refund" tone="danger" disabled={busy === b.id} onClick={() => onRefund(b.id)} icon={<RotateCcw size={15} />} />}</td></tr>)}</tbody></table>{!rows.length && <Empty text="No bookings match the current filters." />}</div></div>;
}

function ReviewTable({ rows, busy, onToggle, onDelete }: { rows: AdminReview[]; busy: string | null; onToggle: (id: string) => void; onDelete: (id: string) => void }) {
  return <div className="adm-card"><div className="adm-card-title"><div><span>CONTENT MODERATION</span><h2>Customer reviews</h2></div><b>{rows.length}</b></div><div className="adm-table-wrap"><table><thead><tr><th>Review</th><th>Customer</th><th>Provider</th><th>Rating</th><th>Visibility</th><th>Actions</th></tr></thead><tbody>{rows.map((r) => <tr key={r.id}><td><strong>{r.comment || "No comment"}</strong><small>{r.booking_id.slice(0, 8)} · {new Date(r.created_at).toLocaleDateString("en-GB")}</small></td><td>{r.customer_name || "—"}</td><td>{r.provider_name || "—"}</td><td>★ {r.rating}/5</td><td><Status value={r.is_hidden ? "hidden" : "visible"} /></td><td className="adm-actions"><ActionButton label={r.is_hidden ? "Show" : "Hide"} disabled={busy === r.id} onClick={() => onToggle(r.id)} icon={r.is_hidden ? <Eye size={15} /> : <EyeOff size={15} />} /><ActionButton label="Delete" tone="danger" disabled={busy === r.id} onClick={() => onDelete(r.id)} icon={<Trash2 size={15} />} /></td></tr>)}</tbody></table>{!rows.length && <Empty text="No reviews match the current search." />}</div></div>;
}
