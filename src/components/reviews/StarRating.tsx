import { useId } from "react";
import { useLanguage } from "../../i18n";
import "./reviews.css";

type StarRatingProps = {
  value: number;
  onChange?: (value: number) => void;
  readonly?: boolean;
  size?: number;
};

export default function StarRating({ value, onChange, readonly = false, size = 24 }: StarRatingProps) {
  const { t, dir } = useLanguage();
  const groupId = useId();
  const safeValue = Math.max(0, Math.min(5, Math.round(value)));

  return (
    <div className="review-stars" dir={dir} aria-label={`${t("reviews.ratingLabel")}: ${safeValue}/5`}>
      {Array.from({ length: 5 }, (_, index) => {
        const star = index + 1;
        const active = star <= safeValue;
        if (readonly || !onChange) {
          return (
            <span key={`${groupId}-${star}`} className={`review-star ${active ? "active" : ""}`} aria-hidden="true" style={{ fontSize: size }}>
              ★
            </span>
          );
        }
        return (
          <button
            key={`${groupId}-${star}`}
            type="button"
            className={`review-star review-star-button ${active ? "active" : ""}`}
            style={{ fontSize: size }}
            onClick={() => onChange(star)}
            aria-label={`${star}/5`}
            aria-pressed={active}
          >
            ★
          </button>
        );
      })}
    </div>
  );
}
