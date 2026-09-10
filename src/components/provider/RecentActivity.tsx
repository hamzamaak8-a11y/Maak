import { Bell, CheckCircle2, Clock3, MessageCircle, Star } from "lucide-react";
import type { ProviderRecentActivityItem } from "../../types";

type RecentActivityProps = {
  items: ProviderRecentActivityItem[];
  kicker: string;
  title: string;
  empty: string;
  formatDate: (value: string) => string;
  translateNotification: (item: ProviderRecentActivityItem) => { title: string; body: string };
};

function ActivityIcon({ type }: { type: string }) {
  if (type === "new_message") return <MessageCircle size={17} aria-hidden="true" />;
  if (type === "review_received") return <Star size={17} aria-hidden="true" />;
  if (type.startsWith("booking_")) return <CheckCircle2 size={17} aria-hidden="true" />;
  return <Clock3 size={17} aria-hidden="true" />;
}

export default function RecentActivity({ items, kicker, title, empty, formatDate, translateNotification }: RecentActivityProps) {
  return (
    <section className="provider-panel provider-activity-panel">
      <div className="provider-panel-heading">
        <div>
          <span className="section-kicker">{kicker}</span>
          <h2>{title}</h2>
        </div>
        <Bell size={20} aria-hidden="true" />
      </div>

      {items.length === 0 ? (
        <div className="provider-panel-empty"><Bell size={24} aria-hidden="true" /><span>{empty}</span></div>
      ) : (
        <div className="provider-activity-list">
          {items.map((item) => {
            const copy = translateNotification(item);
            return (
              <article className={`provider-activity-item${item.is_read ? "" : " unread"}`} key={item.id}>
                <span className="provider-activity-icon"><ActivityIcon type={item.type} /></span>
                <div>
                  <h3>{copy.title}</h3>
                  <p>{copy.body}</p>
                  <time dateTime={item.created_at}>{formatDate(item.created_at)}</time>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
