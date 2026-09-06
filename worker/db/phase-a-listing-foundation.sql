-- maak — Phase A: Real Provider Profile Foundation. Idempotent, non-destructive.
-- Adds real marketplace fields to provider_profiles, relaxes legacy NOT NULL
-- columns on public.providers that have no true source for a real listing,
-- tags seed rows, and installs a secure listing-projection mechanism that
-- publishes exactly one real listing per approved provider — without ever
-- fabricating price/rating/distance/availability.
--
-- Assumes worker/db/profiles.sql, provider-onboarding.sql, bookings.sql and
-- admin-verification.sql have been run. Run ONCE in the Supabase dashboard SQL
-- editor. Safe to re-run. Does NOT delete seed rows, does NOT convert
-- public.providers to a view, does NOT weaken RLS, does NOT expose service_role.

-- =========================================================================
-- 1. provider_profiles: real marketplace data fields
-- =========================================================================
alter table public.provider_profiles
  add column if not exists services text[];
alter table public.provider_profiles
  add column if not exists price_from numeric(10,2);
alter table public.provider_profiles
  add column if not exists service_radius_km integer;
alter table public.provider_profiles
  add column if not exists profile_photo_public boolean not null default false;

-- =========================================================================
-- 2. public.providers: relax legacy NOT NULL columns with no true source for
--    a real listing. Existing seed rows keep their values; only the constraint
--    is relaxed so a real listing can be inserted with NULL for fields we do
--    not fabricate.
-- =========================================================================
alter table public.providers alter column distance drop not null;
alter table public.providers alter column price drop not null;
alter table public.providers alter column rating drop not null;
alter table public.providers alter column image drop not null;
alter table public.providers alter column available drop not null;
alter table public.providers alter column experience drop not null;
alter table public.providers alter column intro drop not null;

alter table public.providers add column if not exists listing_kind text not null default 'seed';
alter table public.providers add column if not exists published_at timestamptz;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'providers_listing_kind_check') then
    alter table public.providers add constraint providers_listing_kind_check
      check (listing_kind in ('seed','real'));
  end if;
end $$;

-- Tag existing seed rows. New real listings always use listing_kind = 'real'.
update public.providers set listing_kind = 'seed'
  where provider_profile_id is null and (listing_kind is null or listing_kind = 'seed');

-- =========================================================================
-- 3. Integer id sequence for new real listings (seed ids 1..4 stay untouched).
-- =========================================================================
create sequence if not exists public.providers_id_seq as integer start with 100;
do $$
declare v_max integer;
begin
  select coalesce(max(id), 0) into v_max from public.providers;
  if v_max >= 100 then
    perform setval('public.providers_id_seq', v_max, true);
  else
    perform setval('public.providers_id_seq', 100, false);
  end if;
end $$;
alter table public.providers alter column id set default nextval('public.providers_id_seq');

