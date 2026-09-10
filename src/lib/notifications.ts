import { supabase } from "./supabaseClient";
import type { Notification } from "../types";

type RpcError = { message?: unknown; code?: unknown };

function mapNotificationError(error: unknown, fallback: string): Error {
  const source = error as RpcError;
  const message = typeof source?.message === "string" ? source.message : "";
  const keys: Record<string, string> = {
    forbidden: "notifications.forbidden",
    notification_not_found: "notifications.notFound",
  };
  const mapped = new Error(keys[message] ?? keys[String(source?.code)] ?? fallback);
  const enriched = mapped as Error & { cause?: unknown };
  enriched.cause = error;
  return mapped;
}

/** Loads the current user's newest notifications through the protected RPC. */
export async function getNotifications(limit = 50, offset = 0): Promise<Notification[]> {
  const { data, error } = await supabase.rpc("get_my_notifications", {
    p_limit: limit,
    p_offset: offset,
  });
  if (error) throw mapNotificationError(error, "notifications.loadFailed");
  return Array.isArray(data) ? (data as Notification[]) : [];
}

/** Marks one notification as read. The database verifies ownership. */
export async function markAsRead(notificationId: string): Promise<Notification> {
  const { data, error } = await supabase.rpc("mark_notification_read", {
    p_notification_id: notificationId,
  });
  if (error) throw mapNotificationError(error, "notifications.updateFailed");
  return data as Notification;
}

/** Marks every unread notification belonging to the current user as read. */
export async function markAllAsRead(): Promise<number> {
  const { data, error } = await supabase.rpc("mark_all_notifications_read");
  if (error) throw mapNotificationError(error, "notifications.updateFailed");
  return Number(data ?? 0);
}

/** Subscribes to inserts for the current user's notification rows. */
export function subscribeToNotifications(userId: string, onInsert: (notification: Notification) => void): () => void {
  const channel = supabase
    .channel(`user:${userId}:notifications`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "notifications",
        filter: `user_id=eq.${userId}`,
      },
      (payload) => onInsert(payload.new as Notification),
    )
    .subscribe();

  return () => {
    void supabase.removeChannel(channel);
  };
}
