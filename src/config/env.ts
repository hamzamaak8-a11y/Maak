// Expo inlines EXPO_PUBLIC_* variables at build time. Only public, browser-safe values belong here
// (never the Supabase service-role key).
export const SUPABASE_URL = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim();
export const SUPABASE_KEY = (process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '').trim();
/** Public read API (Cloudflare Worker): marketplace listings and portfolio images. */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').trim().replace(/\/$/, '');

export const isSupabaseConfigured = /^https?:\/\//.test(SUPABASE_URL) && SUPABASE_KEY.length > 0;

/** Optional public support address shown in the Help screen. */
export const SUPPORT_EMAIL = (process.env.EXPO_PUBLIC_SUPPORT_EMAIL ?? '').trim();
