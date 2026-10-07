-- maak — Real booking system: bookings table, provider<->profile link,
-- SELECT-only RLS, and SECURITY DEFINER state-machine functions.
-- Idempotent, non-destructive. Assumes worker/db/profiles.sql and
-- worker/db/provider-onboarding.sql have been run.
-- Run ONCE in the Supabase dashboard SQL editor.

-- =========================================================================
-- 1. Link public.providers <-> provider_profiles (nullable, unique)
--    A public listing is bookable ONLY when linked to an approved provider profile.
-- =========================================================================
alter table public.providers
  add column if not exists provider_profile_id uuid
  references public.provider_profiles(id) on delete set null;

create unique index if not exists providers_provider_profile_id_uniq
  on public.providers(provider_profile_id) where provider_profile_id is not null;

-- =========================================================================
-- 2. bookings table
-- =========================================================================
create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  provider_id uuid not null references public.provider_profiles(id) on delete cascade,
  provider_listing_id integer references public.providers(id) on delete set null,
  service_category text not null,
  service_description text not null default '',
  service_date timestamptz,
  location_text text,
  customer_note text not null default '',
  provider_note text not null default '',
  status text not null default 'pending',
  rejection_reason text,
  customer_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  accepted_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz
);

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'bookings_status_check') then
    alter table public.bookings add constraint bookings_status_check
      check (status in ('pending','accepted','rejected','cancelled','in_progress','completed'));
  end if;
end $$;

create index if not exists bookings_customer_idx on public.bookings(customer_id);
create index if not exists bookings_provider_idx on public.bookings(provider_id);
create index if not exists bookings_status_idx on public.bookings(status);

-- =========================================================================
-- 3. updated_at trigger (function defined in profiles.sql; redefine here to be safe)
-- =========================================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists bookings_set_updated_at on public.bookings;
create trigger bookings_set_updated_at
  before update on public.bookings
  for each row execute function public.set_updated_at();

-- =========================================================================
-- 4. RLS — SELECT only. NO client INSERT/UPDATE/DELETE.
--    All mutations go through the SECURITY DEFINER functions below.
-- =========================================================================
alter table public.bookings enable row level security;

drop policy if exists "bookings_select_customer" on public.bookings;
create policy "bookings_select_customer" on public.bookings
  for select using (auth.uid() = customer_id);

drop policy if exists "bookings_select_provider" on public.bookings;
create policy "bookings_select_provider" on public.bookings
  for select using (
    exists (select 1 from public.provider_profiles pp
           where pp.id = auth.uid() and pp.id = bookings.provider_id)
  );

drop policy if exists "bookings_select_admin" on public.bookings;
create policy "bookings_select_admin" on public.bookings
  for select using (
    exists (select 1 from public.profiles p
           where p.id = auth.uid() and p.role = 'admin')
  );

-- =========================================================================
-- 5. State-machine functions (SECURITY DEFINER; auth.uid() = caller)
-- =========================================================================
create or replace function public.create_booking(
  p_provider_listing_id integer,
  p_service_category text,
  p_service_description text,
  p_service_date timestamptz,
  p_location_text text,
  p_customer_note text default ''
) returns public.bookings
language plpgsql security definer set search_path = public as $$
declare
  v_customer uuid := auth.uid();
  v_provider_profile_id uuid;
  v_customer_name text;
  v_row public.bookings;
begin
  if v_customer is null then
    raise exception 'not_authenticated';
  end if;
  if p_service_category is null or btrim(p_service_category) = '' then
    raise exception 'invalid_service';
  end if;

  select provider_profile_id into v_provider_profile_id
    from public.providers where id = p_provider_listing_id;
  if not found then
    raise exception 'provider_not_found';
  end if;
  if v_provider_profile_id is null then
    raise exception 'provider_not_linked';
  end if;

  if not exists (
    select 1 from public.provider_profiles pp
    where pp.id = v_provider_profile_id and pp.verification_status = 'approved'
  ) then
    raise exception 'provider_not_bookable';
  end if;

  select full_name into v_customer_name from public.profiles where id = v_customer;

  insert into public.bookings (
    customer_id, provider_id, provider_listing_id,
    service_category, service_description, service_date, location_text,
    customer_note, status, customer_name
  ) values (
    v_customer, v_provider_profile_id, p_provider_listing_id,
    p_service_category, coalesce(p_service_description, ''),
    p_service_date, p_location_text,
    coalesce(p_customer_note, ''), 'pending', v_customer_name
  ) returning * into v_row;

  return v_row;
