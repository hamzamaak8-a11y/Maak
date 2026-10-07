-- maak — Admin verification (Sprint 8). Idempotent.
-- Assumes worker/db/profiles.sql and worker/db/provider-onboarding.sql have run.
--
-- Adds:
--   • provider_profiles.rejection_reason
--   • RLS SELECT policies so an admin (profiles.role = 'admin') can READ all
--     profiles, provider_profiles and provider_documents metadata, and sign
--     private documents in the provider-documents bucket.
--   • Two SECURITY DEFINER functions admin_approve_provider / admin_reject_provider
--     that re-check the caller is an admin and perform the privileged writes
--     (verification_status + role) on the admin's behalf. The existing guard
--     triggers block client-side status/role changes, so these functions assert
--     service_role for the transaction to perform the update safely server-side.
--
-- Run ONCE in the Supabase dashboard SQL editor. Safe to re-run.
-- Does NOT touch public.providers, does not weaken customer/provider access,
-- and adds no public bucket — documents stay private.

-- =========================================================================
-- 1. rejection_reason column on provider_profiles
-- =========================================================================
alter table public.provider_profiles
  add column if not exists rejection_reason text;

-- =========================================================================
-- 2. is_admin() helper (security definer — used by RLS policies)
-- =========================================================================
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

-- =========================================================================
-- 3. Admin READ policies (SELECT). Existing own-only policies are kept.
-- =========================================================================
alter table public.profiles enable row level security;
drop policy if exists "profiles_select_admin" on public.profiles;
create policy "profiles_select_admin" on public.profiles
  for select using (public.is_admin());

alter table public.provider_profiles enable row level security;
drop policy if exists "provider_profiles_select_admin" on public.provider_profiles;
create policy "provider_profiles_select_admin" on public.provider_profiles
  for select using (public.is_admin());

alter table public.provider_documents enable row level security;
drop policy if exists "provider_documents_select_admin" on public.provider_documents;
create policy "provider_documents_select_admin" on public.provider_documents
  for select using (public.is_admin());

-- =========================================================================
-- 4. Storage: admin can READ (sign) any object in the private bucket.
--    Signed URLs are short-lived and issued by the client; the object itself
--    stays private (no public bucket, no public URLs).
-- =========================================================================
drop policy if exists "provider_documents_storage_read_admin" on storage.objects;
create policy "provider_documents_storage_read_admin" on storage.objects
  for select using (bucket_id = 'provider-documents' and public.is_admin());

-- =========================================================================
-- 5. Admin actions (SECURITY DEFINER). Each re-verifies the caller is an admin
--    and performs the privileged writes server-side. A non-admin caller gets
--    'forbidden' and nothing changes.
-- =========================================================================
create or replace function public.admin_approve_provider(target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden: admin only';
  end if;
  -- The guard triggers allow service_role; assert it for this transaction so
  -- the update is permitted. Reverts at transaction end.
  perform set_config('request.jwt.claim.role', 'service_role', true);
  update public.provider_profiles
    set verification_status = 'approved', rejection_reason = null
    where id = target;
  update public.profiles
    set role = 'provider'
    where id = target and role in ('customer','provider');
end $$;

create or replace function public.admin_reject_provider(target uuid, reason text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden: admin only';
  end if;
  perform set_config('request.jwt.claim.role', 'service_role', true);
  update public.provider_profiles
    set verification_status = 'rejected', rejection_reason = reason
    where id = target;
end $$;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.admin_approve_provider(uuid) to authenticated;
grant execute on function public.admin_reject_provider(uuid, text) to authenticated;
