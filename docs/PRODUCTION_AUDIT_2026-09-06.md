# MAAK / معك — Forensic production audit & alignment report (2026-09-06)

Classification legend: **SOURCE** = read in repo · **BUILD** = `tsc`/`vite build` executed · **DEPLOYMENT** = GitHub Actions/Pages metadata · **RUNTIME** = fetched from the live origin or executed production bundle · **DATABASE** = observed against the live Supabase project · **END-TO-END** = full user flow executed against production · ⛔ BLOCKED = could not be verified from this environment.

Repository: `i36508871-eng/maak` · production branch `main` · frontend `https://i36508871-eng.github.io/maak/` · Worker `https://maak.i36508871.workers.dev/` · Supabase `pjvayowrmqkhmzvlhwex`.

Previous "PRODUCTION READY" reports: **no report file or SHA exists in the repository** to compare against; every statement below was re-verified independently.

---

## Part 1 — Deployment forensics (questions 1–9)

| # | Question | STATUS | EVIDENCE | SOURCE vs RUNTIME | RESULT |
|---|----------|--------|----------|-------------------|--------|
| 1 | Current `main` HEAD | ✅ DEPLOYMENT VERIFIED | Before this work: `a2fcf4eb573ef55d5f8982b8ad2dd736ebeb9207` (Merge PR #2). After this work: `0c6d5487c254483ee0660eba4a94c8e8e6dae82f` (Merge PR #3). | — | HEAD identified; no other long-lived branches (`arena/01a07407-maak` only, already merged). No tags. |
| 2 | Latest APPROVED new-design commit | ✅ SOURCE VERIFIED | Lineage `5934c46 → f470456 ("Vibrant Sunset", rejected concept) → 7f78a3a → 3335a22 → bfaaccd (PR #1 "complete master dark design system, pure Fusha/French") → 34a7007 → a2fcf4e (PR #2)`. Dark/gold tokens (`--bg #0b0c0e`, `--surface #141518`, `--gold #d4af37`, Tajawal) introduced in 7f78a3a/3335a22 and finalised in bfaaccd. | SOURCE only | Approved design = `bfaaccd` lineage; fully contained in `main`. `grep -ri sunset src` → 0 hits. |
| 3 | Is the approved design in `main`? | ✅ SOURCE VERIFIED | `git diff bfaaccd a2fcf4e -- src/index.css src/styles` = only additive refinements; no old CSS imports; single `--gold:` token definition (`src/index.css`); brand assets `icon-192/512.png` = gold "M" mark. | SOURCE | Yes. |
| 4 | Which commit is deployed? | ✅ DEPLOYMENT VERIFIED | Pages `build_type=workflow`, `source.branch=main`. Deploy runs: `34003030602` (a2fcf4e, success) and now `34040481913` (0c6d548, success, `event=push`). | DEPLOYMENT | Production = `main` HEAD, deployed by `deploy-pages.yml` (upload `./dist` → `actions/deploy-pages`). |
| 5 | Do the live assets belong to that commit? | ✅ RUNTIME + BUILD VERIFIED | Live `/maak/` referenced `index-M-qNl4nM.css` + `index-q2_0AFfp.js`; a clean local `npm run build` of a2fcf4e produced **identical hashes** (reproducible: rebuilt twice). Older commits build to different hashes (5934c46 → `index-DSIlflDM.css`/`index-COCum2Gx.js`; f470456 → `index-4AWvnSoK.css`/`index-B11fB9d0.js`). After PR #3 the live page serves `index-lCpB9s-t.js` (fetched 200, real JS) with the **same** `index-M-qNl4nM.css`. | SOURCE == RUNTIME | Production serves exactly the `main` build. No stale artifact. |
| 6 | Is the live CSS the new design? | ✅ RUNTIME VERIFIED | Fetched live `/maak/assets/index-M-qNl4nM.css`: contains `--bg:#0b0c0e`, `--bg-2:#0e0f12`, `--surface:#141518`, `--gold:#d4af37`, Tajawal; contains none of the old palette (`#071A3D`, `#20B486`, Sunset). | SOURCE == RUNTIME | The new approved dark/gold design **is** what production serves. |
| 7 | Base path / routing / 404 fallback | ✅ RUNTIME VERIFIED | `vite.config.ts` base = `VITE_BASE` (`/maak/` in `.env.production`); `dist/index.html` uses `/maak/assets/...`; router basename `/maak`; `public/404.html` stores deep link in `sessionStorage` and redirects to `/maak/`; live `/maak/login`, `/maak/discover`, `/maak/bookings`, `/maak/admin/login`, `/maak/provider/1/booking` all render the app; `/maak/assets/index-DOESNOTEXIST.css` returns the SPA shell (fallback working). | RUNTIME | Correct. No base-path or routing mismatch. |
| 8 | Any old-design code still loaded? | ✅ RUNTIME + BUILD VERIFIED | Bundle grep (`dist/assets/index-*.js`): `Sunset` 0, `#071A3D` 0, `#20B486` 0. Old favicon/Sunset files absent from `main`. | SOURCE == RUNTIME | No. |
| 9 | Root cause of any "old design" sighting | ✅ SOURCE VERIFIED (cause) / ✅ FIXED | `public/sw.js` history: v1 (`c9117f8`) cached **navigations cache-first** (could pin an old `index.html` indefinitely); v3 (`2fda565`) switched navigations to network-first; v8 same. A client that last visited during the v1 era keeps the old shell until the SW updates. | Client-side only | **Not a deployment problem.** Fix shipped: `CACHE_NAME` v8 → **v9** (activate purges all older caches), hashed `/maak/assets/*` cache-first (immutable), everything else network-first. Live `/maak/sw.js` now serves v9. Users still seeing an old UI: one online reload (or "clear site data") — nothing else is required. |

**Conclusion Part 1:** live == `main` == approved design. Nothing in the source was changed to "match" the live site; the only deployment-side action was the service-worker cache bump.

---

## Part 2 — What was wrong in the product (and what was fixed in PR #3, commit `4962468`)

| Finding | Before | After (verified) |
|---------|--------|------------------|
| ❌ Fabricated providers | `src/services.ts` fell back to `src/data.ts` `fallbackProviders` (4 invented bookable "real" providers with Unsplash photos, fake ratings/distances). Live API returns `[]` ⇒ production showed fake providers. | `fallbackProviders` deleted; `fetchProviders/fetchProvider` throw on non-OK ⇒ honest error state with retry; `[]` ⇒ honest empty state. Bundle grep `fallbackProviders`/`unsplash` = 0. Live `/maak/` now shows the empty/error state, not fake names. |
| ❌ Fake filters | "متاح الآن" toggle + rating/distance sort while real listings always have `available/rating/distance = NULL` (`refresh_provider_listing`). | Removed from `FilterBar` + `Discover`; city filter (real column) kept. Live `/maak/discover` no longer shows them. Dead dictionary keys removed. |
| ❌ Fabricated default address | Booking step 3 pre-filled "طنجة، النجمة". | Default `""`, validation unchanged (required). |
| ⚠️ No returnTo after auth | Booking gate sent users to `/login`, which always navigated to `/`. | `src/lib/returnTo.ts` (sessionStorage `maak:returnTo`, allow-list `/provider/:id/booking`, `/bookings`, `/chat`, rejects external/auth/admin paths). Login + Register consume it. Verified in the production bundle (jsdom): gate click → `/maak/login` with `returnTo=/provider/7/booking`. |
| ⚠️ Bookings page silently empty when signed out | No gate. | Explicit auth gate (login/register); `BookingsProvider` re-queries on auth change and skips the query when signed out. Live `/maak/bookings` shows the gate. |
| ⚠️ Chat showed a fake conversation partner (`providers[0]`) | Fabricated peer. | Honest disabled state + auth gate; no provider data used. |
| ⚠️ `/provider-mode` rendered for any signed-in user | Frontend-only leak of the provider shell (data still RLS-protected). | Renders only when server-side `profiles.role = provider`; others redirected to `/account` or `/login`. |
| ⚠️ Admin exposed raw PostgREST `code · details · hint` in the UI | Technical strings visible to admins. | Only translated messages rendered; raw error kept in console. |
| ⚠️ Admin lacked customers/bookings views | Only Overview + Verify. | Read-only **Customers** and **Bookings** tabs using the existing admin RLS SELECT policies; real rows/counts only (no invented analytics). |
| ⚠️ FR mode showed Arabic category/service chips | Canonical Arabic keys rendered raw. | Chips/headings go through the dictionary (FR: Plomberie, Électricité, …). ar/fr = **560/560 keys, identical sets, 0 duplicates**, 398 used keys all present, no Darija, only Arabic in FR = `lang.ar`. |
| ❌ DB: booking RPCs granted to `anon`; ownership checks use `<> auth.uid()` (NULL-safe gap) | Anonymous caller with a booking UUID reaches the UPDATE (status guard is the only barrier). **Confirmed live:** anon `POST /rest/v1/rpc/cancel_booking` returns `P0001 not_found` ⇒ the function body executes for anon. | `worker/db/security-hardening.sql` (idempotent): `require_auth_uid()`, `assert_provider_owner()` (must be `approved`), `is distinct from`, `FOR UPDATE`, EXECUTE revoked from `anon`/`public`, direct writes stay closed. **Not applied — needs Supabase SQL editor.** |
| ⚠️ SQL hygiene | `phase-a-listing-foundation.sql` used `as $ … end $;` (invalid); `profiles.sql` had 3× `drop policy … on X on X;`. | Fixed in repo (`$$`, single `on`). All files dollar-quote balanced. |

Design integrity after the changes: CSS bundle hash **unchanged** (`index-M-qNl4nM.css`, 52.91 kB) ⇒ the design system is byte-identical; only JS/i18n/SQL changed.

---

## Part 3 — §39 final gate checklist

| Gate item | Status |
|-----------|--------|
| `npm run typecheck` executed and passing | ✅ BUILD VERIFIED (exit 0) |
| `npm run build` executed and passing, reproducible | ✅ BUILD VERIFIED (exit 0; CI run 34040434846 pass; deploy run 34040481913 pass) |
| Live site serves the `main` build (asset hashes) | ✅ DEPLOYMENT + RUNTIME VERIFIED |
| Live CSS = approved dark/gold design, no old concept | ✅ RUNTIME VERIFIED |
| No fabricated data in bundle or UI | ✅ BUILD + RUNTIME VERIFIED |
| No fake filters | ✅ RUNTIME VERIFIED (live `/discover`) |
| Service-role key never in bundle/env/public assets | ✅ SOURCE + BUILD VERIFIED (`service_role`, `sb_secret`, JWT prefix = 0 hits; `.env.production` publishable key only) |
| Provider documents private (no public bucket/URLs) | ✅ DATABASE VERIFIED (public object URL → `Bucket not found`; signed URLs 300 s; storage RLS in SQL) |
| Admin not impersonable client-side | ✅ SOURCE + DATABASE VERIFIED (role from `profiles` under RLS; `is_admin()` false for anon; `admin_approve_provider` → `forbidden: admin only` live) |
| Booking lifecycle enforced server-side incl. anon | ⚠️ PARTIAL — status machine + authenticated ownership enforced live; **anon NULL-guard gap open until `security-hardening.sql` is applied** |
| Marketplace filter (real ∧ published ∧ linked) | ✅ SOURCE (Worker `PUBLISHED_FILTER` on list+detail; client `isListed/isBookable`) + RUNTIME (bundle test: seed & unpublished hidden, detail 404) |
| i18n MSA/FR, RTL/LTR, no mixing | ✅ SOURCE + RUNTIME VERIFIED (jsdom: `dir=rtl lang=ar` / `dir=ltr lang=fr`; remaining physical `text-align` rules only on review-value/side-menu cells) |
| Direct routes / refresh under `/maak/` | ✅ RUNTIME VERIFIED |
| Mobile 320–480 visual check | ⛔ BLOCKED (no browser in sandbox; CSS breakpoints reviewed in source only) |
| Authenticated end-to-end flows (§35) | ⛔ BLOCKED (no test credentials/email access/browser) |
| DB hardening applied and verified | ❌ NOT APPLIED — DATABASE NOT VERIFIED |

---

## Part 4 — §40 report (A–Q)

| § | Area | Verdict |
|---|------|---------|
| A | Deployment & design alignment | ✅ DEPLOYMENT + RUNTIME VERIFIED — live == main == approved design; SW v9 live |
| B | Customer public browse (Home/Discover/Provider detail) | ✅ RUNTIME VERIFIED — honest empty/error states, no fabricated data, city filter only |
| C | Auth gate + returnTo (booking/bookings/chat) | ✅ RUNTIME VERIFIED (production bundle executed) — gate → login/register → back to protected route |
| D | Account centre | ✅ SOURCE VERIFIED / ⛔ E2E BLOCKED (needs a signed-in session) |
| E | Provider transition (not_started→onboarding→pending→approved/rejected+reason) | ✅ SOURCE + DATABASE(SQL) VERIFIED — `guard_verification_status_change` trigger, `admin_approve/reject_provider` SECURITY DEFINER; ⛔ E2E BLOCKED |
| F | 4-step onboarding (design kept as-is) | ✅ SOURCE VERIFIED, unchanged; ⛔ E2E BLOCKED |
| G | Provider mode (real requests, accept/reject-with-reason/start/complete, profile edit, switch back) | ✅ SOURCE VERIFIED (RPC-only actions, reason required, `update_provider_marketplace_profile` exists live) — ⛔ E2E BLOCKED |
| H | Admin surface (`/admin/login`, `/admin`; overview, verification w/ signed docs, customers, bookings) | ✅ RUNTIME VERIFIED for login/gating; new read-only Customers/Bookings tabs SOURCE + BUILD VERIFIED; categories/security tabs NOT IMPLEMENTED (no real data source — intentionally not faked) |
| I | Booking lifecycle server-side | ⚠️ PARTIAL — transitions/ownership enforced for authenticated callers live; anon guard fix delivered as SQL, **pending application** |
| J | Marketplace filter (`real ∧ published_at ∧ provider_profile_id`) | ✅ SOURCE + RUNTIME VERIFIED (Worker + client) |
| K | No fabricated data / filters / analytics | ✅ BUILD + RUNTIME VERIFIED |
| L | Supabase auth flows (login/register/confirm/resend/forgot/reset/session/sign-out) | ✅ SOURCE VERIFIED (PKCE reset, resend cooldown, translated errors) + RUNTIME for page rendering; ⛔ E2E BLOCKED (needs mailbox) |
| M | No raw DB errors to users | ✅ SOURCE VERIFIED — `mapBookingError`, `translateError`, admin tech string removed |
| N | Security (server-side roles, service key, private docs, no secrets in admin) | ✅ SOURCE + BUILD + DATABASE VERIFIED except item I (anon RPC grant) |
| O | i18n (MSA Arabic RTL / professional French LTR) | ✅ SOURCE + RUNTIME VERIFIED — 560/560 keys; SQL-generated experience text (`'<n> سنوات'`) remains Arabic in FR (⚠️ minor, server-side string) |
| P | Mobile 320–480 & direct routes | Routes ✅ RUNTIME VERIFIED; visual mobile pass ⛔ BLOCKED |
| Q | DB audit / Worker source vs runtime / build | Worker ✅ RUNTIME VERIFIED (`/health` ok, `/api/providers` `[]`, detail 404); DB schema/RLS/RPCs ✅ SOURCE VERIFIED + partial DATABASE VERIFIED (anon probes); build ✅ BUILD VERIFIED |

---

## Final verdict

**❌ NOT PRODUCTION READY (one blocking item remains).**

Everything that can be changed from the repository has been fixed, built, deployed and verified live. The single blocker is outside the repo's reach:

1. **Apply `worker/db/security-hardening.sql` in the Supabase SQL editor.** Until then, an anonymous caller who knows a booking UUID can reach the booking state-machine UPDATEs (live probe: `rpc/cancel_booking` as anon returns `not_found` instead of `permission denied`). After applying, re-run the probe — expected result `42501 permission denied for function cancel_booking` — and the verdict flips to READY for this item.

Non-blocking but still unverified from this environment (require credentials/browser/mailbox): authenticated §35 end-to-end flows and the visual 320–480 px pass.

Nothing in the approved design was changed: CSS bundle hash is identical before and after this work.
