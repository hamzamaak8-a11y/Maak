import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useLanguage } from "../../i18n";
import { getProviderReviews } from "../../lib/reviews";
import type { Review } from "../../types";
import StarRating from "./StarRating";
import "./reviews.css";

const PAGE_SIZE = 6;

type ReviewListProps = {
  providerId: string;
};

export default function ReviewList({ providerId }: ReviewListProps) {
  const { t, lang, dir } = useLanguage();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [average, setAverage] = useState(0);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const load = useCallback(async (nextOffset: number, append: boolean) => {
    if (!providerId) return;
    if (append) setLoadingMore(true);
    else setLoading(true);
    setErrorKey(null);
    try {
      const result = await getProviderReviews(providerId, PAGE_SIZE, nextOffset);
      setAverage(result.average_rating);
      setTotal(result.total_count);
      setReviews((current) => append ? [...current, ...result.reviews.filter((item) => !current.some((existing) => existing.id === item.id))] : result.reviews);
      setOffset(nextOffset + result.reviews.length);
    } catch (error) {
      setErrorKey(error instanceof Error ? error.message : "reviews.loadFailed");
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [providerId]);

  useEffect(() => { setReviews([]); setOffset(0); void load(0, false); }, [load]);

  const hasMore = reviews.length < total;
  const dateLocale = lang === "fr" ? "fr-FR" : "ar-MA";

  return (
    <section className="reviews-list" dir={dir} aria-labelledby="reviews-list-title">
      <div className="reviews-list-header">
        <div>
          <span className="reviews-kicker">{t("reviews.title")}</span>
          <h2 id="reviews-list-title">{t("reviews.total", { n: total })}</h2>
        </div>
        <div className="reviews-summary">
          <strong>{average.toFixed(1)}</strong>
          <StarRating value={average} readonly size={18} />
          <span>{t("reviews.average")}</span>
        </div>
      </div>

      {loading ? (
        <div className="reviews-state"><Loader2 className="spin" size={21} /> <span>{t("reviews.loading")}</span></div>
      ) : errorKey ? (
        <div className="reviews-state reviews-error" role="alert">{t(errorKey)}</div>
      ) : reviews.length === 0 ? (
        <div className="reviews-state"><span>{t("reviews.empty")}</span></div>
      ) : (
        <>
          <div className="reviews-items">
            {reviews.map((review) => (
              <article className="review-item" key={review.id}>
                <div className="review-item-top">
                  <StarRating value={review.rating} readonly size={17} />
                  <time dateTime={review.created_at}>{new Intl.DateTimeFormat(dateLocale, { dateStyle: "medium" }).format(new Date(review.created_at))}</time>
                </div>
                {review.comment ? <p>{review.comment}</p> : null}
              </article>
            ))}
          </div>
          {hasMore ? (
            <button type="button" className="reviews-load-more" onClick={() => void load(offset, true)} disabled={loadingMore}>
              {loadingMore ? <><Loader2 className="spin" size={15} /> {t("reviews.loading")}</> : t("reviews.loadMore")}
            </button>
          ) : null}
        </>
      )}
    </section>
  );
}
