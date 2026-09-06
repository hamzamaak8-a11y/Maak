import { AlertCircle, ArrowLeft, Briefcase, ChevronLeft, Clock3, Loader2, MapPin, Search, ShieldCheck, Star, ThumbsUp, X } from "lucide-react";
import type { Category, Provider } from "../types";

import maakLockup from "../assets/brand/maak-lockup.png";
import maakSymbol from "../assets/brand/maak-symbol.png";
import { useLanguage } from "../i18n";

export function Logo({ inverse = false, size = "lg", variant = "mark" }: { inverse?: boolean; size?: "sm" | "md" | "lg"; variant?: "mark" | "lockup" }) {
  const src = variant === "lockup" ? maakLockup : maakSymbol;
  const cls = "brand brand-" + size + (variant === "lockup" ? " brand-lockup" : "") + (inverse ? " inverse" : "");
  return <img className={cls} src={src} alt="maak" />;
}

export function Avatar({ name, src }: { name: string; src?: string | null }) {
  const initial = (name || "?").trim().slice(0, 1);
  return src ? (
    <img className="avatar-img" src={src} alt={name} />
  ) : (
    <span className="avatar-init" aria-hidden={true}>{initial}</span>
  );
}

export function Rating({ value, reviews }: { value: string | null; reviews?: number | null }) {
  const { t } = useLanguage();
  const hasRating = value != null && value !== "" && Number(value) > 0;
  if (!hasRating) {
    return (
      <span className="rating new-rating">
        <Star size={13} fill="currentColor" />
        {t("common.new")}
      </span>
    );
  }
  return (
    <span className="rating">
      <Star size={13} fill="currentColor" />
      {value}
      {reviews && reviews > 0 ? <small>({reviews})</small> : null}
    </span>
  );
}

export function SearchBox({
  value,
  onChange,
  onSubmit,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: () => void;
  placeholder?: string;
}) {
  const { t } = useLanguage();
  return (
    <div className="search-box">
      <Search size={18} />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && onSubmit) onSubmit();
        }}
        placeholder={placeholder ?? t("discover.searchPlaceholder")}
        aria-label={t("discover.searchLabel")}
      />
      {value ? (
        <button className="clear-search" onClick={() => onChange("")} aria-label={t("discover.clearSearch")}>
          <X size={15} />
        </button>
      ) : null}
      <button className="search-submit" onClick={onSubmit} aria-label={t("discover.search")}>
        <ArrowLeft size={17} />
      </button>
    </div>
  );
}

export function TrustStrip() {
  const { t } = useLanguage();
  return (
    <div className="trust-strip">
      <div>
        <span className="trust-icon green">
          <ShieldCheck size={19} />
        </span>
        <span>
          <b>{t("atoms.trustVetted")}</b>
          <small>{t("atoms.trustVettedSub")}</small>
        </span>
      </div>
      <div>
        <span className="trust-icon blue">
          <Clock3 size={19} />
        </span>
        <span>
          <b>{t("atoms.trustFast")}</b>
          <small>{t("atoms.trustFastSub")}</small>
        </span>
      </div>
      <div>
        <span className="trust-icon orange">
          <ThumbsUp size={19} />
        </span>
        <span>
          <b>{t("atoms.trustGuarantee")}</b>
          <small>{t("atoms.trustGuaranteeSub")}</small>
        </span>
      </div>
    </div>
  );
}

export function CategoryCard({
  category,
  active = false,
  onClick,
}: {
  category: Category;
  active?: boolean;
  onClick: () => void;
}) {
  const Icon = category.icon;
  return (
    <button className={"category-card" + (active ? " active" : "")} onClick={onClick}>
      <span className="category-icon">
        <Icon size={20} />
      </span>
      <b>{category.name}</b>
      <small>{category.count}</small>
    </button>
  );
}

export function CategoryChip({
  category,
  active = false,
  onClick,
}: {
  category: Category;
  active?: boolean;
  onClick: () => void;
}) {
  const Icon = category.icon;
  return (
    <button
      className={"category-chip" + (active ? " active" : "")}
      onClick={onClick}
      aria-pressed={active}
    >
      <span className="chip-icon">
        <Icon size={18} />
      </span>
      <span className="chip-text">
        <b>{category.name}</b>
        {category.count ? <small>{category.count}</small> : null}
      </span>
    </button>
  );
}

