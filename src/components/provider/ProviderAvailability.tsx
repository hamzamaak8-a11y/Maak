import { CalendarCheck2, CircleOff } from "lucide-react";
import type { Provider } from "../../types";
import { useLanguage } from "../../i18n";

type Props = { provider: Provider };

export default function ProviderAvailability({ provider }: Props) {
  const { t } = useLanguage();
  const available = provider.available === true;
  const known = provider.available != null;

  return (
    <section className={`public-provider-section public-provider-availability ${available ? "is-available" : "is-unknown"}`} aria-labelledby="provider-availability-title">
      <span className="section-kicker">{t("pd.availabilityTitle")}</span>
      <h2 id="provider-availability-title">{known && available ? t("pd.availableToday") : t("pd.availableWeek")}</h2>
      <div className="public-availability-line">
        {known && available ? <CalendarCheck2 size={18} /> : <CircleOff size={18} />}
        <span>{known && available ? t("pd.checkAvailability") : t("pd.notAvailableNow")}</span>
      </div>
    </section>
  );
}
