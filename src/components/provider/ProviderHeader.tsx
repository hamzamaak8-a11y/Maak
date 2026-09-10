import { Clock3, MapPin, ShieldCheck, Star } from "lucide-react";
import type { Provider } from "../../types";
import { Avatar } from "../atoms";
import { useLanguage } from "../../i18n";

type Props = {
  provider: Provider;
  rating: number;
  reviewCount: number;
};

export default function ProviderHeader({ provider, rating, reviewCount }: Props) {
  const { t } = useLanguage();
  const hasRating = reviewCount > 0 && rating > 0;

  return (
    <section className="public-provider-header" aria-labelledby="public-provider-name">
      <div className="public-provider-avatar">
        <Avatar name={provider.name} src={provider.image} />
        {provider.available != null ? <span className={`public-provider-status ${provider.available ? "is-online" : "is-offline"}`} aria-hidden="true" /> : null}
      </div>
      <div className="public-provider-main">
        <div className="public-provider-badges">
          <span className="public-provider-verified"><ShieldCheck size={13} /> {t("pd.verifiedProvider")}</span>
        </div>
        <h1 id="public-provider-name">{provider.name}</h1>
        <p className="public-provider-job">{provider.job}</p>
        <div className="public-provider-meta">
          <span><MapPin size={14} /> {provider.city}</span>
          {provider.experience ? <span><Clock3 size={14} /> {provider.experience} {t("pd.experience")}</span> : null}
          <span className={hasRating ? "has-rating" : "no-rating"}>
            <Star size={14} fill="currentColor" />
            {hasRating ? t("pd.ratingCount", { rating: rating.toFixed(1), n: reviewCount }) : t("pd.noRating")}
          </span>
        </div>
      </div>
    </section>
  );
}