export function ServiceChip({
  label,
  active = false,
  onClick,
}: {
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className={"service-chip" + (active ? " active" : "")}
      onClick={onClick}
      aria-pressed={active}
    >
      {label}
    </button>
  );
}

export function ProviderSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="provider-skeleton" aria-busy="true" aria-live="polite">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="skeleton-row">
          <span className="sk-avatar" />
          <span className="sk-lines">
            <span className="sk-line w60" />
            <span className="sk-line w80" />
            <span className="sk-line w40" />
          </span>
        </div>
      ))}
    </div>
  );
}

export function ProviderRow({
  provider,
  onClick,
}: {
  provider: Provider;
  onClick: () => void;
}) {
  const { t } = useLanguage();
  const shownServices = provider.services.slice(0, 3);
  const extraCount = provider.services.length - shownServices.length;
  const availability =
    provider.available === true
      ? t("filters.availableNow")
      : provider.available === false
        ? t("provider.unavailable")
        : "";
  return (
    <button className="provider-row" onClick={onClick}>
      <div className="provider-avatar-wrap">
        <Avatar name={provider.name} src={provider.image} />
        {provider.available != null ? (
          <span className={provider.available ? "online" : "offline"} />
        ) : null}
      </div>
      <div className="provider-info">
        <div className="provider-title">
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <h3>{provider.name}</h3>
            <Rating value={provider.rating} reviews={provider.reviews} />
          </div>
          <ChevronLeft size={16} className="provider-chevron" />
        </div>
        <p>{provider.job}</p>
        <div className="provider-meta">
          {provider.city ? (
            <span>
              <MapPin size={12} /> {provider.city}
            </span>
          ) : null}
          {provider.experience ? (
            <span>
              <Briefcase size={12} /> {provider.experience}
            </span>
          ) : null}
          {provider.distance ? <span>{provider.distance}</span> : null}
          {availability ? (
            <span className={provider.available ? "meta-avail" : "meta-off"}>
              {availability}
            </span>
          ) : null}
        </div>
        {shownServices.length > 0 ? (
          <div className="provider-services">
            {shownServices.map((service) => (
              <span key={service} className="service-mini">{t(service)}</span>
            ))}
            {extraCount > 0 ? <span className="service-mini more">+{extraCount}</span> : null}
          </div>
        ) : null}
      </div>
      <div className="provider-action">
        {provider.price ? <b className="provider-price">{provider.price}</b> : null}
        <span className="provider-cta">{t("provider.cta")}</span>
      </div>
    </button>
  );
}

export function StateCard({
  variant,
  actionLabel,
  onAction,
  emptyTitle,
  emptyBody,
}: {
  variant: "loading" | "empty" | "error";
  actionLabel?: string;
  onAction?: () => void;
  emptyTitle?: string;
  emptyBody?: string;
}) {
  const { t } = useLanguage();
  if (variant === "loading") {
    return (
      <div className="state-card loading">
        <span className="state-ico">
          <Loader2 size={24} className="spin" />
        </span>
        <p>{t("atoms.loadingProviders")}</p>
      </div>
    );
  }
  if (variant === "error") {
    return (
      <div className="state-card">
        <span className="state-ico">
          <AlertCircle size={24} />
        </span>
        <h3>{t("atoms.loadFail")}</h3>
        <p>{t("atoms.loadFailSub")}</p>
        {actionLabel && onAction ? (
          <button className="text-button state-action" onClick={onAction}>
            {actionLabel}
          </button>
        ) : null}
      </div>
    );
  }
  return (
    <div className="state-card">
      <span className="state-ico">
        <Search size={24} />
      </span>
      <h3>{emptyTitle ?? t("discover.noResults")}</h3>
      <p>{emptyBody ?? t("discover.noResultsBody")}</p>
      {actionLabel && onAction ? (
        <button className="text-button state-action" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
