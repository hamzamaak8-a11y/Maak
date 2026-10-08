import { supabase } from '../lib/supabase';
import type { AccountStatus, Booking, PaymentStatus, VerificationStatus } from '../types';

export type AdminStats = {
  total_customers: number; total_providers: number; approved_providers: number; total_bookings: number;
  bookings_by_status: Record<string, number>; providers_by_status: Record<string, number>; published_listings: number;
};

export type AdminApplication = {
  id: string; profession: string | null; service_category: string | null; bio: string | null; experience_years: number | null;
  verification_status: VerificationStatus; rejection_reason: string | null; created_at: string; updated_at: string;
  full_name: string | null; phone: string | null; city: string | null; account_status: AccountStatus;
};
export type AdminDocument = { id: string; document_type: string; storage_path: string; status: string; created_at: string };
export type AdminUser = { id: string; role: string; full_name: string | null; phone: string | null; city: string | null; created_at: string; account_status: AccountStatus };
export type AdminBooking = Pick<Booking, 'id' | 'customer_id' | 'provider_id' | 'service_category' | 'service_date' | 'location_text' | 'status' | 'rejection_reason' | 'created_at' | 'price' | 'currency' | 'payment_status' | 'payment_method' | 'paid_at'> & { customer_name: string | null; provider_name: string | null };
export type AdminReview = { id: string; booking_id: string; customer_id: string; provider_id: string; rating: number; comment: string | null; is_hidden: boolean; created_at: string; customer_name: string | null; provider_name: string | null };
export type AuditEntry = { id: string; admin_id: string; action: string; target_type: string; target_id: string | null; metadata: Record<string, unknown>; created_at: string };

const PAGE = 50;

export async function fetchAdminStats(): Promise<AdminStats> {
  const { data, error } = await supabase.rpc('get_admin_dashboard_stats');
  if (error) throw error;
  return data as AdminStats;
}

export async function listApplications(status: VerificationStatus): Promise<AdminApplication[]> {
  const { data: rows, error } = await supabase
    .from('provider_profiles')
    .select('id,profession,service_category,bio,experience_years,verification_status,rejection_reason,created_at,updated_at')
    .eq('verification_status', status)
    .order('updated_at', { ascending: false })
    .limit(PAGE);
  if (error) throw error;
  const list = (rows ?? []) as Array<Omit<AdminApplication, 'full_name' | 'phone' | 'city' | 'account_status'>>;
  if (!list.length) return [];
  const { data: profs, error: pErr } = await supabase.from('profiles').select('id,full_name,phone,city,account_status').in('id', list.map(r => r.id));
  if (pErr) throw pErr;
  const map = new Map((profs ?? []).map(p => [p.id as string, p as { full_name: string | null; phone: string | null; city: string | null; account_status: AccountStatus }]));
  return list.map(r => ({ ...r, full_name: map.get(r.id)?.full_name ?? null, phone: map.get(r.id)?.phone ?? null, city: map.get(r.id)?.city ?? null, account_status: map.get(r.id)?.account_status ?? 'active' }));
}

export async function listApplicationDocuments(providerId: string): Promise<AdminDocument[]> {
  const { data, error } = await supabase.from('provider_documents').select('id,document_type,storage_path,status,created_at').eq('provider_id', providerId).order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as AdminDocument[];
}

export async function signedDocumentUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from('provider-documents').createSignedUrl(path, 300);
  if (error || !data?.signedUrl) throw error ?? new Error('err.generic');
  return data.signedUrl;
}

export async function approveProvider(id: string): Promise<void> {
  const { error } = await supabase.rpc('admin_approve_provider', { target: id });
  if (error) throw error;
}

export async function rejectProvider(id: string, reason: string): Promise<void> {
  if (!reason.trim()) throw new Error('reason_required');
  const { error } = await supabase.rpc('admin_reject_provider', { target: id, reason: reason.trim() });
  if (error) throw error;
}

export async function setAccountStatus(id: string, status: AccountStatus): Promise<void> {
  const { error } = await supabase.rpc('admin_set_account_status', { target: id, new_status: status });
  if (error) throw error;
}

export async function listUsers(): Promise<{ rows: AdminUser[]; total: number }> {
  const { data, error, count } = await supabase
    .from('profiles')
    .select('id,role,full_name,phone,city,created_at,account_status', { count: 'exact' })
    .in('role', ['customer', 'provider'])
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return { rows: (data ?? []) as AdminUser[], total: count ?? 0 };
}

