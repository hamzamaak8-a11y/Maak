import { useEffect, useRef, useState } from "react";
import type { ChangeEvent } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { useAuth } from "../../auth";
import { useToast } from "../../context";
import { useLanguage } from "../../i18n";
import { deletePortfolioImage, getPortfolioImages, uploadPortfolioImage, type PortfolioImage } from "../../lib/storage";

const ACCEPT = "image/jpeg,image/png,image/webp";

export default function PortfolioManager() {
  const { t } = useLanguage();
  const { showToast } = useToast();
  const { user } = useAuth();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [images, setImages] = useState<PortfolioImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    if (!user) {
      setImages([]);
      setLoading(false);
      return () => { active = false; };
    }
    setLoading(true);
    void getPortfolioImages(user.id)
      .then((data) => { if (active) setImages(data); })
      .catch((error) => { if (active) showToast(t(error instanceof Error ? error.message : "portfolio.loadFail")); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [showToast, t, user]);

  async function onUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const image = await uploadPortfolioImage(file);
      setImages((current) => [...current, image].sort((a, b) => a.path.localeCompare(b.path)));
      showToast(t("portfolio.uploaded"));
    } catch (error) {
      showToast(t(error instanceof Error ? error.message : "portfolio.uploadFail"));
    } finally {
      setUploading(false);
    }
  }

  async function remove(image: PortfolioImage) {
    if (!window.confirm(t("portfolio.deleteConfirm"))) return;
    setDeleting(image.id);
    try {
      await deletePortfolioImage(image.id);
      setImages((current) => current.filter((item) => item.id !== image.id));
      showToast(t("portfolio.deleted"));
    } catch (error) {
      showToast(t(error instanceof Error ? error.message : "portfolio.deleteFail"));
    } finally {
      setDeleting(null);
    }
  }

  return (
    <section className="provider-portfolio-manager">
      <div className="admin-top">
        <div>
          <span className="section-kicker">{t("portfolio.tab")}</span>
          <h1>{t("portfolio.title")}</h1>
          <p className="onb-step-sub">{t("portfolio.subtitle")}</p>
        </div>
        <div>
          <button className="primary" type="button" disabled={uploading} onClick={() => inputRef.current?.click()}>
            {uploading ? <Loader2 className="spin" size={16} /> : <ImagePlus size={16} />}
            {uploading ? t("portfolio.uploading") : t("portfolio.add")}
          </button>
          <input ref={inputRef} type="file" accept={ACCEPT} hidden onChange={(event) => void onUpload(event)} />
        </div>
      </div>

      {loading ? <div className="empty-state"><Loader2 className="spin" size={20} /><p>{t("portfolio.loading")}</p></div> : images.length === 0 ? (
        <div className="empty-state"><ImagePlus size={24} /><h3>{t("portfolio.empty")}</h3><p>{t("portfolio.emptyHint")}</p></div>
      ) : (
        <div className="portfolio-grid">
          {images.map((image) => (
            <figure className="portfolio-card" key={image.id}>
              <img src={image.url} alt="" loading="lazy" />
              <figcaption>
                <span>{image.content_type?.split("/")[1]?.toUpperCase() ?? "IMAGE"}</span>
                <button className="secondary" type="button" disabled={deleting === image.id} onClick={() => void remove(image)}>
                  {deleting === image.id ? <Loader2 className="spin" size={15} /> : <Trash2 size={15} />}
                  {t("portfolio.delete")}
                </button>
              </figcaption>
            </figure>
          ))}
        </div>
      )}
    </section>
  );
}
