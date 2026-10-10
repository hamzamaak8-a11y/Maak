/**
 * Money rules for a booking. They mirror, 1:1, the database functions in
 * supabase/migrations/20261008130000_booking_money_rules.sql (set_booking_price, mark_booking_paid, admin_refund_booking);
 * the database is the authority, the UI only hides actions the server would refuse.
 */
export type MoneyBooking = { status: string; price: number | null; payment_status: string };

const PRICE_EDITABLE = ['pending', 'accepted'];
const PRICE_SETTABLE = ['pending', 'accepted', 'in_progress', 'completed'];

/** Provider: set a price. Free to change before work starts; later only a still-empty price can be set. Never after payment. */
export function canProviderSetPrice(b: MoneyBooking): boolean {
  if (!PRICE_SETTABLE.includes(b.status)) return false;
  if (b.payment_status === 'paid' || b.payment_status === 'refunded') return false;
  return b.price == null || PRICE_EDITABLE.includes(b.status);
}

/** The agreed price exists but can no longer be changed (work started, or payment recorded). */
export function isPriceLocked(b: MoneyBooking): boolean {
  return b.price != null && PRICE_SETTABLE.includes(b.status) && !canProviderSetPrice(b);
}

/** Admin: record a payment. Only completed, priced bookings that are not paid or refunded yet. */
export function canAdminMarkPaid(b: MoneyBooking): boolean {
  return b.status === 'completed' && b.price != null && (b.payment_status === 'unpaid' || b.payment_status === 'pending');
}

/** Admin: refund. Only a payment that was recorded as paid. */
export function canAdminRefund(b: MoneyBooking): boolean {
  return b.payment_status === 'paid';
}
