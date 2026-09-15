import { ChevronRight, CloudOff, MapPin, Search, ShieldCheck, Star, X } from "lucide-react";
import type { Category, Provider } from "../types";

import maakLockupLight from "../assets/brand/maak-lockup-light.webp";
import maakLockupDark from "../assets/brand/maak-lockup-dark.webp";
import maakSymbol from "../assets/brand/maak-icon.webp";
import { useLanguage } from "../i18n";
import { MaakMark } from "./BrandMark";

/**
 * Legacy logo (raster lockups) — retained for the admin surfaces which keep
 * the previous identity. The consumer app renders the inline `MaakMark`
 * system from BrandMark.tsx instead.
 */
export function Logo({ inverse = false, size = "lg", variant = "mark" }: { inverse?: boolean; size?: "sm" | "md" | "lg"; variant?: "mark" | "lockup" }) {
  const src = variant === "lockup" ? (inverse ? maakLockupDark : maakLockupLight) : maakSymbol;
  const cls = "brand brand-" + size + (variant === "lockup" ? " brand-lockup" : "") + (inverse ? " inverse" : "");
  return <img className={cls} src={src} alt="maak" />;
}

export function Avatar({ name, src, size }: { name: string; src?: string | null; size?: "sm" | "md" | "lg" }) {
  const initial = (name || "?").trim().slice(0, 1);
  const cls = "mk-avatar" + (size === "lg" ? " mk-avatar--lg" : size === "sm" ? " mk-avatar--sm" : "");
  return src ? (
    <span className={cls}><img src={src} alt={name} loading="lazy" /></span>
  ) : (
    <span className={cls} aria-hidden={true}>{initial}</span>
  );
}

export function Rating({ value, reviews }: { value: string | null; reviews?: number | null }) {
  const hasRating = value != null && value !== "" && Number(value) > 0;
  if (!hasRating) return null;
  return (
    <span className="mk-rating">
      <Star size={12.5} fill="currentColor" aria-hidden="true" />
      {value}
      {reviews && reviews > 0 ? <small>({reviews})</small> : null}
    </span>
  );
}

export function SearchBox({ value, onChange, onSubmit, placeholder }: { value: string; onChange: (value: string) => void; onSubmit?: () => void; placeholder?: string }) {
  const { t, dir } = useLanguage();
  return (
    <div className="mk-search" role="search">
      <Search size={19} aria-hidden="true" />
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => { if (event.key === "Enter" && onSubmit) onSubmit(); }}
        placeholder={placeholder ?? t("discover.searchPlaceholder")}
        aria-label={t("discover.searchLabel")}
      />
      {value ? (
        <button type="button" className="mk-iconbtn" style={{ width: 34, height: 34 }} onClick={() => onChange("")} aria-label={t("discover.clearSearch")}>
          <X size={16} aria-hidden="true" />
        </button>
      ) : null}
      <button type="button" className="mk-search-go" onClick={onSubmit} aria-label={t("discover.search")}>
        <ChevronRight size={20} aria-hidden="true" style={dir === "rtl" ? { transform: "scaleX(-1)" } : undefined} />
      </button>
    </div>
  );
}

/** Single, quiet assurance line — replaces the old three-card trust strip. */
export function TrustStrip() {
  const { t } = useLanguage();
  return (
    <p className="mk-assure">
      <ShieldCheck size={15} aria-hidden="true" />
      <span>{t("v2.assure")}</span>
    </p>
  );
}

export function CategoryCard({ category, active = false, onClick }: { category: Category; active?: boolean; onClick: () => void }) {
  const { t } = useLanguage();
  const Icon = category.icon;
  return (
    <button type="button" className={"mk-cat-tile" + (active ? " is-active" : "")} onClick={onClick} aria-pressed={active}>
      <span className="mk-cat-icon"><Icon size={20} aria-hidden="true" /></span>
      <b>{t(category.name)}</b>
      {category.count ? <small>{category.count}</small> : null}
    </button>
  );
}

export function CategoryChip({ category, active = false, onClick }: { category: Category; active?: boolean; onClick: () => void }) {
  const Icon = category.icon;
  const { t } = useLanguage();
  return (
    <button type="button" className={"mk-chip" + (active ? " is-active" : "")} onClick={onClick} aria-pressed={active}>
      <Icon size={15} aria-hidden="true" />
      <span>{t(category.name)}</span>
      {category.count ? <small>{category.count}</small> : null}
    </button>
  );
}

