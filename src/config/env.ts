// Expo inlines EXPO_PUBLIC_* variables at build time. Only public, browser-safe values belong here
// (never the Supabase service-role key).
export const SUPABASE_URL = (process.env.EXPO_PUBLIC_SUPABASE_URL ?? '').trim();
export const SUPABASE_KEY = (process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '').trim();
/** Public read API (Cloudflare Worker): marketplace listings and portfolio images. */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').trim().replace(/\/$/, '');

import { Platform } from 'react-native';

/**
 * Google sign-in is hidden on iOS: App Store guideline 4.8 requires "Sign in with Apple" (or an equivalent)
 * whenever a third-party login is offered. iOS users sign in with e-mail + password until Apple sign-in is added.
 */
export const GOOGLE_LOGIN_ENABLED = Platform.OS !== 'ios';

export const isSupabaseConfigured = /^https?:\/\//.test(SUPABASE_URL) && SUPABASE_KEY.length > 0;

/** Optional public support address shown in the Help screen. */
export const SUPPORT_EMAIL = (process.env.EXPO_PUBLIC_SUPPORT_EMAIL ?? '').trim() || 'hamzamaak8@gmail.com';

/** Public web address of the app (hosts the legal pages under /privacy.html, /terms.html, /delete-account.html). */
export const WEB_URL = (process.env.EXPO_PUBLIC_WEB_URL ?? 'https://hamzamaak8-a11y.github.io/Maak').trim().replace(/\/$/, '');
export const legalUrl = (page: 'privacy' | 'terms' | 'delete-account') => `${WEB_URL}/${page}.html`;

/**
 * Which front-end this bundle is. The customer/provider APP (phones, web) never contains a way in for administrators;
 * the ADMIN panel is a separate build served from its own private address (EXPO_PUBLIC_APP_TARGET=admin).
 */
export const APP_TARGET: 'app' | 'admin' = process.env.EXPO_PUBLIC_APP_TARGET === 'admin' ? 'admin' : 'app';
export const IS_ADMIN_PORTAL = APP_TARGET === 'admin';
/** Shown next to a starting price when the provider's own price list does not tell the currency. */
export const DEFAULT_CURRENCY = /^[A-Z]{3}$/.test(process.env.EXPO_PUBLIC_DEFAULT_CURRENCY ?? '') ? (process.env.EXPO_PUBLIC_DEFAULT_CURRENCY as string) : 'MAD';

export const PAGE_MAX_WIDTH = IS_ADMIN_PORTAL ? 980 : 720;
