import { supabase } from '../lib/supabase';
import { createRealtimeHub, type HubClient } from '../lib/realtimeHub';
import type { AppNotification } from '../types';

export async function listNotifications(limit = 50, offset = 0): Promise<AppNotification[]> {
  const { data, error } = await supabase.rpc('get_my_notifications', { p_limit: limit, p_offset: offset });
  if (error) throw error;
  return Array.isArray(data) ? (data as AppNotification[]) : [];
}

export async function markNotificationRead(id: string): Promise<void> {
  const { error } = await supabase.rpc('mark_notification_read', { p_notification_id: id });
  if (error) throw error;
}

export async function markAllNotificationsRead(): Promise<void> {
  const { error } = await supabase.rpc('mark_all_notifications_read');
  if (error) throw error;
}

const subscribe = createRealtimeHub(supabase as unknown as HubClient);

export function subscribeToNotifications(userId: string, onInsert: (n: AppNotification) => void): () => void {
  return subscribe<AppNotification>(`user:${userId}:notifications`, { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, onInsert);
}
