import { Star } from "lucide-react";

type RatingCardProps = {
  average: number;
  totalReviews: number;
  label: string;
  reviewsLabel: string;
};

export default function RatingCard({ average, totalReviews, label, reviewsLabel }: RatingCardProps) {
  const normalized = Math.max(0, Math.min(5, average));
  return (
    <article className="provider-rating-card">
      <div>
        <span className="provider-card-kicker">{label}</span>
        <strong className="provider-rating-value">{normalized.toFixed(1)}</strong>
      </div>
      <div className="provider-stars" aria-label={`${normalized.toFixed(1)} / 5`}>
        {[1, 2, 3, 4, 5].map((star) => (
          <Star key={star} size={18} fill={star <= Math.round(normalized) ? "currentColor" : "none"} aria-hidden="true" />
        ))}
      </div>
      <small>{totalReviews} {reviewsLabel}</small>
    </article>
  );
}