export async function listAdminBookings(): Promise<AdminBooking[]> {
  const { data, error } = await supabase
    .from('bookings')
    .select('id,customer_id,provider_id,service_category,service_date,location_text,status,rejection_reason,created_at,customer_name,price,currency,payment_status,payment_method,paid_at')
    .order('created_at', { ascending: false })
    .limit(PAGE);
  if (error) throw error;
  const rows = (data ?? []) as Array<Omit<AdminBooking, 'provider_name'>>;
  if (!rows.length) return [];
  const ids = Array.from(new Set(rows.flatMap(r => [r.customer_id, r.provider_id])));
  const { data: profs, error: pErr } = await supabase.from('profiles').select('id,full_name').in('id', ids);
  if (pErr) throw pErr;
  const names = new Map((profs ?? []).map(p => [p.id as string, (p.full_name as string | null) ?? null]));
  return rows.map(r => ({ ...r, customer_name: r.customer_name || names.get(r.customer_id) || null, provider_name: names.get(r.provider_id) ?? null }));
}

export async function adminCancelBooking(id: string, reason: string): Promise<void> {
  const { error } = await supabase.rpc('admin_cancel_booking', { target: id, reason: reason.trim() || null });
  if (error) throw error;
}

export async function adminMarkPaid(id: string, method: string): Promise<{ payment_status: PaymentStatus }> {
  const { data, error } = await supabase.rpc('mark_booking_paid', { p_booking_id: id, p_payment_method: method.trim() || null });
  if (error) throw error;
  return data as { payment_status: PaymentStatus };
}

export async function listAdminReviews(offset = 0): Promise<{ rows: AdminReview[]; total: number }> {
  const { data, error } = await supabase.rpc('get_admin_reviews', { p_limit: PAGE, p_offset: offset });
  if (error) throw error;
  const p = (data ?? {}) as { reviews?: unknown; total_count?: unknown };
  return { rows: Array.isArray(p.reviews) ? (p.reviews as AdminReview[]) : [], total: Number(p.total_count ?? 0) };
}

export async function toggleReviewVisibility(id: string): Promise<AdminReview> {
  const { data, error } = await supabase.rpc('admin_toggle_review_visibility', { p_review_id: id });
  if (error) throw error;
  return data as AdminReview;
}

export async function listAudit(): Promise<AuditEntry[]> {
  const { data, error } = await supabase.from('admin_audit_log').select('id,admin_id,action,target_type,target_id,metadata,created_at').order('created_at', { ascending: false }).limit(40);
  if (error) throw error;
  return (data ?? []) as AuditEntry[];
}

/* ------------------------------ admin tools (migration 20261008100000) ------------------------------ */

export type DirectoryUser = {
  id: string; email: string | null; full_name: string | null; phone: string | null; city: string | null; role: 'customer' | 'provider' | 'admin';
  account_status: AccountStatus; created_at: string; last_sign_in_at: string | null; provider_status: VerificationStatus | null; total_count: number;
};

export async function directoryUsers(opts: { search?: string; role?: string; status?: string; limit?: number; offset?: number }): Promise<DirectoryUser[]> {
  const { data, error } = await supabase.rpc('admin_list_users', {
    p_search: opts.search?.trim() || null, p_role: opts.role || null, p_status: opts.status || null, p_limit: opts.limit ?? 50, p_offset: opts.offset ?? 0,
  });
  if (error) throw error;
  return ((data ?? []) as DirectoryUser[]).map(u => ({ ...u, total_count: Number(u.total_count) }));
}

export type UserOverview = {
  id: string; email: string | null; full_name: string | null; phone: string | null; city: string | null; role: 'customer' | 'provider' | 'admin';
  account_status: AccountStatus; created_at: string; last_sign_in_at: string | null; email_confirmed: boolean;
  provider_status: VerificationStatus | null; profession: string | null; service_category: string | null; rejection_reason: string | null; listing_published: boolean;
  bookings_as_customer: number; bookings_as_provider: number; open_bookings: number; reviews_written: number; reviews_received: number; reports_against: number; open_reports_against: number;
};

export async function userOverview(id: string): Promise<UserOverview> {
  const { data, error } = await supabase.rpc('admin_user_overview', { p_user: id });
  if (error) throw error;
  return data as UserOverview;
}

export type OverviewStats = {
  customers: number; providers: number; approved_providers: number; pending_applications: number; open_reports: number; suspended_accounts: number;
  total_bookings: number; open_bookings: number; bookings_7d: number; bookings_30d: number; completed_30d: number; new_users_7d: number; new_users_30d: number;
  unpaid_completed: number; paid_30d: Record<string, number>; reviews: number; daily: Array<{ day: string; bookings: number; users: number }>;
};

export async function overviewStats(): Promise<OverviewStats> {
  const { data, error } = await supabase.rpc('admin_overview_stats');
  if (error) throw error;
  return data as OverviewStats;
}

export async function sendAnnouncement(audience: 'all' | 'customers' | 'providers', title: string, body: string): Promise<number> {
  const { data, error } = await supabase.rpc('admin_send_announcement', { p_audience: audience, p_title: title, p_body: body });
  if (error) throw error;
  return Number(data ?? 0);
}

export async function deleteUserAccount(id: string): Promise<void> {
  const { error } = await supabase.rpc('admin_delete_user', { p_target: id });
  if (error) throw error;
}
