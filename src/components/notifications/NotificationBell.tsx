import { Bell } from "lucide-react";
import { useState } from "react";
import { useAuth } from "../../auth";
import { useNotifications } from "./NotificationProvider";
import NotificationDropdown from "./NotificationDropdown";

type Props = { compact?: boolean };

export default function NotificationBell({ compact = false }: Props) {
  const { user, role } = useAuth();
  const { notifications, unreadCount, loading, error, markRead, markAllRead, openNotification } = useNotifications();
  const [open, setOpen] = useState(false);
  if (!user) return null;

  return (
    <div className={`notification-bell-wrap${compact ? " compact" : ""}`}>
      <button
        type="button"
        className="icon-btn notification notification-bell"
        aria-label={unreadCount > 0 ? `Notifications (${unreadCount})` : "Notifications"}
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <Bell size={18} aria-hidden="true" />
        {unreadCount > 0 ? <span className="notification-badge">{unreadCount > 99 ? "99+" : unreadCount}</span> : null}
      </button>
      {open ? (
        <NotificationDropdown
          notifications={notifications}
          loading={loading}
          error={error}
          role={role}
          onRead={(notification) => { void openNotification(notification, role); }}
          onMarkAllRead={() => { void markAllRead(); }}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </div>
  );
}
