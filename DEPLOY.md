# Maak — Deploy

The frontend is hosted on GitHub Pages; the public API is a Cloudflare Worker; the database is Supabase PostgreSQL reached over the Supabase REST (PostgREST) API. The Worker uses pure fetch — no database driver, no nodejs_compat, no Hyperdrive, no filesystem.

## Architecture

    User -> maak PWA (GitHub Pages) -> Cloudflare Worker (maak) -> Supabase REST (PostgREST) -> PostgreSQL (providers)

The Worker never opens a TCP socket. It calls the Supabase REST endpoint with the service_role key. Simplest production-safe option for Workers; free, no card.

## IMPORTANT: wrangler config location

The Cloudflare Git-based Workers Build looks for `wrangler.jsonc` at the REPO ROOT. The config is therefore committed at the repo root as `wrangler.jsonc` (name `maak`, main `worker/src/index.ts`). Without a root config Cloudflare falls back to the frontend Vite build and deploys Static Assets (no Worker URL, no /health). The root config is what makes it a real fetch-handler Worker with a *.workers.dev URL.

## 1) Supabase (manual, once)

- Create a project at supabase.com.
- In the SQL editor, paste and run worker/db/schema.sql to create the providers table.
- Project Settings -> API: copy Project URL (-> SUPABASE_URL) and service_role secret (-> SUPABASE_SERVICE_ROLE_KEY, SECRET — never commit).

## 2) Worker secrets (manual)

From the REPO ROOT:

    npx wrangler login       # one-time; free, no card
    npx wrangler secret put SUPABASE_URL
    npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY
    npx wrangler secret put ADMIN_TOKEN

wrangler reads the root wrangler.jsonc, so the secrets attach to the Worker named `maak`.

MAAK_ALLOW_ORIGIN is a non-secret var already set in wrangler.jsonc (repo root). Change it if your frontend runs on a different domain.

Local dev: put the same four keys as NAME=VALUE lines in `.dev.vars` at the REPO ROOT (gitignored), then from worker/: `npm run dev` (wrangler dev --config ../wrangler.jsonc).

## 3) Create the table + seed (idempotent)

Table: paste worker/db/schema.sql in the Supabase SQL editor (once). Seed the 4 providers EITHER way:

- HTTP (no Node, no filesystem): after deploy, call
    curl -X POST "https://maak.<sub>.workers.dev/admin/seed?token=<ADMIN_TOKEN>"
- OR paste worker/db/seed.sql into the Supabase SQL editor.

Both upsert on conflict (id); safe to run repeatedly.

## 4) Deploy the Worker

Production (Cloudflare Git-based Workers Build) — connect the repo in the Cloudflare dashboard and set:
- Root directory: (empty / repo root)
- Build command:  npm install      # optional; worker has no runtime npm deps
- Deploy command: npx wrangler deploy

On push, Cloudflare runs the deploy command from the repo root, finds wrangler.jsonc, bundles worker/src/index.ts, and updates the `maak` Worker as a fetch handler.

Manual (from repo root):
    npx wrangler deploy

Or from worker/: `npm run deploy` (uses the root wrangler.jsonc via --config).

Wrangler prints the public URL, e.g. https://maak.<sub>.workers.dev.

Verify:
    curl https://maak.<sub>.workers.dev/health          # {"ok":true}
    curl https://maak.<sub>.workers.dev/api/providers
    curl https://maak.<sub>.workers.dev/api/providers/1

## 5) Point the published frontend at the Worker

Commit .env.production at the repo root:
    VITE_API_URL=https://maak.<sub>.workers.dev

Vite auto-loads .env.production during build, so the GitHub Pages build picks up the public API with NO workflow change.

## 6) End-to-end test

Open https://hamzamaak8-a11y.github.io/Maak/ — providers appear from the live API.

## Secrets / variables

- SUPABASE_URL               : Worker SECRET (wrangler secret put)
- SUPABASE_SERVICE_ROLE_KEY  : Worker SECRET — bypasses RLS; never commit
- ADMIN_TOKEN                : Worker SECRET — protects POST /admin/seed
- MAAK_ALLOW_ORIGIN          : Worker VAR (wrangler.jsonc) — CORS origin
- VITE_API_URL               : frontend build-time (.env.production) — public URL, not secret

## Notes

- No DATABASE_URL and no password is ever committed. All secrets go through wrangler secret put.
- The Cloudflare Worker is the only backend.
- No filesystem use anywhere; init/seed are SQL (Supabase editor) or the HTTP /admin/seed endpoint.
- The wrangler config MUST stay at the repo root for the Cloudflare Git-based build to see it.

## Sprint 8 — Admin verification (manual, once)

Run `worker/db/admin-verification.sql` in the Supabase SQL editor (idempotent). It adds `provider_profiles.rejection_reason`, admin READ policies (profiles / provider_profiles / provider_documents + the private `provider-documents` bucket), and two SECURITY DEFINER functions `admin_approve_provider` / `admin_reject_provider` that re-check the caller is an admin before changing verification status or the user's role. No Worker change is required — privileged writes run server-side in Postgres.

To grant yourself admin access (client role changes are blocked by a trigger, so this must run as the service role / SQL editor):

    update public.profiles set role = 'admin' where id = '<your-auth-user-id>';

The Admin shell (shown when `profiles.role = 'admin'`) then lists real pending applications, lets you review documents via short-lived signed URLs, and approve or reject (with a stored reason that the provider sees).

