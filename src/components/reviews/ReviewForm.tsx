import { useState } from "react";
import { Loader2, X } from "lucide-react";
import { useLanguage } from "../../i18n";
import { submitReview } from "../../lib/reviews";
import type { Review } from "../../types";
import StarRating from "./StarRating";
import "./reviews.css";

type ReviewFormProps = {
  bookingId: string;
  onClose: () => void;
  onSubmitted?: (review: Review) => void;
};

export default function ReviewForm({ bookingId, onClose, onSubmitted }: ReviewFormProps) {
  const { t, dir } = useLanguage();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [errorKey, setErrorKey] = useState<string | null>(null);

  const handleSubmit = async () => {
    if (rating < 1) {
      setErrorKey("reviews.required");
      return;
    }
    if (comment.length > 1000) {
      setErrorKey("reviews.commentTooLong");
      return;
    }
    setErrorKey(null);
    setBusy(true);
    try {
      const review = await submitReview(bookingId, rating, comment.trim() || null);
      onSubmitted?.(review);
      onClose();
    } catch (error) {
      setErrorKey(error instanceof Error ? error.message : "reviews.submitFailed");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="reviews-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="reviews-modal" role="dialog" aria-modal="true" aria-labelledby="review-form-title" dir={dir}>
        <div className="reviews-modal-header">
          <div>
            <span className="reviews-kicker">{t("reviews.serviceRating")}</span>
            <h2 id="review-form-title">{t("reviews.title")}</h2>
          </div>
          <button type="button" className="reviews-icon-button" onClick={onClose} aria-label={t("reviews.close")} disabled={busy}>
            <X size={18} />
          </button>
        </div>

        <div className="reviews-form-section">
          <label>{t("reviews.ratingLabel")}</label>
          <StarRating value={rating} onChange={setRating} />
        </div>

        <div className="reviews-form-section">
          <label htmlFor="review-comment">{t("reviews.commentLabel")}</label>
          <textarea
            id="review-comment"
            value={comment}
            maxLength={1000}
            onChange={(event) => { setComment(event.target.value); setErrorKey(null); }}
            placeholder={t("reviews.commentPlaceholder")}
            rows={5}
          />
          <small className="reviews-counter">{comment.length}/1000</small>
        </div>

        {errorKey ? <div className="reviews-error" role="alert">{t(errorKey)}</div> : null}

        <div className="reviews-form-actions">
          <button type="button" className="reviews-button secondary" onClick={onClose} disabled={busy}>{t("reviews.cancel")}</button>
          <button type="button" className="reviews-button primary" onClick={() => void handleSubmit()} disabled={busy}>
            {busy ? <><Loader2 size={15} className="spin" /> {t("reviews.submitting")}</> : t("reviews.submit")}
          </button>
        </div>
      </section>
    </div>
  );
}
