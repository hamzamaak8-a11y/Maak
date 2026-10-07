# Maak · معاك

Maak is a marketplace for trusted local services (plumbing, electrical, cleaning, moving, painting…).
Customers find verified providers, book a time slot and chat; providers receive and manage requests; an admin team
verifies every provider before they appear in the app.

One Expo / React Native codebase ships **iOS, Android and Web**. Languages: العربية (RTL), Français, English. Light and dark themes.

## What each side can do

| | Guest (no account) | Customer | Provider | Admin |
| --- | --- | --- | --- | --- |
| Browse & search providers, see reviews, prices, portfolio | ✅ | ✅ | ✅ | |
| Book, message, favourite, review | sign-in required | ✅ | | |
| Sign up with e-mail + password, or Google | ✅ | | | |
| Apply as provider (profile + ID + photo, then wait for approval) | ✅ | ✅ | | |
| Accept / decline requests, set the price, run the job, price list, availability, portfolio | | | ✅ (after approval) | |
| Approve / reject providers (with a reason), suspend users, moderate reviews, cancel bookings, audit log | | | | ✅ |

* **Guests** can browse everything. Any action that needs an account sends them to *Sign in* and then continues where they were.
* **Providers** sign up like everyone else, complete a 3-step application (about you → your work → documents) and wait
  for approval. Their documents are private; only admins can open them.
* **Admins** cannot sign up from the app. The admin account is created in the database (see `supabase/README.md`) and
  signs in from the normal *Sign in* screen with its own private e-mail and password.
* **Payments** are intentionally not handled in the app yet: the provider sets the price after accepting and is paid
  directly. **Subscriptions / memberships** are intentionally left out for now (the database tables are untouched so they
  can be added later).

## Architecture

```
Expo app (iOS · Android · Web)
   │  public publishable key only
   ├──► Supabase  Auth · Postgres + RLS · Storage · Realtime  (all writes go through security-definer RPCs)
   └──► Cloudflare Worker  (read-only public API: published providers + portfolio images, uses the service-role key server-side)
```

```
App.tsx · app.config.ts          app entry, Expo config (bundle id com.maak.app, scheme maak://)
src/api/                         typed data layer (one file per domain; every call hits Supabase / the Worker)
src/contexts/                    Auth, Language (ar/fr/en + RTL), Theme, Favorites, Toast
src/navigation/                  navigators per role: guest/customer · provider · admin
src/screens/{auth,customer,provider,admin,shared}
src/components/                  UI primitives and shared widgets
src/i18n/                        en.ts (source of truth), ar.ts, fr.ts — typed, a missing key fails the type-check
supabase/                        schema baseline, migrations, backend docs
worker/                          Cloudflare Worker (public read API)
```

## Run it

```bash
npm install
cp .env.example .env        # fill in the three public values
npm run web                 # or: npm run android / npm run ios (Expo Go or a dev build)
npm run typecheck
```

`.env.production` (committed, public values only) is used by `expo export` / EAS builds.

## Official accounts

Every production resource of MAAK lives under the single official account **hamzamaak8@gmail.com**:
Supabase project, Google Cloud OAuth client, Cloudflare Workers (subdomain `hamzamaak8.workers.dev`) and the app-store accounts.
The production Worker is `https://maak.hamzamaak8.workers.dev`. Nothing in this repository may point to any other account.

## Configuration checklist

| What | Where |
| --- | --- |
| `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `.env` / `.env.production` |
| `EXPO_PUBLIC_API_URL` (the Worker URL) | `.env` / `.env.production` |
| `EXPO_PUBLIC_SUPPORT_EMAIL` (optional, shows a *Contact support* button) | `.env` / `.env.production` |
| Run the two new migrations, enable Google, add redirect URLs, create the admin | `supabase/README.md` |
| Worker secret `SUPABASE_SERVICE_ROLE_KEY`, allowed web origins | `worker/README.md` |

## Release

* **Web**: `npx expo export --platform web` → `dist/` (any static host; `vercel.json` and a GitHub Pages workflow are included).
* **Stores**: `npm i -g eas-cli && eas init && eas build -p all --profile production`, then `eas submit`.
  Before submitting, publish a privacy-policy page and (for the stores) add in-app account deletion.
