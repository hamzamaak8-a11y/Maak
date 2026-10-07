import type { Lang } from '../types';

const LOCALES: Record<Lang, string> = { ar: 'ar-MA', fr: 'fr-FR', en: 'en-GB' };

// Availability and bookings are stored in UTC and shown as UTC everywhere, so the hour a provider
// publishes is exactly the hour a customer sees.
export function formatDateTime(iso: string | null | undefined, lang: Lang): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat(LOCALES[lang], { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function formatDate(iso: string | null | undefined, lang: Lang): string {
  if (!iso) return '—';
  try {
    return new Intl.DateTimeFormat(LOCALES[lang], { dateStyle: 'medium' }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export function formatTime(iso: string | null | undefined, lang: Lang): string {
  if (!iso) return '';
  try {
    return new Intl.DateTimeFormat(LOCALES[lang], { hour: '2-digit', minute: '2-digit' }).format(new Date(iso));
  } catch {
    return '';
  }
}

export function formatMoney(value: number | null | undefined, currency: string, lang: Lang): string {
  if (value == null) return '—';
  try {
    return new Intl.NumberFormat(LOCALES[lang], { style: 'currency', currency }).format(value);
  } catch {
    return `${value.toFixed(2)} ${currency}`;
  }
}

export function ratingNumber(value: string | null | undefined): number | null {
  if (!value) return null;
  const n = Number(String(value).replace(',', '.'));
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function dayKeyUtc(offset: number): { iso: string; dow: number } {
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + offset));
  return { iso: d.toISOString().slice(0, 10), dow: d.getUTCDay() };
}

export function isoForUtcDay(offset: number, time: string): string {
  const now = new Date();
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + offset));
  const [h, m] = time.slice(0, 5).split(':').map(Number);
  date.setUTCHours(h, m, 0, 0);
  return date.toISOString();
}
