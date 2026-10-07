import type { Ionicons } from '@expo/vector-icons';

type IconName = keyof typeof Ionicons.glyphMap;

/**
 * `value` is the exact string stored in the database (provider_profiles.service_category and
 * bookings.service_category) — do not change existing values, only add new ones.
 */
export type CategoryDef = { value: string; icon: IconName; color: string; label: { ar: string; fr: string; en: string } };

export const CATEGORIES: CategoryDef[] = [
  { value: 'سباكة', icon: 'water', color: '#2563EB', label: { ar: 'سباكة', fr: 'Plomberie', en: 'Plumbing' } },
  { value: 'كهرباء', icon: 'flash', color: '#D97706', label: { ar: 'كهرباء', fr: 'Électricité', en: 'Electrical' } },
  { value: 'تنظيف', icon: 'sparkles', color: '#059669', label: { ar: 'تنظيف', fr: 'Nettoyage', en: 'Cleaning' } },
  { value: 'نقل وأثاث', icon: 'car', color: '#7C3AED', label: { ar: 'نقل وأثاث', fr: 'Déménagement', en: 'Moving & furniture' } },
  { value: 'دهان وديكور', icon: 'color-palette', color: '#DB2777', label: { ar: 'دهان وديكور', fr: 'Peinture & déco', en: 'Painting & decor' } },
  { value: 'نجارة', icon: 'hammer', color: '#B45309', label: { ar: 'نجارة', fr: 'Menuiserie', en: 'Carpentry' } },
  { value: 'تكييف وتبريد', icon: 'snow', color: '#0891B2', label: { ar: 'تكييف وتبريد', fr: 'Climatisation', en: 'AC & cooling' } },
  { value: 'صيانة عامة', icon: 'construct', color: '#0E6B55', label: { ar: 'صيانة عامة', fr: 'Maintenance', en: 'General maintenance' } },
  { value: 'حدادة', icon: 'build', color: '#475569', label: { ar: 'حدادة', fr: 'Ferronnerie', en: 'Metalwork' } },
  { value: 'زراعة وحديقة', icon: 'leaf', color: '#16A34A', label: { ar: 'زراعة وحديقة', fr: 'Jardinage', en: 'Gardening' } },
  { value: 'تقنية وحواسيب', icon: 'laptop', color: '#4F46E5', label: { ar: 'تقنية وحواسيب', fr: 'Informatique', en: 'IT & computers' } },
  { value: 'أخرى', icon: 'ellipsis-horizontal-circle', color: '#64748B', label: { ar: 'أخرى', fr: 'Autre', en: 'Other' } },
];

export function categoryLabel(value: string | null | undefined, lang: 'ar' | 'fr' | 'en'): string {
  if (!value) return '';
  const def = CATEGORIES.find(c => c.value === value);
  return def ? def.label[lang] : value;
}

export function categoryDef(value: string | null | undefined): CategoryDef | undefined {
  return CATEGORIES.find(c => c.value === value);
}

/** Quick-add suggestions for the provider's service list (stored as free text, Arabic as in the existing data). */
export const SERVICE_SUGGESTIONS = [
  'تسريب الماء', 'تركيب صنابير', 'إصلاح سخان', 'تمديد كهرباء', 'إنارة ولوحات', 'صيانة الأجهزة',
  'تنظيف منزل', 'تنظيف بعد البناء', 'نقل أثاث', 'تركيب الأثاث', 'دهان جدران', 'ديكور وجبس',
  'نجارة أبواب', 'صيانة تكييف', 'إصلاحات عامة',
];
