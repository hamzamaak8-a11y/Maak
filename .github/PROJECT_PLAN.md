# Maak — Master Delivery Plan

This file is the project-manager source of truth. Do not mark a task DONE until its code, automated checks, deployment, and required live/manual verification are complete.

## Product target

Maak is a production-ready local-services marketplace with three independent surfaces:
- Customer: discover verified providers, view provider profiles, book, track booking status, chat, manage account.
- Provider: apply/onboard, upload private documents, wait for admin verification, manage marketplace profile, receive/manage bookings, chat, complete work.
- Admin: private `/admin/login` and `/admin` control center for verification, providers, customers, bookings, services/categories, activity/reports, and security/system controls.

## Non-negotiable rules

1. Preserve existing data and working logic; no rebuild from scratch.
2. No fake production marketplace data, ratings, distances, availability, reviews, analytics, or bookings.
3. Seed/demo records must never appear in the public marketplace.
4. Provider listing requires real provider data and server-side approval.
5. Roles/statuses are server-authoritative; never use hardcoded user UUIDs or client-only role hacks.
6. Private provider documents remain private and use short-lived authorized access.
7. Booking transitions are enforced server-side.
8. Arabic is Fusha + RTL; French is professional French + LTR.
9. Mobile-first and app-like. Desktop gets its own responsive layout.
10. Wokka is the visual reference: reproduce the visual language, hierarchy, spacing, component patterns, bold red/yellow/black direction and app feel, but keep Maak branding and legitimate assets.
11. GitHub Pages is the final frontend host. Cloudflare Worker is the API. Supabase is the database/auth/storage layer.
12. Every meaningful task must end with: commit on `main` -> CI/build -> Pages deployment -> live URL verification when technically accessible. If live verification is unavailable, explicitly mark it UNVERIFIED and do not claim completion.

## Current architecture checkpoint

- Frontend: React + Vite + TypeScript/PWA in `src/`.
- Customer pages already exist for Home, Discover, Provider Detail, Booking Flow, Bookings, Chat, Account, Login/Register/password flows.
- Provider pages already exist for onboarding and Provider Mode.
- Admin pages already exist for Admin Login and Admin shell.
- DB SQL foundations exist under `worker/db/`: profiles, provider onboarding, admin verification, bookings, listing foundation, security hardening.
- GitHub Pages deployment workflow exists and the latest UI correction commit `4a13b44c0b5da1e9f8253c468d62114e40ad4f15` built and deployed successfully.
- The Cloudflare Worker source is currently still minimal: it exposes health/providers/seed routes, so backend/API completion remains a major workstream.

## Delivery phases

### P0 — Foundation and audit
- [x] Repository and deployment architecture established.
- [x] GitHub Pages build/deploy pipeline established.
- [x] Wokka-inspired visual direction added.
- [x] Mobile shell correction committed and deployed.
- [ ] Live visual verification of the latest mobile shell (UNVERIFIED until the live URL can be opened and inspected).
- [ ] Full route inventory and broken-link audit.
- [ ] Confirm production env/API endpoint and Worker health from the live environment.

### P1 — Responsive design system / visual quality
- [ ] Customer mobile shell: one navigation system only; no duplicate top/bottom navigation.
- [ ] Customer desktop shell: desktop navigation only; no mobile nav.
- [ ] Header, bottom nav, safe-area, viewport, overflow and keyboard behavior.
- [ ] Home/Discover/Provider Detail/Booking/Bookings/Chat/Account visual pass.
- [ ] Login/Register/Forgot/Reset/Confirmation visual pass.
- [ ] Provider onboarding and Provider Mode visual pass.
- [ ] Admin login and Admin workspace visual pass.
- [ ] Arabic RTL + French LTR layout QA on every role.
- [ ] Typography, spacing, icon consistency, touch targets, loading/empty/error states.

### P2 — Authentication and account correctness
- [ ] Login/register/session persistence/sign-out.
- [ ] Email confirmation/resend.
- [ ] Forgot/reset password.
- [ ] Protected-action auth gates with return-to behavior.
- [ ] Correct role routing: customer/provider/admin.
- [ ] Provider-mode access only when server state allows it.
- [ ] No UUID-specific UI or authorization logic.

### P3 — Provider onboarding and verification
- [ ] Personal information.
- [ ] Professional information.
- [ ] Services/pricing/radius.
- [ ] Private documents and profile photo.
- [ ] Draft/resume-safe onboarding; no lost partial applications.
- [ ] Submit-for-review state.
- [ ] Admin pending queue.
- [ ] Admin document review via short-lived signed access.
- [ ] Approve/reject with rejection reason.
- [ ] Approved provider becomes eligible for marketplace publication.
- [ ] Rejected/pending/suspended providers never appear publicly.

### P4 — Real marketplace
- [ ] Public provider listing reads only real/published providers.
- [ ] Search/filter/category/city behavior.
- [ ] Provider detail uses only real provider fields.
- [ ] No invented rating/review/distance/availability.
- [ ] Provider marketplace profile editing for approved providers.
- [ ] Provider image/privacy rules.
- [ ] Empty state when there are no real published providers.
- [ ] Verify live API response and UI response match.

