import { supabase } from '../lib/supabase';

export type ReportReason = 'spam' | 'abuse' | 'fraud' | 'inappropriate' | 'other';
export type ReportTarget = 'user' | 'review' | 'message';
export const REPORT_REASONS: ReportReason[] = ['spam', 'abuse', 'fraud', 'inappropriate', 'other'];

export async function submitReport(targetType: ReportTarget, targetId: string, reason: ReportReason, details?: string): Promise<void> {
  const { error } = await supabase.rpc('submit_report', { p_target_type: targetType, p_target_id: targetId, p_reason: reason, p_details: details?.trim() || null });
  if (error) throw error;
}

export type AdminReport = {
  id: string; target_type: ReportTarget; target_id: string; reason: ReportReason; details: string | null; status: 'open' | 'resolved' | 'dismissed';
  resolution_note: string | null; created_at: string; reporter_id: string | null; reporter_name: string | null;
  reported_user_id: string | null; reported_name: string | null; reported_account_status: string | null; content: string | null;
};

export async function listReports(status: 'open' | 'resolved' | 'dismissed'): Promise<AdminReport[]> {
  const { data, error } = await supabase.rpc('admin_list_reports', { p_status: status });
  if (error) throw error;
  return (data ?? []) as AdminReport[];
}

export async function resolveReport(id: string, status: 'resolved' | 'dismissed', note: string): Promise<void> {
  const { error } = await supabase.rpc('admin_resolve_report', { p_id: id, p_status: status, p_note: note.trim() || null });
  if (error) throw error;
}
