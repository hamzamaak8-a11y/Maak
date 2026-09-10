import { useCallback, useEffect, useState } from "react";
import { CalendarCheck2, CheckCircle2, Coins, RefreshCw } from "lucide-react";
import { useLanguage } from "../../i18n";
import { fetchProviderDashboardStats } from "../../lib/provider";
import type { ProviderDashboardStats, ProviderRecentActivityItem, UpcomingProviderBooking } from "../../types";
import StatCard from "./StatCard";
import RatingCard from "./RatingCard";
import UpcomingSchedule from "./UpcomingSchedule";
import RecentActivity from "./RecentActivity";
import "./provider-dashboard.css";

type Props = { providerName: string };

const EMPTY_STATS: ProviderDashboardStats = {
  total_completed_bookings: 0,
  total_earnings: null,
  average_rating: 0,
  total_reviews: 0,
  upcoming_bookings: [],
  recent_activity: [],
};

function formatDate(value: string, lang: string, options?: Intl.DateTimeFormatOptions) {
  try {
    return new Intl.DateTimeFormat(lang === "fr" ? "fr-FR" : "ar-MA", options ?? { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
  } catch {
    return value;
  }
}

export default function ProviderDashboard({ providerName }: Props) {
  const { t, lang } = useLanguage();
  const [stats, setStats] = useState<ProviderDashboardStats>(EMPTY_STATS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setStats(await fetchProviderDashboardStats());
    } catch (err) {
      const message = err instanceof Error ? err.message : "providerDashboard.loadFailed";
      setError(message.startsWith("providerDashboard.") ? message : "providerDashboard.loadFailed");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const translateNotification = (item: ProviderRecentActivityItem) => ({
    title: t(item.title),
    body: t(item.body),
  });

  if (loading && stats === EMPTY_STATS) {
    return (
      <div className="provider-dashboard" aria-busy="true">
        <div className="provider-dashboard-head">
          <div>
            <span className="section-kicker">{t("providerDashboard.kicker")}</span>
            <h1>{t("providerDashboard.title")}</h1>
            <p className="provider-dashboard-subtitle">{t("providerDashboard.subtitle", { name: providerName })}</p>
          </div>
        </div>
        <div className="empty-state"><p>{t("providerDashboard.loading")}</p></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="provider-dashboard">
        <div className="provider-dashboard-head">
          <div>
            <span className="section-kicker">{t("providerDashboard.kicker")}</span>
            <h1>{t("providerDashboard.title")}</h1>
          </div>
          <button className="ghost-button provider-dashboard-refresh" onClick={() => void load()}>
            <RefreshCw size={15} aria-hidden="true" /> {t("providerDashboard.retry")}
          </button>
        </div>
        <div className="empty-state"><p>{t(error)}</p></div>
      </div>
    );
  }

  const upcoming = stats.upcoming_bookings as UpcomingProviderBooking[];

  return (
    <div className="provider-dashboard">
      <div className="provider-dashboard-head">
        <div>
          <span className="section-kicker">{t("providerDashboard.kicker")}</span>
          <h1>{t("providerDashboard.title")}</h1>
          <p className="provider-dashboard-subtitle">{providerName} · {t("providerDashboard.subtitle")}</p>
        </div>
        <button className="ghost-button provider-dashboard-refresh" onClick={() => void load()} disabled={loading}>
          <RefreshCw size={15} className={loading ? "spin" : ""} aria-hidden="true" /> {t("providerDashboard.refresh")}
        </button>
      </div>

      <div className="provider-dashboard-stats">
        <StatCard
          label={t("providerDashboard.completed")}
          value={stats.total_completed_bookings}
          hint={t("providerDashboard.completedHint")}
          icon={CheckCircle2}
        />
        <StatCard
          label={t("providerDashboard.earnings")}
          value={stats.total_earnings == null ? "—" : stats.total_earnings}
          hint={stats.total_earnings == null ? t("providerDashboard.earningsUnavailable") : undefined}
          icon={Coins}
        />
        <RatingCard
          average={stats.average_rating}
          totalReviews={stats.total_reviews}
          label={t("providerDashboard.rating")}
          reviewsLabel={t("providerDashboard.reviews")}
        />
        <StatCard
          label={t("providerDashboard.upcoming")}
          value={stats.upcoming_bookings.length}
          hint={t("providerDashboard.scheduleKicker")}
          icon={CalendarCheck2}
        />
      </div>

      <div className="provider-dashboard-grid">
        <UpcomingSchedule
          bookings={upcoming}
          title={t("providerDashboard.upcoming")}
          serviceLabel={t("providerDashboard.scheduleKicker")}
          empty={t("providerDashboard.upcomingEmpty")}
          serviceLabel={t("providerDashboard.service")}
          statusLabel={(status) => t(`status.${status}`)}
          formatDate={(value) => formatDate(value, lang)}
          locationLabel={t("providerDashboard.location")}
          customerLabel={t("providerDashboard.customer")}
        />
        <RecentActivity
          items={stats.recent_activity}
          kicker={t("providerDashboard.kicker")}
          title={t("providerDashboard.activity")}
          empty={t("providerDashboard.activityEmpty")}
          formatDate={(value) => formatDate(value, lang)}
          translateNotification={translateNotification}
        />
      </div>
    </div>
  );
}
