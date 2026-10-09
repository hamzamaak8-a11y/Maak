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

## Paused listings, service duration and the price list (migration `20261008170000_booking_service_duration.sql`)

Tested on the real functions by `supabase/ci/booking-service-duration-test.sql` (25 checks) and in the app by the e2e "price list" scenario.

* **Paused listing.** `create_booking` now refuses with `provider_not_bookable` when the provider paused the listing (`providers.available = false`), like the
  screen and `get_provider_availability` already did. Before, a direct RPC call could still book a paused provider that had working hours.
* **Duration.** The reserved slot lasts as long as the chosen service (`provider_services.duration_minutes`), 60 minutes when it has none. The existing exclusion
  constraint on `booking_slots` forbids any overlap, so a 2-hour service at 10:00 makes 11:00 unavailable. Longer than 12 hours cannot be booked online
  (`invalid_service_duration`). The app offers only start times where the service fits inside the working hours, on a one-hour grid.
* **Price list.** The booking screen shows the provider's **active** price list (name, price, duration). The chosen service is validated by the database
  (must belong to that provider and be active, else `service_unavailable`), the booking stores the service, its duration, its name and starts with the list price
  and currency (the provider can still change the price until work starts, see the rules above). A free request ("Something else") remains possible and works as
  before: named by the customer, one hour, price agreed with the provider.
* **Existing bookings are not touched**: they keep their one-hour slots; the new columns (`provider_service_id`, `service_duration_minutes`) are empty for them.
* Old app versions keep working: the new argument has a default, and the new app only sends it for a price-list service.

Product decisions for the owner:

1. **Default duration** for a service without one (today 60 minutes), and whether a duration should be mandatory when a provider adds a service.
2. **Free requests next to a price list**: kept (nothing that worked was removed). If you prefer "price-list services only", it is a one-line change in the app and a check in `create_booking`.
3. **List price as the starting price of the booking**: done, because it shows the customer what to expect; the alternative is to leave the price empty until the provider quotes.
4. **Start times** are on a one-hour grid (09:00, 10:00, ...). Half-hour starts would double the slots shown.
5. Services whose name is edited or disabled after a booking keep the booking's own copy of the name (the id is set to null if the service is deleted).
