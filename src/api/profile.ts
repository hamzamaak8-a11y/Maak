import { supabase } from '../lib/supabase';
import type { Profile } from '../types';

const COLUMNS = 'id, role, full_name, phone, city, avatar_url, account_status, created_at, updated_at';

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from('profiles').select(COLUMNS).eq('id', userId).maybeSingle();
  if (error) throw error;
  return (data as Profile) ?? null;
}

export async function updateProfile(userId: string, patch: { full_name: string; phone: string; city: string }): Promise<Profile> {
  const { data, error } = await supabase
    .from('profiles')
    .update({ full_name: patch.full_name.trim() || null, phone: patch.phone.trim() || null, city: patch.city.trim() || null })
    .eq('id', userId)
    .select(COLUMNS)
    .single();
  if (error) throw error;
  return data as Profile;
}

export async function updateAvatar(userId: string, url: string | null): Promise<void> {
  const { error } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', userId);
  if (error) throw error;
}
