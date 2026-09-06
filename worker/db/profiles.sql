-- maak — user & role foundation.
-- Creates: public.profiles, public.provider_profiles, RLS, secure policies,
-- and an idempotent trigger that auto-creates a CUSTOMER profile on signup.
--
-- Run ONCE in the Supabase dashboard SQL editor (SQL > New query).
-- Idempotent: safe to re-run. Does NOT touch public.providers or existing data.

-- =========================================================================
-- 1. profiles  (1:1 with auth.users)
-- =========================================================================
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'customer',
  full_name text,
  phone text,
  city text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'profiles_role_check') then
    alter table public.profiles add constraint profiles_role_check
      check (role in ('customer','provider','admin'));
  end if;
end $$;

-- =========================================================================
-- 2. provider_profiles  (verification foundation; 1:1 with profiles)
-- =========================================================================
create table if not exists public.provider_profiles (
  id uuid primary key references public.profiles(id) on delete cascade,
  profession text,
  verification_status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'provider_profiles_verification_status_check') then
    alter table public.provider_profiles add constraint provider_profiles_verification_status_check
      check (verification_status in ('draft','pending','approved','rejected','suspended'));
  end if;
end $$;

-- =========================================================================
-- 3. updated_at maintenance (shared)
-- =========================================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

drop trigger if exists provider_profiles_set_updated_at on public.provider_profiles;
create trigger provider_profiles_set_updated_at
  before update on public.provider_profiles
  for each row execute function public.set_updated_at();

-- =========================================================================
-- 4. Row Level Security
--    (RLS enabled but NOT forced, so the security-definer trigger below can
--     insert profiles as the table owner, bypassing RLS.)
-- =========================================================================
alter table public.profiles enable row level security;
alter table public.provider_profiles enable row level security;

-- A user may read/update ONLY their own profile. No client INSERT
-- (profiles are created by the trigger below, always as 'customer').
drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- A provider may read/update ONLY their own provider profile.
-- No client INSERT/DELETE — onboarding will use the service_role later.
drop policy if exists "provider_profiles_select_own" on public.provider_profiles;
create policy "provider_profiles_select_own" on public.provider_profiles
  for select using (auth.uid() = id);

drop policy if exists "provider_profiles_update_own" on public.provider_profiles;
create policy "provider_profiles_update_own" on public.provider_profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- =========================================================================
-- 5. Guards: a client may NOT change role or verification_status.
--    Only the service_role (server-side) or a direct DB connection
--    (dashboard admin, no PostgREST JWT) may change them.
-- =========================================================================
create or replace function public.guard_role_change()
returns trigger language plpgsql as $$
declare actor text;
begin
  actor := current_setting('request.jwt.claim.role', true);
  if actor is null or actor = 'service_role' then
    return new;
  end if;
  if new.role is distinct from old.role then
    raise exception 'not allowed to change role';
  end if;
  return new;
end $$;

drop trigger if exists profiles_guard_role on public.profiles;
create trigger profiles_guard_role
  before update on public.profiles
  for each row execute function public.guard_role_change();

create or replace function public.guard_verification_status_change()
returns trigger language plpgsql as $$
declare actor text;
begin
  actor := current_setting('request.jwt.claim.role', true);
  if actor is null or actor = 'service_role' then
    return new;
  end if;
  if new.verification_status is distinct from old.verification_status then
    raise exception 'not allowed to change verification_status';
  end if;
  return new;
end $$;

drop trigger if exists provider_profiles_guard_status on public.provider_profiles;
create trigger provider_profiles_guard_status
  before update on public.provider_profiles
  for each row execute function public.guard_verification_status_change();

-- =========================================================================
-- 6. Auto-create a customer profile on signup (idempotent)
--    security definer -> runs as the owner, bypasses RLS.
-- =========================================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, role, full_name)
  values (
    new.id,
    'customer',
    coalesce(new.raw_user_meta_data ->> 'full_name', '')
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
