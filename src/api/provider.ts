import { supabase } from '../lib/supabase';
import type { Availability, ProviderDashboardStats, ProviderDocument, ProviderProfile, ProviderService } from '../types';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { PickedFile, uploadToBucket, validateFile } from '../lib/upload';
import { deleteDocumentWith } from '../lib/documentDelete';

const PROFILE_COLUMNS = 'id,profession,service_category,bio,experience_years,services,price_from,service_radius_km,profile_photo_public,verification_status,rejection_reason,created_at,updated_at';
const DOC_COLUMNS = 'id,provider_id,document_type,storage_path,status,created_at';

/* ----------------------------- application / onboarding ----------------------------- */

export async function fetchProviderProfile(userId: string): Promise<ProviderProfile | null> {
  const { data, error } = await supabase.from('provider_profiles').select(PROFILE_COLUMNS).eq('id', userId).maybeSingle();
  if (error) throw error;
  return (data as ProviderProfile) ?? null;
}

export async function ensureProviderDraft(userId: string): Promise<ProviderProfile> {
  const existing = await fetchProviderProfile(userId);
  if (existing) return existing;
  const { data, error } = await supabase.from('provider_profiles').insert({ id: userId, verification_status: 'draft' }).select(PROFILE_COLUMNS).single();
  if (error) {
    if (/duplicate|unique|23505/i.test(error.message)) {
      const again = await fetchProviderProfile(userId);
      if (again) return again;
    }
    throw error;
  }
  return data as ProviderProfile;
}

export type OnboardingInput = {
  fullName: string; phone: string; city: string; profession: string; category: string; bio: string;
  experienceYears: number | null; services: string[]; priceFrom: number | null; radiusKm: number | null;
};

export async function submitApplication(i: OnboardingInput): Promise<void> {
  const { error } = await supabase.rpc('submit_provider_onboarding', {
    p_full_name: i.fullName.trim(), p_phone: i.phone.trim(), p_city: i.city.trim(), p_profession: i.profession.trim(),
    p_service_category: i.category, p_bio: i.bio.trim(), p_experience_years: i.experienceYears,
    p_services: i.services.length ? i.services : null, p_price_from: i.priceFrom, p_service_radius_km: i.radiusKm,
  });
  if (error) throw error;
}

/* ----------------------------------- documents ----------------------------------- */

export type DocType = 'national_id' | 'profile_photo' | 'professional_document';
export const DOC_RULES: Record<DocType, { required: boolean; mime: string[] }> = {
  national_id: { required: true, mime: ['image/png', 'image/jpeg', 'application/pdf'] },
  profile_photo: { required: true, mime: ['image/png', 'image/jpeg'] },
  professional_document: { required: false, mime: ['image/png', 'image/jpeg', 'application/pdf'] },
};

export async function listMyDocuments(userId: string): Promise<ProviderDocument[]> {
  const { data, error } = await supabase.from('provider_documents').select(DOC_COLUMNS).eq('provider_id', userId).order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as ProviderDocument[];
}

export async function uploadDocument(userId: string, type: DocType, file: PickedFile): Promise<ProviderDocument> {
  validateFile(file, DOC_RULES[type].mime);
  const path = await uploadToBucket('provider-documents', userId, type, file);
  const { data, error } = await supabase.from('provider_documents').insert({ provider_id: userId, document_type: type, storage_path: path, status: 'pending' }).select(DOC_COLUMNS).single();
  if (error) {
    await supabase.storage.from('provider-documents').remove([path]);
    throw error;
  }
  return data as ProviderDocument;
}

const ORPHANS_KEY = 'maak.docs.orphans';

/** Files whose row is already gone but that could not be removed yet (offline, storage error); retried on the next visit. */
async function readOrphans(): Promise<string[]> {
  try { const v = JSON.parse((await AsyncStorage.getItem(ORPHANS_KEY)) ?? '[]'); return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : []; } catch { return []; }
}
export async function retryOrphanDocumentFiles(): Promise<void> {
  const list = await readOrphans();
  if (!list.length) return;
  const left: string[] = [];
  for (const path of list) {
    const { error } = await supabase.storage.from('provider-documents').remove([path]);
    if (error) left.push(path);
  }
  await (left.length ? AsyncStorage.setItem(ORPHANS_KEY, JSON.stringify(left)) : AsyncStorage.removeItem(ORPHANS_KEY)).catch(() => undefined);
}

/** Only a pending document can be deleted (approved and rejected ones are evidence; the database enforces the same). */
export async function deleteDocument(doc: ProviderDocument): Promise<void> {
  await deleteDocumentWith({
    deleteRow: async d => {
      const { data, error } = await supabase.from('provider_documents').delete().eq('id', d.id).eq('provider_id', d.provider_id).eq('status', 'pending').select('id');
      return { deleted: data?.length ?? 0, error };
    },
    removeFile: async path => ({ error: (await supabase.storage.from('provider-documents').remove([path])).error }),
    rememberOrphan: async path => { const l = await readOrphans(); if (!l.includes(path)) await AsyncStorage.setItem(ORPHANS_KEY, JSON.stringify([...l, path])).catch(() => undefined); },
  }, doc);
}

