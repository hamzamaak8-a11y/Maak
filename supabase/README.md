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

Run them in the Supabase SQL editor (or `supabase db push` once the migration ledger of the project is reconciled).

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
