# MAAK deployment runbook

## Release prerequisites

1. Keep `main` as the reviewed release source and require a successful Build Maak run before release review.
2. Apply all Supabase migrations to the intended non-production or production database through the approved database migration mechanism before using a release that depends on them.
3. Do not put service-role keys, admin tokens, passwords, or E2E credentials in this repository.

## GitHub Pages frontend secrets

Configure these GitHub Actions secrets by name:

- `MAAK_VITE_API_URL`
- `MAAK_VITE_SUPABASE_URL`
- `MAAK_VITE_SUPABASE_PUBLISHABLE_KEY`

These values become `VITE_*` variables at frontend build time. `VITE_*` variables are browser-visible and must never contain service-role credentials.

The Pages workflow also enforces:

- `VITE_BASE=./`
- `VITE_INCLUDE_SEED=false`

## E2E secrets

The manual `.github/workflows/e2e.yml` workflow requires these GitHub Actions secrets:

- `MAAK_E2E_SUPABASE_URL`
- `MAAK_E2E_SUPABASE_SERVICE_ROLE_KEY`
- `MAAK_E2E_PROVIDER_EMAIL`
- `MAAK_E2E_PROVIDER_PASSWORD`
- `MAAK_E2E_CUSTOMER_EMAIL`
- `MAAK_E2E_CUSTOMER_PASSWORD`
- `MAAK_E2E_ADMIN_EMAIL`
- `MAAK_E2E_ADMIN_PASSWORD`

The E2E Supabase project must be isolated from production. Never point E2E seeding or cleanup at the production database.

## Worker configuration

Configure Worker values/secrets by name only:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `MAAK_ALLOW_ORIGIN`
- `ADMIN_TOKEN`

`SUPABASE_SERVICE_ROLE_KEY` is a server-side secret. It must never be exposed as a `VITE_*` browser variable or embedded in frontend source.

## Deployment sequence

1. Review the release branch and confirm the new Build Maak workflow is successful.
2. Apply pending Supabase migrations to the intended isolated environment first, then to production through the approved migration process.
3. Confirm the Pages workflow receives the three `MAAK_VITE_*` secrets and keeps seed data disabled.
4. Build and validate the frontend artifact.
5. Deploy only after the E2E gate and manual browser QA pass.
6. Verify public, authenticated, provider, and admin surfaces after deployment.

## E2E gate

Run the manual E2E workflow only against the isolated E2E Supabase project. Seed and cleanup must use only the E2E credentials above. A failed test is a release blocker; do not skip or disable tests to force a green run.

## Rollback

If a release introduces a verified application defect, stop further deployment activity and return the deployment pointer to the previously approved release artifact through the normal GitHub Pages release process. Preserve database history and do not delete or rewrite production data. Database changes should be rolled back only through an explicitly reviewed corrective migration when necessary.
