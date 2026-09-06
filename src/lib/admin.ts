import { supabase } from "./supabaseClient";
import type { VerificationStatus } from "../types";

export type AdminApplication = {
  id: string;
  profession: string | null;
  service_category: string | null;
  bio: string | null;
  experience_years: number | null;
  verification_status: VerificationStatus;
  rejection_reason: string | null;
  created_at: string;
  updated_at: string;
  full_name: string | null;
  phone: string | null;
  city: string | null;
  avatar_url: string | null;
  account_status: "active" | "suspended";
};

export type AdminDocument = {
  id: string;
  document_type: string;
  storage_path: string;
  status: string;
  created_at: string;
};

export const DOC_LABELS: Record<string, string> = {
  national_id: "onb.docNationalId",
  profile_photo: "onb.docProfilePhoto",
  professional_document: "adm.doc_professional_document",
  other: "adm.doc_other",
};

function msg(e: unknown, fallback: string): Error {
  const source = (e ?? {}) as { message?: unknown; code?: unknown; details?: unknown; hint?: unknown };
  const err = new Error(typeof source.message === "string" && source.message ? source.message : fallback);
  const enriched = err as Error & { code?: unknown; details?: unknown; hint?: unknown };
  if (source.code !== undefined) enriched.code = source.code;
  if (source.details !== undefined) enriched.details = source.details;
  if (source.hint !== undefined) enriched.hint = source.hint;
  return enriched;
}

export async function countByStatus(status: VerificationStatus): Promise<number> {
  const { count, error } = await supabase.from("provider_profiles").select("id", { count: "exact", head: true }).eq("verification_status", status);
  if (error) throw msg(error, "adm.loadStatsFail");
  return count ?? 0;
}

type RawAppRow = {
  id: string; profession: string | null; service_category: string | null; bio: string | null;
  experience_years: number | null; verification_status: VerificationStatus; rejection_reason: string | null;
  created_at: string; updated_at: string;
};
type RawProfile = { id: string; full_name: string | null; phone: string | null; city: string | null; avatar_url: string | null; account_status: "active" | "suspended" };

function toApp(r: RawAppRow, p: RawProfile | undefined): AdminApplication {
  return {
    id: r.id, profession: r.profession, service_category: r.service_category, bio: r.bio,
    experience_years: r.experience_years, verification_status: r.verification_status,
    rejection_reason: r.rejection_reason, created_at: r.created_at, updated_at: r.updated_at,
    full_name: p?.full_name ?? null, phone: p?.phone ?? null, city: p?.city ?? null,
    avatar_url: p?.avatar_url ?? null, account_status: p?.account_status ?? "active",
  };
}

export async function listApplications(status: VerificationStatus): Promise<AdminApplication[]> {
  const { data: rows, error } = await supabase.from("provider_profiles")
    .select("id,profession,service_category,bio,experience_years,verification_status,rejection_reason,created_at,updated_at")
    .eq("verification_status", status).order("updated_at", { ascending: false });
  if (error) throw msg(error, "adm.loadAppsFail");
  const list = (rows ?? []) as RawAppRow[];
  if (!list.length) return [];
  const ids = list.map((r) => r.id);
  const { data: profs, error: perr } = await supabase.from("profiles")
    .select("id,full_name,phone,city,avatar_url,account_status").in("id", ids);
  if (perr) throw msg(perr, "adm.errApplicants");
  const map = new Map<string, RawProfile>((profs ?? []).map((p) => [p.id, p as RawProfile]));
  return list.map((r) => toApp(r, map.get(r.id)));
}

export async function listApplicationDocuments(providerId: string): Promise<AdminDocument[]> {
  const { data, error } = await supabase.from("provider_documents")
    .select("id,document_type,storage_path,status,created_at").eq("provider_id", providerId).order("created_at", { ascending: true });
  if (error) throw msg(error, "adm.loadDocsFail");
  return (data ?? []) as AdminDocument[];
}

export async function signedDocumentUrl(path: string): Promise<string> {
  const { data, error } = await supabase.storage.from("provider-documents").createSignedUrl(path, 300);
  if (error) throw msg(error, "adm.openDocFail");
  if (!data?.signedUrl) throw new Error("adm.openDocFail");
  return data.signedUrl;
}

export async function approveProvider(id: string): Promise<void> {
  const { error } = await supabase.rpc("admin_approve_provider", { target: id });
  if (error) throw msg(error, "adm.errApprove");
}

export async function rejectProvider(id: string, reason: string): Promise<void> {
  const trimmed = reason.trim();
  if (!trimmed) throw new Error("adm.errReasonRequired");
  const { error } = await supabase.rpc("admin_reject_provider", { target: id, reason: trimmed });
  if (error) throw msg(error, "adm.errReject");
}

export async function setAccountStatus(id: string, status: "active" | "suspended"): Promise<void> {
  const { error } = await supabase.rpc("admin_set_account_status", { target: id, new_status: status });
  if (error) throw msg(error, "adm.accountActionFail");
}

export async function cancelBooking(id: string, reason: string): Promise<void> {
  const { error } = await supabase.rpc("admin_cancel_booking", { target: id, reason: reason.trim() || null });
  if (error) throw msg(error, "adm.bookingActionFail");
}

export type AdminCustomer = {
  id: string; role: string; full_name: string | null; phone: string | null; city: string | null; created_at: string;
  account_status: "active" | "suspended";
};

export type AdminBooking = {
  id: string; customer_id: string; provider_id: string; provider_listing_id: number | null;
  service_category: string; service_date: string | null; location_text: string | null; status: string;
  rejection_reason: string | null; created_at: string; customer_name: string | null; provider_name: string | null;
};

export const ADMIN_PAGE_SIZE = 50;

export async function listCustomers(): Promise<{ rows: AdminCustomer[]; total: number }> {
  const { data, error, count } = await supabase.from("profiles")
    .select("id,role,full_name,phone,city,created_at,account_status", { count: "exact" })
    .order("created_at", { ascending: false }).limit(ADMIN_PAGE_SIZE);
  if (error) throw msg(error, "adm.loadCustomersFail");
  return { rows: (data ?? []) as AdminCustomer[], total: count ?? 0 };
}

export async function listBookings(): Promise<{ rows: AdminBooking[]; total: number }> {
  const { data, error, count } = await supabase.from("bookings")
    .select("id,customer_id,provider_id,provider_listing_id,service_category,service_date,location_text,status,rejection_reason,created_at,customer_name", { count: "exact" })
    .order("created_at", { ascending: false }).limit(ADMIN_PAGE_SIZE);
  if (error) throw msg(error, "adm.loadBookingsFail");
  const rows = (data ?? []) as Array<Omit<AdminBooking, "provider_name">>;
  if (!rows.length) return { rows: [], total: count ?? 0 };
  const ids = Array.from(new Set(rows.flatMap((r) => [r.customer_id, r.provider_id])));
  const { data: profs, error: perr } = await supabase.from("profiles").select("id,full_name").in("id", ids);
  if (perr) throw msg(perr, "adm.loadBookingsFail");
  const names = new Map<string, string | null>((profs ?? []).map((p) => [p.id as string, (p.full_name as string | null) ?? null]));
  return { rows: rows.map((r) => ({ ...r, customer_name: r.customer_name || names.get(r.customer_id) || null, provider_name: names.get(r.provider_id) ?? null })), total: count ?? 0 };
}
