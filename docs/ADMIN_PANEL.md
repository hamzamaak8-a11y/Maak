# MAAK administration panel (separate from the app)

The administration panel is **not part of the customer/provider app**. It is the same codebase built with
`EXPO_PUBLIC_APP_TARGET=admin`, and it is published from its **own private address**:

| | App (customers, providers) | Admin panel |
| --- | --- | --- |
| Build | `npx expo export --platform web` / EAS | `EXPO_PUBLIC_APP_TARGET=admin npx expo export --platform web` |
| First screen | Welcome, browse as a guest | Admin sign-in only (no sign-up, no browsing) |
| Admin account | refused ("Administrator accounts cannot use the app") | accepted |
| Customer / provider account | accepted | refused ("This account is not an administrator") |
| Search engines | indexable | `noindex, nofollow` |

The phone apps (EAS builds) are always the **app** target, so the admin UI never ships to the stores in a way that can be used.

## Publishing the panel (GitHub Pages workflow)
1. GitHub → *Settings → Secrets and variables → Actions → Variables* → new variable `MAAK_ADMIN_PATH`
   with a long unguessable value (8–64 chars: letters, digits, `-`, `_`), for example `ops-7f3a9c2e41d8`.
   Do not put this value in the repository.
2. Run the workflow *Deploy web app (GitHub Pages)*. The panel is then at
   `https://hamzamaak8-a11y.github.io/Maak/<MAAK_ADMIN_PATH>/`.
3. Supabase → *Authentication → URL Configuration → Redirect URLs*: add
   `https://hamzamaak8-a11y.github.io/Maak/<MAAK_ADMIN_PATH>/**` (needed for Google sign-in and e-mail links on the panel).
4. Open the panel and sign in with the official admin account. Bookmark the address; share it with nobody.

## Security notes
* The address is only a *convenience* layer. The real protection is server-side: every admin RPC and policy checks
  `profiles.role = 'admin'` and `account_status = 'active'`. A non-admin who finds the address cannot read or change anything.
* GitHub Pages serves the app and the panel from the same origin, so they share the browser's stored session.
  For stronger isolation later, serve the panel from its own sub-domain (e.g. `admin.<your-domain>`) via Cloudflare Pages
  and set `EXPO_BASE_URL` empty for that build.
* Keep a single admin (the official account) and review *Audit log* regularly.

## Admin tools v2 (dashboard, people, announcements)

Required once, in the Supabase SQL editor: `supabase/migrations/20261008100000_admin_tools.sql`.

- **Worker**: redeploy `worker/` (`npx wrangler deploy`). The new admin endpoints (create user, CSV import) need the secret
  `SUPABASE_SERVICE_ROLE_KEY` (`npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY`); the Worker verifies that the caller is an active admin first.
- **Supabase → Auth → URL configuration**: add the admin-panel URL (`<site>/<MAAK_ADMIN_PATH>`) to the redirect URLs.
- The panel works on phones (bottom bar + "More") and desktop (sidebar).
