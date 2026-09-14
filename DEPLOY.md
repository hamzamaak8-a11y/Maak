# Maak deployment runbook

## GitHub Pages frontend secrets

Configure these repository/environment secrets by **name only**:

- `MAAK_VITE_API_URL`
- `MAAK_VITE_SUPABASE_URL`
- `MAAK_VITE_SUPABASE_PUBLISHABLE_KEY`

These become `VITE_*` build-time values and therefore are browser-visible. Never put a service-role key in any `VITE_*` variable.

## E2E secrets

The isolated E2E workflow may use these names when an external test project is intentionally selected:

- `MAAK_E2E_SUPABASE_URL`
- `MAAK_E2E_SUPABASE_SERVICE_ROLE_KEY`
- `MAAK_E2E_PROVIDER_EMAIL`
- `MAAK_E2E_PROVIDER_PASSWORD`
- `MAAK_E2E_CUSTOMER_EMAIL`
- `MAAK_E2E_CUSTOMER_PASSWORD`
- `MAAK_E2E_ADMIN_EMAIL`
- `MAAK_E2E_ADMIN_PASSWORD`

The preferred release gate is the self-contained local Supabase CI path and does not require production credentials.

## Worker configuration

Worker configuration/secrets are names only and remain server-side:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ADMIN_TOKEN`
- `MAAK_ALLOW_ORIGIN`

`SUPABASE_SERVICE_ROLE_KEY` must never be exposed as a browser variable or committed to the repository.

## Production deployment sequence

1. Review and merge only after the release PR passes Build and isolated E2E gates.
2. **Migration reconciliation is a mandatory pre-deployment gate.** The repository migration ledger must be proven equivalent to the intended production baseline before any production migration command is run.
3. Until that reconciliation is explicitly approved by the Project Manager, **do not run `supabase db push` against production and do not run `supabase migration repair` against production**.
4. Do not modify `supabase_migrations.schema_migrations` manually as a workaround.
5. Configure the GitHub Pages frontend secret names above in the appropriate GitHub environment.
6. Keep `VITE_INCLUDE_SEED=false` for production.
7. Deploy through the existing GitHub Pages workflow. Do not run ad-hoc production builds with local credentials.
8. Perform the final public/browser smoke checks after deployment.

## Database migrations

Migrations under `supabase/migrations/` are the source of truth **only after the production baseline and migration ledger have been reconciled**.

Before the one-time reconciliation is approved:

- Use read-only catalog and `supabase_migrations.schema_migrations` queries to determine what is already deployed.
- Prove semantic equivalence before classifying a repository migration as already deployed under a different identity.
- Identify genuinely new release migrations separately from historical migrations that already exist in production.
- Keep production credentials and production database connections out of CI browser/E2E tests.

After the reconciliation is approved, apply only the resulting canonical migration path in order using the project's approved Supabase migration mechanism. Never skip a security migration required by the release.

## Final E2E gate

The release is not production-ready until the isolated CI E2E workflow has actually started Chromium, applied migrations to the non-production database, created fixtures, rendered the frontend, executed Playwright tests, and cleaned up the test environment.

## Rollback

Rollback means returning application traffic to the last known-good release and, when necessary, applying a pre-reviewed database rollback or forward-fix plan. Do not use destructive commands against production data as an emergency shortcut. Preserve audit history and investigate the failed release before changing database state.
