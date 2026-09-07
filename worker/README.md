# Maak Worker

Cloudflare Worker for the public Maak marketplace API. It reads only published, real, provider-linked listings from Supabase through PostgREST.

## Production configuration

The Wrangler configuration is at the repository root in `wrangler.jsonc` and points to `worker/src/index.ts`.

Required Worker values:

- `SUPABASE_URL` — configured as a non-secret variable in `wrangler.jsonc`.
- `MAAK_ALLOW_ORIGIN` — configured as a non-secret variable in `wrangler.jsonc`.
- `SUPABASE_SERVICE_ROLE_KEY` — **secret**, configured in Cloudflare Worker secrets. Never commit or expose it to the frontend.

## Endpoints

- `GET /health` — service health check.
- `GET /api/providers` — published real providers only.
- `GET /api/providers/:id` — one published real provider only.

There is no public seed, admin-token, or provider-write endpoint.

## Local development

From `worker/`:

    npm install
    npm run dev

For local secrets, use a gitignored Wrangler `.dev.vars` file. Never put the service-role key in frontend environment variables.

## Database

The SQL files under `worker/db/` are the source-controlled database migrations and controlled development fixtures. Production marketplace visibility is enforced by `listing_kind = 'real'`, a linked `provider_profile_id`, and a non-null `published_at` value.

Provider verification, bookings, messaging, and admin actions are performed through Supabase RLS/RPCs; they are not exposed as Worker write endpoints.

## Verification

    npm run typecheck
    npm run build
    npm run deploy
