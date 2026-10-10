# MAAK — mobile release guide

Everything below is under the single official account **hamzamaak8@gmail.com** (Expo, Apple Developer, Google Play,
Google Cloud, Supabase, Cloudflare). Nothing here publishes or pays for anything by itself.

## 0. State of the code
* Web is live on GitHub Pages; Worker `https://maak.hamzamaak8.workers.dev`; Supabase project already configured.
* Bundle id / package: `com.maak.app` · URL scheme: `maak://` · app version `1.0.0` (build numbers are auto-incremented by EAS).
* Legal pages ship with the web build: `/privacy.html`, `/terms.html`, `/delete-account.html`
  (`https://hamzamaak8-a11y.github.io/Maak/…`). Use these URLs in the store listings.
* In-app account deletion: *Profile → Security → Delete my account* (needs migration `20261007140000`).
* Report mechanism for users, reviews and messages + admin moderation queue (needs migration `20261007140100`).

> Admins use the separate panel (`docs/ADMIN_PANEL.md`), never the mobile app.

## 1. Database (Supabase SQL editor, in this order)
Already applied: `…120000_customer_favorites`, `…120100_public_provider_services`, `…130000_bootstrap_official_admin`.
To apply now: `20261007140000_delete_my_account.sql`, then `20261007140100_content_reports.sql`.

## 2. One-time tooling (on your computer)
```bash
npm install
npm install -g eas-cli
eas login            # official Expo account: hamzamaak8 (hamzamaak8@gmail.com)
eas whoami           # must print: hamzamaak8
# The EAS project "MAAK" is already linked in app.config.ts (owner hamzamaak8, projectId 0ad7c4c2-…).
# Do NOT run `eas init` again; if you ever must, use: eas init --id 0ad7c4c2-3fcf-4bb4-b37b-281e0e34c97c
```

## 3. Test builds
```bash
npm run eas:build:preview      # Android APK + iOS internal build (iOS needs an Apple Developer account)
```
Install on a real phone and run the checklist in section 6.

## 4. Store builds
```bash
npm run eas:build:production   # AAB for Google Play + IPA for App Store (EAS manages signing credentials)
eas submit -p android          # uploads to the Play "internal" track as a draft
eas submit -p ios              # uploads to TestFlight
```
Costs are on the owner's accounts: Apple Developer Program (yearly) and Google Play (one-time). New personal Play
accounts must run a closed test with a minimum number of testers for a minimum period before production access — check
the current Play Console requirement.

## 5. Store listing material
| Item | Value / note |
| --- | --- |
| Name | MAAK |
| Support / marketing URL | the web app URL |
| Privacy policy URL | `https://hamzamaak8-a11y.github.io/Maak/privacy.html` |
| Account deletion URL (Play) | `https://hamzamaak8-a11y.github.io/Maak/delete-account.html` |
| Icon | `assets/icon.png` (1024×1024) |
| Screenshots | take from a real device or the preview build: Home, Provider, Booking, Chat, Provider dashboard |
| Age rating | contains user-generated content (chat, reviews) → answer the UGC questions; no ads, no gambling, no payments |
| Reviewer access | give the reviewers a **customer** and a **provider** test account (create them under the official account) and describe how to test booking. Do not give an admin account. |

### Apple "App Privacy" answers (matches the privacy policy)
Collected and linked to the user, not used for tracking: **Contact info** (name, email, phone), **User content**
(messages, photos, reviews), **Identifiers** (user id), **Other** (address typed for a booking). Provider ID documents are
collected for verification. No data is used for third-party advertising or tracking. Purpose: app functionality, account management.

### Google Play "Data safety" answers
Data collected: personal info (name, email, phone, address), photos/files, messages, user IDs. Encrypted in transit: yes.
Deletion requested in-app and via URL: yes. Data shared with third parties: no (infrastructure processors only: Supabase,
Cloudflare, Google sign-in). No ads, no analytics SDK, no location, no financial info.

## 6. Real-device checklist
- [ ] Sign up with e-mail → confirmation mail → sign in → lands in the customer app.
- [ ] Android: *Continue with Google* completes and returns to the app (redirect `maak://auth-callback`).
- [ ] Forgot password → mail link opens the app → set a new password.
- [ ] Provider: apply with ID + photo (camera roll), see "Under review"; admin approves; provider space opens.
- [ ] Book with a provider; provider accepts → starts → completes; customer leaves a review.
- [ ] Chat both ways in real time; notification badge updates.
- [ ] Report a message / provider; admin sees it under *Reports*.
- [ ] Delete a test account (no open bookings) → returns to the welcome screen; the e-mail can sign up again.
- [ ] Arabic (RTL), French, English; light and dark; small phone and tablet.

## 7. Known gaps to decide before / after launch
* **iOS and Google sign-in:** Apple guideline 4.8 requires *Sign in with Apple* (or an equivalent) when a social login is
  offered, so Google sign-in is **hidden on iOS** (`GOOGLE_LOGIN_ENABLED` in `src/config/env.ts`). To offer Google on iOS,
  add Sign in with Apple *and* revoke Apple tokens on account deletion (server-side, needs Apple keys).
* **Blocking users:** reporting + admin suspension are implemented. A per-user "block" would need a change to the chat
  RPCs; confirm their deployed definitions first (production differs from `supabase/baseline`).
* **Deleted files:** the app removes a user's uploaded files through the Storage API (best effort). If a policy refuses,
  an orphan file can remain in the private bucket; purge `provider-documents/<user-id>` from the dashboard if needed.
* **Deletion cascades:** deleting an account also removes its bookings and reviews from the other party's history
  (stated in the privacy policy and the deletion screen).
* **Legal review:** the policy, terms and the 30-day manual-deletion promise are drafts for the owner to confirm with a
  lawyer (Moroccan Law 09-08 / CNDP formalities, governing law, company details).
* **Session storage:** the Supabase session lives in AsyncStorage (sandboxed; Android backups are disabled). Moving it
  to an encrypted store is a possible hardening step.