export function ServiceChip({ label, active = false, onClick }: { label: string; active?: boolean; onClick: () => void }) {
  const { t } = useLanguage();
  return (
    <button type="button" className={"mk-chip" + (active ? " is-active" : "")} onClick={onClick} aria-pressed={active}>
      {t(label)}
    </button>
  );
}

export function ProviderSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="mk-provider-list" aria-busy="true" aria-live="polite">
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="mk-provider-card" style={{ pointerEvents: "none" }}>
          <span className="mk-avatar mk-skel" aria-hidden="true" />
          <div className="mk-provider-body">
            <span className="mk-skel" style={{ height: 14, width: "55%", display: "block" }} />
            <span className="mk-skel" style={{ height: 11, width: "38%", display: "block", marginTop: 8 }} />
            <span className="mk-skel" style={{ height: 11, width: "72%", display: "block", marginTop: 10 }} />
          </div>
          <span className="mk-skel" style={{ height: 28, width: 74, borderRadius: 999 }} aria-hidden="true" />
        </div>
      ))}
    </div>
  );
}

export function ProviderRow({ provider, onClick }: { provider: Provider; onClick: () => void }) {
  const { t, dir } = useLanguage();
  const shownServices = provider.services.slice(0, 3);
  const extraCount = provider.services.length - shownServices.length;
  const availability = provider.available === true ? t("filters.availableNow") : provider.available === false ? t("provider.unavailable") : "";
  return (
    <button type="button" className="mk-provider-card" onClick={onClick}>
      <span style={{ position: "relative", flex: "0 0 auto", display: "inline-flex" }}>
        <Avatar name={provider.name} src={provider.image} />
        {provider.available != null ? <span className={"mk-avail-dot " + (provider.available ? "on" : "off")} aria-hidden="true" /> : null}
      </span>
      <div className="mk-provider-body">
        <div className="mk-provider-topline">
          <span className="mk-provider-name">{provider.name}</span>
          {provider.is_featured ? <span className="mk-badge mk-badge--gold">{t("featured.badge")}</span> : null}
          <Rating value={provider.rating} reviews={provider.reviews} />
        </div>
        <div className="mk-provider-job">{provider.job}</div>
        <div className="mk-provider-meta">
          {provider.city ? <span><MapPin size={12.5} aria-hidden="true" /> {provider.city}</span> : null}
          {provider.experience ? <span>{provider.experience}</span> : null}
          {availability ? (
            <span className={"mk-avail-line " + (provider.available ? "on" : "off")}>{availability}</span>
          ) : null}
        </div>
        {shownServices.length > 0 ? (
          <div className="mk-provider-services">
            {shownServices.map((service) => <span key={service} className="mk-service-tag">{t(service)}</span>)}
            {extraCount > 0 ? <span className="mk-service-tag more">+{extraCount}</span> : null}
          </div>
        ) : null}
      </div>
      <div className="mk-provider-side">
        {provider.price ? <b className="mk-provider-price">{provider.price}</b> : null}
        <span className="mk-provider-cta">
          {t("provider.cta")}
          <ChevronRight size={14} aria-hidden="true" style={dir === "rtl" ? { transform: "scaleX(-1)" } : undefined} />
        </span>
      </div>
    </button>
  );
}

export function StateCard({ variant, actionLabel, onAction, emptyTitle, emptyBody }: { variant: "loading" | "empty" | "error"; actionLabel?: string; onAction?: () => void; emptyTitle?: string; emptyBody?: string }) {
  const { t } = useLanguage();
  if (variant === "loading") {
    return <ProviderSkeleton rows={3} />;
  }
  if (variant === "error") {
    return (
      <div className="mk-state" role="alert">
        <span className="mk-state-icon danger"><CloudOff size={24} aria-hidden="true" /></span>
        <h3>{t("atoms.loadFail")}</h3>
        <p>{t("atoms.loadFailSub")}</p>
        {actionLabel && onAction ? (
          <button type="button" className="mk-btn mk-btn--secondary mk-btn--sm" onClick={onAction}>{actionLabel}</button>
        ) : null}
      </div>
    );
  }
  return (
    <div className="mk-state">
      <span className="mk-state-icon"><Search size={24} aria-hidden="true" /></span>
      <h3>{emptyTitle ?? t("discover.noResults")}</h3>
      <p>{emptyBody ?? t("discover.noResultsBody")}</p>
      {actionLabel && onAction ? (
        <button type="button" className="mk-btn mk-btn--secondary mk-btn--sm" onClick={onAction}>{actionLabel}</button>
      ) : null}
    </div>
  );
}


