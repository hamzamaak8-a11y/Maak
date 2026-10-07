/** Maps any thrown value (Supabase / network / app error) to a stable i18n key. */
export type ErrorKey =
  | 'err.generic' | 'err.network' | 'err.notAuthenticated' | 'err.forbidden' | 'err.notFound'
  | 'err.invalidCredentials' | 'err.emailNotConfirmed' | 'err.userExists' | 'err.weakPassword'
  | 'err.rateLimited' | 'err.notBookable' | 'err.slotUnavailable' | 'err.invalidDate'
  | 'err.invalidTransition' | 'err.reasonRequired' | 'err.invalidPrice' | 'err.invalidCurrency'
  | 'err.alreadyReviewed' | 'err.bookingNotCompleted' | 'err.invalidRating' | 'err.emptyMessage'
  | 'err.messageTooLong' | 'err.fileTooBig' | 'err.fileType' | 'err.documentsRequired'
  | 'err.activeBookings' | 'err.adminCannotDelete' | 'err.invalidReport' | 'err.suspended' | 'err.config' | 'err.oauthCancelled' | 'err.sessionExpired';

function rawMessage(error: unknown): string {
  if (!error) return '';
  if (typeof error === 'string') return error;
  if (typeof error === 'object') {
    const e = error as { message?: unknown; error_description?: unknown; code?: unknown };
    if (typeof e.message === 'string' && e.message) return e.message;
    if (typeof e.error_description === 'string') return e.error_description;
    if (typeof e.code === 'string') return e.code;
  }
  return String(error);
}

export function errorKey(error: unknown): ErrorKey {
  const m = rawMessage(error);
  if (/^err\.[a-zA-Z]+$/.test(m)) return m as ErrorKey;
  if (/network request failed|failed to fetch|network error|load failed|timeout|upstream/i.test(m)) return 'err.network';
  if (/invalid login credentials/i.test(m)) return 'err.invalidCredentials';
  if (/email not confirmed/i.test(m)) return 'err.emailNotConfirmed';
  if (/already registered|already been registered|user_already_exists/i.test(m)) return 'err.userExists';
  if (/password should be|weak_password|at least 6/i.test(m)) return 'err.weakPassword';
  if (/rate limit|too many|over_email_send_rate_limit|429/i.test(m)) return 'err.rateLimited';
  if (/not_authenticated|jwt|refresh token|session/i.test(m)) return 'err.notAuthenticated';
  if (/provider_not_bookable|provider_not_linked/i.test(m)) return 'err.notBookable';
  if (/slot_unavailable|provider_unavailable/i.test(m)) return 'err.slotUnavailable';
  if (/invalid_service_date/i.test(m)) return 'err.invalidDate';
  if (/invalid_transition/i.test(m)) return 'err.invalidTransition';
  if (/reason_required/i.test(m)) return 'err.reasonRequired';
  if (/invalid_price/i.test(m)) return 'err.invalidPrice';
  if (/invalid_currency/i.test(m)) return 'err.invalidCurrency';
  if (/already_reviewed/i.test(m)) return 'err.alreadyReviewed';
  if (/booking_not_completed/i.test(m)) return 'err.bookingNotCompleted';
  if (/invalid_rating/i.test(m)) return 'err.invalidRating';
  if (/empty_message/i.test(m)) return 'err.emptyMessage';
  if (/message_too_long/i.test(m)) return 'err.messageTooLong';
  if (/documents_required/i.test(m)) return 'err.documentsRequired';
  if (/active_bookings/i.test(m)) return 'err.activeBookings';
  if (/admin_cannot_delete/i.test(m)) return 'err.adminCannotDelete';
  if (/invalid_report/i.test(m)) return 'err.invalidReport';
  if (/not_found|booking_not_found|review_not_found/i.test(m)) return 'err.notFound';
  if (/forbidden|permission denied|row-level security/i.test(m)) return 'err.forbidden';
  return 'err.generic';
}
