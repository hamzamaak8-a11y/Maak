import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getNotifications, markAllAsRead, markAsRead, subscribeToNotifications } from "../../lib/notifications";
import type { Notification, Role } from "../../types";
import { useAuth } from "../../auth";
import { useRouter } from "../../router";
import { useLanguage } from "../../i18n";
import NotificationToast from "./NotificationToast";
import "./notifications.css";

type NotificationContextValue = {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  markRead: (notificationId: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  refresh: () => Promise<void>;
  openNotification: (notification: Notification, role: Role) => Promise<void>;
};

const NotificationContext = createContext<NotificationContextValue | null>(null);

function notificationSort(rows: Notification[]): Notification[] {
  return [...rows].sort((a, b) => {
    const date = new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    return date || b.id.localeCompare(a.id);
  });
}

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user, role } = useAuth();
  const { navigate } = useRouter();
  const { t } = useLanguage();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<Notification | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setNotifications(notificationSort(await getNotifications()));
    } catch (err) {
      setError(err instanceof Error ? t(err.message) : t("notifications.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [t, user]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!user) return;
    let active = true;
    const cleanup = subscribeToNotifications(user.id, (notification) => {
      if (!active) return;
      setNotifications((current) => {
        if (current.some((item) => item.id === notification.id)) return current;
        return notificationSort([notification, ...current]);
      });
      setToast(notification);
    });
    return () => {
      active = false;
      cleanup();
    };
  }, [user]);

  const markRead = useCallback(async (notificationId: string) => {
    const updated = await markAsRead(notificationId);
    setNotifications((current) => current.map((item) => item.id === updated.id ? updated : item));
  }, []);

  const markAllRead = useCallback(async () => {
    await markAllAsRead();
    setNotifications((current) => current.map((item) => ({ ...item, is_read: true })));
  }, []);

  const openNotification = useCallback(async (notification: Notification, currentRole: Role) => {
    try {
      if (!notification.is_read) await markRead(notification.id);
    } catch {
      // Navigation remains useful even when marking read fails transiently.
    }

    const metadata = notification.metadata && typeof notification.metadata === "object" ? notification.metadata as Record<string, unknown> : {};
    const bookingId = typeof metadata.booking_id === "string" ? metadata.booking_id : null;
    const conversationId = typeof metadata.conversation_id === "string" ? metadata.conversation_id : null;

    if (conversationId) {
      navigate(`/chat/${conversationId}`);
      return;
    }
    if (currentRole === "provider" && (notification.type === "review_received" || bookingId)) {
      navigate("/provider-mode");
      return;
    }
    if (bookingId) {
      navigate("/bookings");
    }
  }, [markRead, navigate]);

  const value = useMemo<NotificationContextValue>(() => ({
    notifications,
    unreadCount: notifications.reduce((count, item) => count + (item.is_read ? 0 : 1), 0),
    loading,
    error,
    markRead,
    markAllRead,
    refresh,
    openNotification,
  }), [error, loading, markAllRead, markRead, notifications, openNotification, refresh]);

  return (
    <NotificationContext.Provider value={value}>
      {children}
      <NotificationToast notification={toast} onClose={() => setToast(null)} />
    </NotificationContext.Provider>
  );
}

export function useNotifications(): NotificationContextValue {
  const context = useContext(NotificationContext);
  if (!context) throw new Error("useNotifications must be used within <NotificationProvider>");
  return context;
}
