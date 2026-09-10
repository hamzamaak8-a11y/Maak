import { MessageSquareQuote, Star } from "lucide-react";
import type { CustomerReview } from "../../lib/customer";
import { useLanguage } from "../../i18n";

type Props = { reviews: CustomerReview[] };

function formatDate(value: string, lang: string): string {
  try { return new Intl.DateTimeFormat(lang === "fr" ? "fr-FR" : "ar-MA", { dateStyle: "medium" }).format(new Date(value)); } catch { return value; }
}

export default function CustomerReviewHistory({ reviews }: Props) {
  const { t, lang } = useLanguage();
  return (
    <section className="customer-card" aria-labelledby="customer-reviews-heading">
      <div className="customer-card-head">
        <div><span className="section-kicker">{t("customer.feedbackKicker")}</span><h2 id="customer-reviews-heading">{t("customer.reviewsTitle")}</h2></div>
        <span className="count-badge">{reviews.length}</span>
      </div>
      {reviews.length === 0 ? <div className="customer-empty"><MessageSquareQuote size={23} /><h3>{t("customer.noReviews")}</h3><p>{t("customer.noReviewsBody")}</p></div> : (
        <div className="customer-review-list">
          {reviews.map((review) => (
            <article className="customer-review-item" key={review.id}>
              <div className="customer-review-head">
                <div><strong>{review.provider?.name || t("account.roleProvider")}</strong><time dateTime={review.created_at}>{formatDate(review.created_at, lang)}</time></div>
                <span className="customer-rating" aria-label={t("customer.ratingAria", { rating: review.rating })}>{Array.from({ length: 5 }, (_, index) => <Star key={index} size={14} fill={index < review.rating ? "currentColor" : "none"} />)}</span>
              </div>
              {review.comment ? <p>{review.comment}</p> : <p className="customer-review-muted">{t("customer.noComment")}</p>}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