### P5 — Booking engine
- [ ] Customer booking form and validation.
- [ ] Server-side create booking.
- [ ] Pending -> accepted/rejected/cancelled.
- [ ] Accepted -> in_progress -> completed.
- [ ] Provider ownership + approval checks.
- [ ] Customer/provider/admin booking visibility rules.
- [ ] Cancellation/rejection reasons and timestamps.
- [ ] Booking history and detail pages.
- [ ] Apply `security-hardening.sql` manually in Supabase and verify RPC grants.
- [ ] End-to-end customer -> provider booking test with real accounts.

### P6 — Chat and notifications
- [ ] Conversations/messages schema.
- [ ] RLS: only conversation participants/admin where explicitly required.
- [ ] Realtime messaging.
- [ ] Unread counts.
- [ ] Booking-linked conversation creation.
- [ ] Provider/customer message UI.
- [ ] Notification events for booking changes and messages.
- [ ] No fake conversations in production.

### P7 — Provider workspace
- [ ] Dashboard metrics from real data only.
- [ ] Incoming requests.
- [ ] Accept/reject/start/complete controls.
- [ ] Booking detail.
- [ ] Customer contact/chat.
- [ ] Marketplace profile editor.
- [ ] Verification status/rejection feedback.
- [ ] Customer/provider mode switching where allowed.

### P8 — Admin control center
- [ ] Independent admin login.
- [ ] Overview with real counts.
- [ ] Provider verification queue.
- [ ] Provider/customer management.
- [ ] Booking management.
- [ ] Categories/services management.
- [ ] Activity/reports based only on real records.
- [ ] Security/system controls.
- [ ] Document review.
- [ ] Audit-friendly actions and safe errors.
- [ ] Admin cannot be reached through customer navigation.

### P9 — Backend/API completion
- [ ] Expand Cloudflare Worker beyond legacy providers/seed routes.
- [ ] Auth-aware API behavior where required.
- [ ] Provider endpoints.
- [ ] Booking endpoints/RPC integration.
- [ ] Chat endpoints/realtime strategy.
- [ ] Admin endpoints where direct API access is necessary.
- [ ] CORS locked to production frontend origin.
- [ ] Remove token-in-query admin seed flow from production path.
- [ ] Normalize errors; never leak service-role/database internals.
- [ ] Rate-limit sensitive endpoints where appropriate.
- [ ] Verify Worker deployment independently from frontend deployment.

### P10 — Data/security hardening
- [ ] Apply and verify all required SQL migrations in Supabase.
- [ ] RLS audit for every public table.
- [ ] RPC privilege audit: no anonymous booking mutation.
- [ ] Storage bucket privacy audit.
- [ ] Admin authorization audit.
- [ ] Provider role/status mutation audit.
- [ ] Seed isolation audit.
- [ ] CORS audit.
- [ ] Secret/env audit.
- [ ] Error leakage audit.

### P11 — Production QA
- [ ] Customer smoke test.
- [ ] Provider smoke test.
- [ ] Admin smoke test.
- [ ] Booking lifecycle test.
- [ ] Chat test.
- [ ] Auth recovery test.
- [ ] Arabic/French test.
- [ ] Mobile viewport test: 320/360/390/412px.
- [ ] Desktop test: 1024/1280/1440px.
- [ ] Deep-link/refresh test on GitHub Pages.
- [ ] PWA/service-worker sanity test.
- [ ] No console/runtime errors in critical flows.

### P12 — Launch gate
- [ ] GitHub Actions green.
- [ ] GitHub Pages deployment green.
- [ ] Worker health green.
- [ ] Live API green.
- [ ] Live frontend opens on the expected `/Maak/` path.
- [ ] Live customer flow works.
- [ ] Live provider flow works.
- [ ] Live admin flow works.
- [ ] Manual Supabase/Cloudflare steps documented and checked off.
- [ ] Final release audit completed.

## Verification protocol for every task

1. Inspect current implementation before changing it.
2. Make the smallest coherent change that solves the actual root cause.
3. Run typecheck/build when applicable.
4. Commit to `main`.
5. Verify GitHub Actions.
6. Verify Pages deployment.
7. Verify the live URL if accessible.
8. For backend tasks, verify the live Worker/API too.
9. For database tasks, provide a precise manual SQL step only when the assistant cannot execute it through an available connector; never pretend it was applied.
10. Record the result in this file before moving to the next phase.

## Manual-only queue

These require access that is not available through the repository connector and must be performed by the project owner when reached:
- Supabase SQL Editor execution of migrations.
- Supabase Storage/bucket settings if required.
- Cloudflare Worker secrets/login/deployment settings when connector access is unavailable.
- Any real-device visual confirmation that cannot be obtained programmatically.
- Real account email confirmation/reset-link interaction when the owner must open the email.

## Definition of done

Maak is DONE only when Customer + Provider + Admin are production-usable, the real marketplace/booking/chat/security flows are server-backed, no fake production data leaks, all critical responsive screens are polished, CI/deploy is green, and live verification has passed for every critical surface that can be checked.