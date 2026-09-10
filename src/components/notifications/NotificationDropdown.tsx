import type { Notification, Role } from "../../types";
import { useLanguage } from "../../i18n";

type Props = {
  notifications: Notification[];
  loading: boolean;
  error: string | null;
  role: Role;
  onRead: (notification: Notification) => void;
  onMarkAllRead: () => void;
  onClose: () => void;
};

function formatDate(value: string, lang: string): string {
  return new Intl.DateTimeFormat(lang === "fr" ? "fr-FR" : "ar-MA", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

export default function NotificationDropdown({ notifications, loading, error, role, onRead, onMarkAllRead, onClose }: Props) {
  const { t, dir, lang } = useLanguage();
  const unread = notifications.some((item) => !item.is_read);

  return (
    <section className="notification-dropdown" dir={dir} role="dialog" aria-label={t("notifications.title")}>
      <header className="notification-dropdown-head">
        <div>
          <span className="notification-kicker">{t("notifications.kicker")}</span>
          <h2>{t("notifications.title")}</h2>
        </div>
        {unread ? <button type="button" className="notification-mark-all" onClick={onMarkAllRead}>{t("notifications.markAllRead")}</button> : null}
      </header>

      <div className="notification-list">
        {loading ? <div className="notification-state">{t("notifications.loading")}</div> : error ? <div className="notification-state error">{t(error)}</div> : notifications.length === 0 ? <div className="notification-state">{t("notifications.empty")}</div> : notifications.slice(0, 50).map((notification) => (
          <button
            type="button"
            key={notification.id}
            className={`notification-item${notification.is_read ? " read" : " unread"}`}
            onClick={() => { onRead(notification); onClose(); }}
          >
            <span className="notification-dot" aria-hidden="true" />
            <span className="notification-item-copy">
              <strong>{t(notification.title)}</strong>
              <span>{t(notification.body)}</span>
              <time dateTime={notification.created_at}>{formatDate(notification.created_at, lang)}</time>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}
