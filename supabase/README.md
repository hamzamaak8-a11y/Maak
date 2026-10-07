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

Admins cannot sign up from the app. Create the account normally (sign up with a private email + password, confirm the
email), then promote it once in the SQL editor:

```sql
update public.profiles set role = 'admin'
where id = (select id from auth.users where email = 'admin@your-domain.com');
```

The admin signs in from the normal *Sign in* screen and is taken straight to the administration area.
