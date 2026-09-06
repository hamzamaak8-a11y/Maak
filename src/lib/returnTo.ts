/**
 * Post-authentication return path.
 *
 * Protected customer screens (booking, bookings, chat) save the route the
 * visitor was trying to reach before sending them to /login or /register.
 * After a successful sign-in (or a sign-up that produced a session) the auth
 * screens consume the value and navigate back to it.
 *
 * Only app-relative paths are accepted (leading "/" and no "//" or scheme) so
 * the value can never be used as an open redirect.
 */

const KEY = "maak:returnTo";

const PROTECTED_PATTERNS: RegExp[] = [
  /^\/provider\/\d+\/booking$/,
  /^\/bookings$/,
  /^\/chat$/,
];

export function isSafeReturnPath(path: string | null | undefined): path is string {
  if (!path || typeof path !== "string") return false;
  if (!path.startsWith("/")) return false;
  if (path.startsWith("//")) return false;
  if (/^\/(login|register|forgot-password|reset-password|admin)(\/|$)/.test(path)) return false;
  return PROTECTED_PATTERNS.some((re) => re.test(path.split("?")[0]));
}

export function rememberReturnTo(path: string): void {
  if (!isSafeReturnPath(path)) return;
  try {
    sessionStorage.setItem(KEY, path);
  } catch {
    /* storage unavailable: the user simply lands on the home screen */
  }
}

export function consumeReturnTo(): string | null {
  try {
    const value = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    return isSafeReturnPath(value) ? value : null;
  } catch {
    return null;
  }
}
