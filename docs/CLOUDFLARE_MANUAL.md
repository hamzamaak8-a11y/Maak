# Cloudflare Worker — Manual Production Checkpoint

The Worker code and configuration are committed to `main`, but this repository connector does not have permission to deploy Cloudflare Workers or manage Cloudflare secrets.

## Required production action

Deploy the latest `main` version of `wrangler.jsonc` + `worker/src/` to the existing Worker `maak`.

Use the existing Cloudflare deployment method already associated with this Worker. If using Wrangler locally:

```bash
npm ci --prefix worker
npm run deploy --prefix worker
```

Do not paste Cloudflare tokens or the Supabase service-role secret into chat.

## Required production values

- Worker name: `maak`
- Worker URL: `https://maak.i36508871.workers.dev`
- `MAAK_ALLOW_ORIGIN`: `https://hamzamaak8-a11y.github.io`
- `SUPABASE_URL`: `https://pjvayowrmqkhmzvlhwex.supabase.co`
- `SUPABASE_SERVICE_ROLE_KEY`: existing Cloudflare secret; keep it secret.

## Important change

The Worker no longer accepts the legacy `/admin/seed?token=...` query-string flow. Seed/demo data must not be a production API capability.

## Verification

After deployment:

1. Open `https://maak.i36508871.workers.dev/health` and confirm `{ "ok": true }`.
2. From the live Maak frontend origin, call `/api/providers` and confirm CORS allows `https://hamzamaak8-a11y.github.io`.
3. Confirm the API returns only real/published providers.
4. Confirm requests from an unrelated origin do not receive permissive wildcard CORS.
5. Confirm `/admin/seed` returns 404.
