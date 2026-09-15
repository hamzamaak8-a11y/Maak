# Maak — Product Identity v2: Source of Truth Record

Recorded before any redesign work, per Phase 1.

## SOURCE_BRANCH

`fix/maak-p0-visual-runtime`

## SOURCE_COMMIT

`9affd74` — `fix(mobile): align all Expo SDK 57 module versions` (2026-09-15 11:46 +0100)

## DEPLOYMENT_EVIDENCE

1. **Vercel URL slug match.** The provided deployment
   `https://maak-git-fix-maak-p0-visual-runtime-hamzamaak8-6491.vercel.app/` follows Vercel's
   git-integration preview naming convention `<project>-git-<branch-with-slashes-dashed>-<scope>.vercel.app`,
   which maps 1:1 to project `maak`, branch `fix/maak-p0-visual-runtime`, scope `hamzamaak8-6491`.
2. **Vercel management commits.** The branch tip contains an explicit run of Vercel deployment
   commits (`chore(vercel): trigger/refresh/redeploy preview…`, `fix(vercel): read Vite Supabase env
   from process env`, `chore(vercel): rebuild preview after env configuration`) dated 2026-09-15 —
   the same day as the deployment record, showing this branch actively drives the Vercel deployment.
3. **Ancestry.** `fix/maak-p0-visual-runtime` contains `origin/main` tip (`65df4ab`, merge-base) plus
   145 commits, and also contains every `ui-transplant/phase-*` redesign branch tip
   (`ui-transplant/phase-10-css-history-hygiene` is an ancestor). No other branch is a superset of it.
   Therefore `main` alone does NOT represent the deployed application.
4. **Deployment protection.** Both Vercel URLs are login-protected ("Protected Deployment – Vercel"),
   so HTML fingerprint comparison is not possible; the branch-tip commit is used as the closest
   verifiable reference.

## CURRENT_BUILD_COMMAND

`npm ci` → `npm run typecheck` → `npm run build` → `npm run qa:smoke`
(Vite build at repo root; the build script also mirrors `dist/index.html`, assets and PWA files into
`dist/admin/` and `dist/admin/login/` for the admin SPA routes.)

Note: the lock file on this branch was out of sync with `package.json` (missing `@playwright/test`
1.63.0 entries), breaking `npm ci`. Synced via `npm install` (lock file updated, no dependency
version changes beyond the declared range).

## CURRENT_DEPLOYMENT_ARCHITECTURE

- **Frontend host:** Vercel, project `maak` (scope `hamzamaak8-6491`), deploying the Vite app at the
  repository root. Supabase/API public variables are injected from the Vercel environment
  (`.env.production` is intentionally not committed on this branch; `.env.production.example` is the
  template). Worker origin historically also served from GitHub Pages under
  `https://hamzamaak8-a11y.github.io/Maak/` (router supports both `/` and `/Maak` bases; current
  production uses `VITE_BASE=./`).
- **Backend reads:** Cloudflare Worker `https://maak.i36508871.workers.dev`
  (`GET /api/providers`, `GET /api/providers/:id`, `GET /api/providers/:id/portfolio`) backed by
  Supabase REST with a service-role key held as a Worker secret. CORS allowlist:
  `https://hamzamaak8-a11y.github.io`.
- **Auth + data:** Supabase project `pjvayowrmqkhmzvlhwex`, publishable (anon) key only in the
  browser; sensitive mutations exclusively via RPCs (`create_booking`, `cancel_booking`,
  `accept/reject/start/complete booking`, `set_booking_price`, provider onboarding, reviews,
  availability, chat, notifications). RLS is the authorization boundary.
- **PWA:** `manifest.webmanifest`, `sw.js`, `icon-192.png`, `icon-512.png`, `maak-icon.svg`,
  `404.html` published from `public/` with base-path-relative URLs (validated by `scripts/smoke.mjs`).
- **Mobile:** an Expo client exists under `mobile/` (native build, separate CI); the web redesign does
  not touch it.

## Redesign branch

Work happens on the Arena session branch `arena/01a0a62b-maak`, reset to `9affd74`
(the proven deployed source) before any redesign work. No force pushes, no history rewrites.
