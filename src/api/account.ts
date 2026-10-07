import { supabase } from '../lib/supabase';
import { listMyBookings } from './bookings';

const BUCKETS = ['provider-documents', 'provider-portfolio'];

/**
 * Permanently deletes the signed-in user's account.
 * 1. refuse while a booking is still open (the database re-checks this);
 * 2. remove the user's uploaded files through the Storage API (best effort — a failure here must not trap the user);
 * 3. call delete_my_account(), which deletes the Auth user and everything that cascades from it.
 */
export async function deleteMyAccount(userId: string): Promise<void> {
  const open = (await listMyBookings()).some(b => ['pending', 'accepted', 'in_progress'].includes(b.status));
  if (open) throw new Error('active_bookings');

  for (const bucket of BUCKETS) {
    try {
      const { data } = await supabase.storage.from(bucket).list(userId, { limit: 1000 });
      const paths = (data ?? []).filter(f => !!f.name).map(f => `${userId}/${f.name}`);
      if (paths.length) await supabase.storage.from(bucket).remove(paths);
    } catch {
      /* best effort */
    }
  }

  const { error } = await supabase.rpc('delete_my_account');
  if (error) throw error;
}
