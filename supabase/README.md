# Supabase backend

The backend is a Supabase project (Auth, Postgres with RLS, Storage, Realtime). The app talks to it directly with the
public *publishable* key; every sensitive action goes through `security definer` RPCs that re-check the caller's role.

```
supabase/
├─ baseline/     Original schema scripts (tables, RLS, storage buckets, first RPCs). Reference + fresh-project setup.
├─ migrations/   Incremental, timestamped migrations applied after the baseline.
├─ ci/           Bootstrap SQL used to test the migrations on a throw-away database. Never run on a live project.
└─ config.toml   Local Supabase CLI configuration.
```

## Existing production project

The live project already contains everything in `baseline/` and the older migrations. **Do not re-run them.**
Apply only the migrations that are new for the app rebuild:

| File | What it adds |
| --- | --- |
| `migrations/20261007120000_customer_favorites.sql` | `customer_favorites` table + owner-only RLS (powers the ♥ button) |
| `migrations/20261007120100_public_provider_services.sql` | Public read of a published provider's *active* price list |
| `migrations/20261007130000_bootstrap_official_admin.sql` | One-time, audited promotion of the official admin (see below) |
| `migrations/20261007150000_demote_demo_admin.sql` | One-time, audited demotion of `maak.admin.demo@gmail.com` to `customer` (refuses unless the official admin is an active admin) |
| `migrations/20261007140000_delete_my_account.sql` | `delete_my_account()` RPC behind *Profile → Security → Delete my account* |
| `migrations/20261007140100_content_reports.sql` | `content_reports` table + `submit_report`, `admin_list_reports`, `admin_resolve_report` RPCs (user / review / message reports) |
| `migrations/20261008100000_admin_tools.sql` | Admin panel back-end: `admin_list_users`, `admin_user_overview`, `admin_overview_stats`, `admin_send_announcement`, `admin_delete_user` (all re-check that the caller is an active admin) |
| `migrations/20261008110000_provider_approval_requires_documents.sql` | A provider can only be approved with a national ID and a profile photo on file: enforced in `admin_approve_provider` and by a trigger, so no code path (Worker, CSV) can bypass it. Test: `supabase/ci/provider-approval-documents-test.sql` |
| `migrations/20261008120000_bookable_from_working_hours.sql` | A listing is bookable when it is published, not paused and has working hours (before, the app waited for `providers.available = true`, which nothing in the repo sets). No data is changed. Test: `supabase/ci/bookable-from-working-hours-test.sql` |
| `migrations/20261008130000_booking_money_rules.sql` | Price / payment / refund rules enforced in SQL (`set_booking_price`, `mark_booking_paid`, `admin_refund_booking`) and `admin_cancel_booking` now frees the time slot and notifies both people. Test: `supabase/ci/booking-money-rules-test.sql` |
| `migrations/20261008140000_push_notifications.sql` | `push_tokens` + register/unregister RPCs and a dormant trigger for push notifications (see `docs/PUSH_NOTIFICATIONS.md`). Test: `supabase/ci/push-notifications-test.sql` |
| `migrations/20261008150000_push_token_revocation.sql` | `revoke_push_token(token)` so a phone can stop notifications after an offline sign-out, without a session (see `docs/PUSH_NOTIFICATIONS.md`) |
| `migrations/20261008160000_closed_day_marker.sql` | Closing a working-hours day that had no row failed on `provider_availability_time_order`; the time order now only applies to rows that offer hours. Test: `supabase/ci/provider-availability-days-test.sql` |

Run them in the Supabase SQL editor (or `supabase db push` once the migration ledger of the project is reconciled).

## Testing the SQL locally

`bash supabase/ci/replay.sh maak_replay` rebuilds the whole schema from this repository on a throw-away Postgres (set `PSQL="psql -h <host> -U <user>"`),
then run any `supabase/ci/*-test.sql` file against it. They end with a rollback, so they can be repeated.

## Fresh project (staging / new environment)

Reference order, inferred from the file headers — review before use:

1. `baseline/schema.sql`
2. `baseline/profiles.sql`
3. `baseline/provider-onboarding.sql`
4. `baseline/admin-verification.sql`
5. `baseline/bookings.sql`
6. `baseline/phase-a-listing-foundation.sql`
7. `baseline/security-hardening.sql`
8. `baseline/admin-control-center.sql`
9. `baseline/chat.sql`
10. `baseline/critical-security-hardening.sql`
11. `baseline/tighten-authenticated-rls-roles.sql`
12. `baseline/production-hardening-followup.sql`
13. `baseline/lock-listing-helper-execution.sql`
14. every file in `migrations/` in filename order

## Auth settings (Dashboard → Authentication)

* **URL Configuration → Redirect URLs** — add:
  * `maak://auth-callback` (iOS / Android builds)
  * your web origin(s), e.g. `https://<user>.github.io/<repo>` and `http://localhost:8081`
  * for Expo Go during development: `exp://**`
* **Providers → Email** — keep *Confirm email* on. (The app handles both modes.)
* **Providers → Google** — enable and paste the OAuth *Client ID* and *Client secret*
  (Google Cloud Console → Credentials → OAuth client, authorised redirect URI = `https://<project-ref>.supabase.co/auth/v1/callback`).

## Redirect URL for the admin panel
The admin panel lives at its own private path (see `docs/ADMIN_PANEL.md`). Add `https://hamzamaak8-a11y.github.io/Maak/<MAAK_ADMIN_PATH>/**` to *Redirect URLs*.

## Creating the admin account

Admins cannot sign up from the app, and **a plain `update public.profiles set role = 'admin'` is rejected on purpose**
(`guard_role_change()` / `guard_profile_security_fields()` protect `role`). Do not disable those triggers.

The official administrator is `hamzamaak8@gmail.com`. It is promoted by the one-time, audited migration
`migrations/20261007130000_bootstrap_official_admin.sql`, which uses the project's internal service-role mechanism
(the same one `admin_approve_provider` uses) inside a single transaction, verifies the result and writes
`admin_audit_log`. If the guard still refuses, the migration raises and changes nothing.

1. The account must exist (sign in once with Google or e-mail) and be confirmed.
2. Run the migration file in the SQL editor.
3. Verify: `select p.role from public.profiles p join auth.users u on u.id = p.id where u.email = 'hamzamaak8@gmail.com';`
4. Sign out and back in in the app; it opens the administration area.

If step 2 fails with `role change not allowed`, the deployed guard differs from `baseline/profiles.sql`. Read it (read-only)
and share the result so the migration can be aligned with the real guard:

```sql
select pg_get_functiondef('public.guard_role_change()'::regprocedure);
select tgname, tgenabled, pg_get_triggerdef(oid) from pg_trigger where tgrelid = 'public.profiles'::regclass and not tgisinternal;
```
