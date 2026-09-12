import { useEffect, useState } from "react";
import { ImageOff, Loader2 } from "lucide-react";
import { useLanguage } from "../../i18n";
import { getPortfolioImages, type PortfolioImage } from "../../lib/storage";

export default function ProviderPortfolio({ providerId }: { providerId: number }) {
  const { t } = useLanguage();
  const [images, setImages] = useState<PortfolioImage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void getPortfolioImages(providerId)
      .then((data) => { if (active) setImages(data); })
      .catch(() => { if (active) setImages([]); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [providerId]);

  if (loading) {
    return <section className="public-provider-section portfolio-section"><div className="portfolio-loading"><Loader2 className="spin" size={20} /><span>{t("portfolio.loading")}</span></div></section>;
  }
  if (images.length === 0) return null;

  return (
    <section className="public-provider-section portfolio-section">
      <div className="public-provider-review-title">
        <div><span className="section-kicker">{t("portfolio.tab")}</span><h2>{t("portfolio.publicTitle")}</h2></div>
        <span className="public-provider-review-summary">{images.length}</span>
      </div>
      <div className="portfolio-public-grid">
        {images.map((image) => <a className="portfolio-public-item" key={image.id} href={image.url} target="_blank" rel="noreferrer"><img src={image.url} alt={t("portfolio.imageAlt")} loading="lazy" /></a>)}
      </div>
      <div className="portfolio-note"><ImageOff size={14} /> <span>{t("portfolio.privateNote")}</span></div>
    </section>
  );
}
