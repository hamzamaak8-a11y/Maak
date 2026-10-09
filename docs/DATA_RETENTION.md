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

## Identity-document files while the account exists (migration `20261008180000_document_files_locked.sql`)

Verified on a replay of the repository's Storage policies (`supabase/ci/document-files-test.sql`, 19 checks):

* **Before:** the owner could delete (and overwrite) the *file* of an approved document, while the table refused to delete its *row*. The row stayed "approved"
  with nothing behind it, and the app reported success because Supabase answers "0 rows deleted" without an error. Two generations of permissive Storage
  policies existed for the bucket (folder-based and owner-based), so fixing one would not have been enough.
* **Now:** pending files can be replaced or deleted; approved and rejected files are locked while the account exists (same rule the rows already had);
  an upload with no row can always be cleaned up; admin approval requires the national ID and profile photo to exist in Storage.
* **Account deletion still erases everything:** the app first calls `begin_account_deletion()` (unlocks the caller's own files for 15 minutes), removes the
  files, then deletes the account. The unlock is personal and expires.
* **Not decided here (owner):** how long identity files must or may be kept *after* approval. Today they stay until the person deletes the account.
  An administrator deleting someone else's account (`admin_delete_user`) still cannot remove that person's files from Storage; they would remain as unreferenced
  files. Fixing that needs a service-role clean-up step in the Worker and a retention decision.
