-- Maak least-privilege follow-up: listing refresh and trigger helpers are
-- server-internal and must never be callable by browser clients.
revoke all on function public.refresh_provider_listing(uuid) from public, anon, authenticated;
revoke all on function public.provider_profiles_refresh_listing() from public, anon, authenticated;
revoke all on function public.guard_profile_security_fields() from public, anon, authenticated;
revoke all on function public.guard_provider_security_fields() from public, anon, authenticated;
