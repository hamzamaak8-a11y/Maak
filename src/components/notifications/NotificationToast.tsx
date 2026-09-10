import type { Notification } from "../../types";
import { useLanguage } from "../../i18n";

type Props = {
  notification: Notification | null;
  onClose: () => void;
};

export default function NotificationToast({ notification, onClose }: Props) {
  const { t, dir } = useLanguage();
  if (!notification) return null;

  return (
    <aside className="notification-toast" role="status" dir={dir} aria-live="polite">
      <div>
        <strong>{t(notification.title)}</strong>
        <p>{t(notification.body)}</p>
      </div>
      <button type="button" onClick={onClose} aria-label={t("notifications.close")}>×</button>
    </aside>
  );
}
