import { Sparkles } from "lucide-react";
import { useLanguage } from "../../i18n";

export default function FeaturedBadge() {
  const { t } = useLanguage();
  return (
    <span className="featured-badge" title={t("featured.badge")} aria-label={t("featured.badge")}>
      <Sparkles size={12} aria-hidden="true" />
      {t("featured.badge")}
    </span>
  );
}
