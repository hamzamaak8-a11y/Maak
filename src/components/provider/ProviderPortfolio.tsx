import { useEffect, useState } from "react";
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
    return (
      <section className="mk-card mk-pd-section" aria-busy="true">
        <h2>{t("portfolio.publicTitle")}</h2>
        <div className="mk-portfolio-grid">
          {Array.from({ length: 3 }).map((_, index) => <span key={index} className="mk-skel" style={{ aspectRatio: "1", borderRadius: 12, display: "block" }} />)}
        </div>
      </section>
    );
  }
  if (images.length === 0) return null;

  return (
    <section className="mk-card mk-pd-section" aria-labelledby="portfolio-public-title">
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 10 }}>
        <h2 id="portfolio-public-title">{t("portfolio.publicTitle")}</h2>
        <span className="mk-results-count">{images.length}</span>
      </div>
      <div className="mk-portfolio-grid">
        {images.map((image) => (
          <a key={image.id} href={image.url} target="_blank" rel="noreferrer" aria-label={t("portfolio.imageAlt")}>
            <img src={image.url} alt={t("portfolio.imageAlt")} loading="lazy" />
          </a>
        ))}
      </div>
      <p style={{ fontSize: 12, color: "var(--mk-ink-4)" }}>{t("portfolio.privateNote")}</p>
    </section>
  );
}
