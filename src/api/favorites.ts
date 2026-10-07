import { supabase } from '../lib/supabase';

export async function listFavoriteIds(userId: string): Promise<number[]> {
  const { data, error } = await supabase.from('customer_favorites').select('provider_listing_id').eq('customer_id', userId);
  if (error) throw error;
  return (data ?? []).map(r => Number((r as { provider_listing_id: number }).provider_listing_id));
}

export async function addFavorite(userId: string, listingId: number): Promise<void> {
  const { error } = await supabase.from('customer_favorites').insert({ customer_id: userId, provider_listing_id: listingId });
  if (error && error.code !== '23505') throw error;
}

export async function removeFavorite(userId: string, listingId: number): Promise<void> {
  const { error } = await supabase.from('customer_favorites').delete().eq('customer_id', userId).eq('provider_listing_id', listingId);
  if (error) throw error;
}