/* ------------------------------- marketplace profile ------------------------------- */

export async function updateMarketplaceProfile(input: { services: string[]; priceFrom: number | null; radiusKm: number | null; photoPublic: boolean }): Promise<void> {
  const { error } = await supabase.rpc('update_provider_marketplace_profile', {
    p_services: input.services, p_price_from: input.priceFrom, p_service_radius_km: input.radiusKm, p_profile_photo_public: input.photoPublic,
  });
  if (error) throw error;
}

export async function myListingId(): Promise<number | null> {
  const { data, error } = await supabase.rpc('get_my_provider_listing_id');
  if (error) throw error;
  return typeof data === 'number' ? data : null;
}

/* ------------------------------------ dashboard ------------------------------------ */

export async function fetchDashboardStats(): Promise<ProviderDashboardStats> {
  const { data, error } = await supabase.rpc('get_provider_dashboard_stats');
  if (error) throw error;
  return (data ?? { total_completed_bookings: 0, total_earnings: null, total_earnings_currency: null, average_rating: 0, total_reviews: 0, upcoming_bookings: [], recent_activity: [] }) as ProviderDashboardStats;
}

/* ------------------------------------ services ------------------------------------- */

export type ServiceInput = { name: string; description: string; price: number | null; currency: string; durationMinutes: number | null; isActive: boolean };

function serviceArgs(i: ServiceInput) {
  const name = i.name.trim();
  if (!name) throw new Error('err.generic');
  const currency = i.currency.trim().toUpperCase();
  if (!/^[A-Z]{3}$/.test(currency)) throw new Error('invalid_currency');
  if (i.price != null && (!Number.isFinite(i.price) || i.price < 0)) throw new Error('invalid_price');
  return { p_name: name, p_description: i.description.trim() || null, p_price: i.price, p_currency: currency, p_duration_minutes: i.durationMinutes, p_is_active: i.isActive };
}

export async function listMyServices(): Promise<ProviderService[]> {
  const { data, error } = await supabase.rpc('get_provider_services');
  if (error) throw error;
  return (data ?? []) as ProviderService[];
}

export async function addService(i: ServiceInput): Promise<ProviderService> {
  const { data, error } = await supabase.rpc('add_provider_service', serviceArgs(i));
  if (error) throw error;
  return data as ProviderService;
}

export async function updateService(id: string, i: ServiceInput): Promise<ProviderService> {
  const { data, error } = await supabase.rpc('update_provider_service', { p_service_id: id, ...serviceArgs(i) });
  if (error) throw error;
  return data as ProviderService;
}

export async function deleteService(id: string): Promise<void> {
  const { error } = await supabase.rpc('delete_provider_service', { p_service_id: id });
  if (error) throw error;
}

/* ---------------------------------- availability ----------------------------------- */

export async function saveAvailability(input: { listingId: number; day: number; start: string; end: string; enabled: boolean }): Promise<Availability> {
  const { data, error } = await supabase.rpc('set_provider_availability', {
    p_provider_id: input.listingId, p_day_of_week: input.day,
    p_start_time: input.enabled ? input.start : null, p_end_time: input.enabled ? input.end : null, p_is_available: input.enabled,
  });
  if (error) throw error;
  return data as Availability;
}

/* ------------------------------------ portfolio ------------------------------------ */

const PORTFOLIO_BUCKET = 'provider-portfolio';
const PORTFOLIO_MIME = ['image/jpeg', 'image/png', 'image/webp'];

export async function listMyPortfolio(userId: string): Promise<Array<{ path: string; url: string }>> {
  const { data, error } = await supabase.storage.from(PORTFOLIO_BUCKET).list(userId, { limit: 100, sortBy: { column: 'name', order: 'asc' } });
  if (error) throw error;
  const files = (data ?? []).filter(f => !!f.name && !!f.id);
  if (!files.length) return [];
  const paths = files.map(f => `${userId}/${f.name}`);
  const { data: signed, error: sErr } = await supabase.storage.from(PORTFOLIO_BUCKET).createSignedUrls(paths, 3600);
  if (sErr) throw sErr;
  return (signed ?? []).flatMap(s => (s.signedUrl && s.path ? [{ path: s.path, url: s.signedUrl }] : []));
}

export async function addPortfolioImage(userId: string, file: PickedFile): Promise<void> {
  validateFile(file, PORTFOLIO_MIME);
  await uploadToBucket(PORTFOLIO_BUCKET, userId, 'portfolio', file);
}

export async function deletePortfolioImage(path: string): Promise<void> {
  const { error } = await supabase.storage.from(PORTFOLIO_BUCKET).remove([path]);
  if (error) throw error;
}