end $$;

create or replace function public.cancel_booking(p_booking_id uuid)
returns public.bookings
language plpgsql security definer set search_path = public as $$
declare v_row public.bookings;
begin
  select * into v_row from public.bookings where id = p_booking_id;
  if not found then raise exception 'not_found'; end if;
  if v_row.customer_id <> auth.uid() then raise exception 'forbidden'; end if;
  if v_row.status <> 'pending' then raise exception 'invalid_transition'; end if;
  update public.bookings set status = 'cancelled', cancelled_at = now()
    where id = p_booking_id returning * into v_row;
  return v_row;
end $$;

create or replace function public.accept_booking(p_booking_id uuid)
returns public.bookings
language plpgsql security definer set search_path = public as $$
declare v_row public.bookings;
begin
  select * into v_row from public.bookings where id = p_booking_id;
  if not found then raise exception 'not_found'; end if;
  if v_row.provider_id <> auth.uid() then raise exception 'forbidden'; end if;
  if v_row.status <> 'pending' then raise exception 'invalid_transition'; end if;
  update public.bookings set status = 'accepted', accepted_at = now()
    where id = p_booking_id returning * into v_row;
  return v_row;
end $$;

create or replace function public.reject_booking(p_booking_id uuid, p_reason text)
returns public.bookings
language plpgsql security definer set search_path = public as $$
declare v_row public.bookings;
begin
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'reason_required';
  end if;
  select * into v_row from public.bookings where id = p_booking_id;
  if not found then raise exception 'not_found'; end if;
  if v_row.provider_id <> auth.uid() then raise exception 'forbidden'; end if;
  if v_row.status <> 'pending' then raise exception 'invalid_transition'; end if;
  update public.bookings set status = 'rejected', rejection_reason = p_reason
    where id = p_booking_id returning * into v_row;
  return v_row;
end $$;

create or replace function public.start_booking(p_booking_id uuid)
returns public.bookings
language plpgsql security definer set search_path = public as $$
declare v_row public.bookings;
begin
  select * into v_row from public.bookings where id = p_booking_id;
  if not found then raise exception 'not_found'; end if;
  if v_row.provider_id <> auth.uid() then raise exception 'forbidden'; end if;
  if v_row.status <> 'accepted' then raise exception 'invalid_transition'; end if;
  update public.bookings set status = 'in_progress', started_at = now()
    where id = p_booking_id returning * into v_row;
  return v_row;
end $$;

create or replace function public.complete_booking(p_booking_id uuid)
returns public.bookings
language plpgsql security definer set search_path = public as $$
declare v_row public.bookings;
begin
  select * into v_row from public.bookings where id = p_booking_id;
  if not found then raise exception 'not_found'; end if;
  if v_row.provider_id <> auth.uid() then raise exception 'forbidden'; end if;
  if v_row.status <> 'in_progress' then raise exception 'invalid_transition'; end if;
  update public.bookings set status = 'completed', completed_at = now()
    where id = p_booking_id returning * into v_row;
  return v_row;
end $$;

-- =========================================================================
-- 6. Grant execute to anon + authenticated only (revoke from public)
-- =========================================================================
revoke all on function public.create_booking(integer,text,text,timestamptz,text,text) from public;
revoke all on function public.cancel_booking(uuid) from public;
revoke all on function public.accept_booking(uuid) from public;
revoke all on function public.reject_booking(uuid,text) from public;
revoke all on function public.start_booking(uuid) from public;
revoke all on function public.complete_booking(uuid) from public;
grant execute on function public.create_booking(integer,text,text,timestamptz,text,text) to anon, authenticated;
grant execute on function public.cancel_booking(uuid) to anon, authenticated;
grant execute on function public.accept_booking(uuid) to anon, authenticated;
grant execute on function public.reject_booking(uuid,text) to anon, authenticated;
grant execute on function public.start_booking(uuid) to anon, authenticated;
grant execute on function public.complete_booking(uuid) to anon, authenticated;