-- =========================================================================
-- 4. refresh_provider_listing(): build/refresh the single real listing for an
--    approved provider, driven from the single source of truth (profiles +
--    provider_profiles). Never fabricates distance/rating/image/availability.
--    Publishes (published_at = now()) only when the services list is set and
--    non-empty; otherwise the row exists but stays UNPUBLISHED. SECURITY
--    DEFINER so the AFTER-UPDATE trigger can write public.providers (which has
--    no RLS and is otherwise service_role only).
-- =========================================================================
create or replace function public.refresh_provider_listing(p_provider_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_prof text;
  v_full_name text;
  v_city text;
  v_bio text;
  v_exp int;
  v_services text[];
  v_price numeric;
  v_services_json jsonb;
  v_price_text text;
  v_exp_text text;
  v_published timestamptz;
  v_existing integer;
begin
  select pp.profession, p.full_name, p.city, pp.bio, pp.experience_years,
         pp.services, pp.price_from
    into v_prof, v_full_name, v_city, v_bio, v_exp, v_services, v_price
    from public.provider_profiles pp
    join public.profiles p on p.id = pp.id
    where pp.id = p_provider_profile_id;

  if not found then
    return;
  end if;

  -- Minimum identity required before any real listing row can exist.
  if v_full_name is null or v_prof is null or v_city is null then
    delete from public.providers
      where provider_profile_id = p_provider_profile_id and listing_kind = 'real';
    return;
  end if;

-- NOTE: PostgreSQL has no text[] -> jsonb cast (SQLSTATE 42846).
  -- to_jsonb(text[]) produces the correct JSON array.
  v_services_json := to_jsonb(coalesce(v_services, ARRAY[]::text[]));
  v_price_text    := case when v_price is null then null else v_price::text end;
  v_exp_text      := case when v_exp is null then null else v_exp::text || ' سنوات' end;

  -- Publish only when real marketplace data (services) is provided & non-empty.
  if v_services is not null and array_length(v_services, 1) > 0 then
    v_published := now();
  else
    v_published := null;
  end if;

  select id into v_existing from public.providers
    where provider_profile_id = p_provider_profile_id and listing_kind = 'real';

  if found then
    update public.providers set
      name           = v_full_name,
      job            = v_prof,
      city           = v_city,
      distance       = null,
      price          = v_price_text,
      rating         = null,
      reviews        = 0,
      image          = null,
      available      = null,
      services       = v_services_json,
      experience     = v_exp_text,
      intro          = v_bio,
      published_at   = v_published
    where id = v_existing;
  else
    insert into public.providers (
      name, job, city, distance, price, rating, reviews, image, available,
      services, experience, intro, provider_profile_id, listing_kind, published_at
    ) values (
      v_full_name, v_prof, v_city, null, v_price_text, null, 0, null, null,
      v_services_json, v_exp_text, v_bio, p_provider_profile_id, 'real', v_published
    );
  end if;
end $$;

-- =========================================================================
-- 5. Trigger: on provider_profiles insert/update, refresh the listing when
--    approved; unpublish when leaving approved. The guard trigger blocks
--    client status changes, so this fires legitimately via the admin approve
--    function (service_role) or the provider marketplace-edit function.
-- =========================================================================
create or replace function public.provider_profiles_refresh_listing()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.verification_status = 'approved' then
    perform public.refresh_provider_listing(new.id);
  elsif old.verification_status = 'approved' and new.verification_status <> 'approved' then
    update public.providers
      set published_at = null, available = null
      where provider_profile_id = new.id and listing_kind = 'real';
  end if;
  return new;
end $$;

drop trigger if exists provider_profiles_refresh_listing on public.provider_profiles;
create trigger provider_profiles_refresh_listing
  after insert or update on public.provider_profiles
  for each row execute function public.provider_profiles_refresh_listing();

-- =========================================================================
-- 6. Provider self-edit of marketplace fields (only their own; only these 4).
--    Authorization is enforced EXPLICITLY and up front:
--      * auth.uid() must be the owner (update is scoped `where id = auth.uid()`);
--      * profiles.role MUST be 'provider'  (rejects customers / any non-provider);
--      * provider_profiles.verification_status MUST be 'approved' (rejects
--        draft/pending/rejected/suspended — those edit via the onboarding
--        RLS upsert, not through this privileged RPC).
--    The caller cannot touch verification_status, role, or listing_kind here.
--    The service_role claim is asserted for this transaction only (local =>
--    true, reverts at txn end) so the verification_status guard trigger allows
--    the update to an APPROVED profile; the AFTER-UPDATE trigger then re-syncs
--    the listing. A provider cannot create or edit a listing for another user.
-- =========================================================================
create or replace function public.update_provider_marketplace_profile(
  p_services text[],
  p_price_from numeric,
  p_service_radius_km integer,
  p_profile_photo_public boolean
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_role text;
  v_status text;
begin
  if auth.uid() is null then
    raise exception 'not_authenticated';
  end if;

  -- Single authoritative check of the caller's role + verification state.
  select p.role, pp.verification_status
    into v_role, v_status
    from public.profiles p
    join public.provider_profiles pp on pp.id = p.id
    where p.id = auth.uid();

  if not found then
    raise exception 'no_provider_profile';
  end if;
  if v_role <> 'provider' then
    raise exception 'forbidden: provider only';
  end if;
  if v_status <> 'approved' then
    raise exception 'forbidden: profile not approved';
  end if;

  -- Light input sanity (the provider may not publish nonsensical values).
  if p_price_from is not null and p_price_from < 0 then
    raise exception 'invalid_price';
  end if;
  if p_service_radius_km is not null and p_service_radius_km < 0 then
    raise exception 'invalid_radius';
  end if;

  -- Bypass the verification_status guard trigger (which blocks client updates
  -- to approved profiles) for this transaction only; reverts at transaction end.
  perform set_config('request.jwt.claim.role', 'service_role', true);
  update public.provider_profiles
    set services              = p_services,
        price_from            = p_price_from,
        service_radius_km     = p_service_radius_km,
        profile_photo_public  = p_profile_photo_public
    where id = auth.uid();
end $$;

grant execute on function public.update_provider_marketplace_profile(text[], numeric, integer, boolean)
  to authenticated;
