# Booking, price and payment rules

What the app enforces today. The database is the authority (`supabase/migrations/20261008130000_booking_money_rules.sql`);
the screens only hide actions the server would refuse (`src/lib/bookingRules.ts`, same case matrix in `tests/bookingRules.test.mjs`
and `supabase/ci/booking-money-rules-test.sql`).

## Price (set by the provider)

| Booking status | No price yet | Price already set |
| --- | --- | --- |
| pending, accepted | provider can set | provider can change |
| in progress, completed | provider can set (late quote) | **locked** |
| cancelled, rejected | no | no |
| any status, payment `paid` / `refunded` | locked | locked |

The customer gets a notification whenever the price is set or changed. After the service starts the agreed price cannot be edited
from the app; the screen says so and points to the chat and to support.

## Payment (cash, recorded by an administrator)

* **Mark as paid**: only a *completed* booking that has a price and is `unpaid` / `pending`. Paid again gives `already_paid`, refunded gives `payment_locked`,
  anything else gives `booking_not_payable`.
* **Mark refunded** (new): only `paid` bookings, with a written reason. `refunded` is final.
* Marking paid, refunding and cancelling are written to `admin_audit_log`.

## Cancelling after the provider accepted (current behaviour, policy still open)

The customer can cancel only while a request is *pending*; the provider can start or decline only a pending request. After acceptance either person
has to agree with the other in the chat, and an administrator can cancel (`admin_cancel_booking`). Fixed in this release: an admin cancel now
**releases the provider's time slot** (it used to stay confirmed and block the hour forever) and **notifies both people**. The booking screen shows how
to get help (`booking.needChange`).

Owner decision needed. Options:

1. **Keep it as is** (chat + support). Cheapest; support carries the load.
2. **Cancellation request**: either person asks, the other accepts, the booking becomes cancelled; support can override. Needs a new status or table.
3. **Free cancellation window** (for example until 24 h before the service) and a visible reliability record for providers who cancel late.
4. **Reschedule request** instead of cancel for the usual case "I cannot make that time".

Risks to weigh: no-shows and abuse (customers booking then cancelling), providers cancelling to take a better job, and whether any deposit or
fee is ever charged (not today: payment is cash, off-platform).

## Time zone

Slots are stored and shown in **UTC** for everybody (the provider's "09:00" is 09:00 UTC, which is 10:00 in Morocco most of the year and 09:00 during
Ramadan time). Both people always see the same hour, and the screens now say "UTC (GMT)". Changing to local time needs a migration plan for stored
availability and bookings, so it was not touched.
