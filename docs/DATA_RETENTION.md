# What account deletion removes, and what it takes from the other person

Verified on a database replayed from this repository (`supabase/ci/data-deletion-effects-test.sql`).

`delete_my_account()` (and `admin_delete_user`) refuse while a booking is open (pending, accepted, in progress), then delete the Auth user.
Everything referencing the user **cascades**:

| Deleted account | Also deleted |
| --- | --- |
| Customer | profile, notifications, favourites, push tokens, messages they sent, **all their bookings** (and the booking slots), **their reviews** |
| Provider | profile, provider profile and documents, public listing, price list, **all bookings they received**, **the reviews customers wrote about them** |

Consequence checked in the test: when a customer deletes their account, the provider's completed bookings with that customer, the **paid revenue
those bookings represent** and the provider's reviews from that customer disappear. The provider's earnings statistics and rating change retroactively.
Deleting a provider erases the customer's service history in the same way. Chat conversations stay as empty shells (`booking_id` is set to null).

Content reports keep their rows (`reporter_id` / `reported_user_id` become null), so moderation history survives.

## Owner decision needed (legal and financial)

The right to delete personal data is respected today, but at the price of erasing the other party's business records. Options:

1. **Keep cascade** (today). Simple and clearly honours deletion. Cost: provider loses revenue history and ratings; possible gaps if accounting
   or dispute records must be kept by law (to be confirmed with a Moroccan accountant or lawyer, I cannot assert the retention period).
2. **Anonymise and keep minimal transaction records**: bookings and reviews stay, with the deleted person replaced by "Deleted user"; their name,
   phone, address, notes and messages are erased. Needs a migration (foreign keys `on delete set null`, nullable columns, UI for "Deleted user")
   and a sentence in the privacy policy stating the legal basis and retention period.
3. **Hybrid**: erase everything personal, keep only anonymised paid bookings (amount, currency, date, category) for the retention period, drop the rest.

I did not change this behaviour: choosing between 1 and 2/3 is a legal decision, and keeping personal data without a basis would be wrong in the other direction.
