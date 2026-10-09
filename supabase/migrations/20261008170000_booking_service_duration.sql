-- create_booking: three gaps closed, all enforced in the database (the app only mirrors them).
--
-- 1. PAUSED LISTING. A provider who pauses their listing (providers.available = false) could still be booked by calling the RPC directly:
--    the screen refused, the function did not. It now refuses with provider_not_bookable, like get_provider_availability.
-- 2. SERVICE DURATION. A service of 120 minutes reserved only one hour, so the next hour looked free while the provider was still busy.
--    The reserved slot now lasts as long as the chosen service (default 60 minutes when the service has no duration or none is chosen);
--    the existing exclusion constraint on booking_slots then forbids any overlap, whatever the lengths. Existing bookings are NOT touched.
-- 3. ACTIVE PRICE LIST. An optional p_service_id books a service from the provider's price list: it must belong to that provider and be active
--    (service_unavailable otherwise). The booking stores which service, its duration, and starts with the list price and currency
--    (the provider can still change the price until work starts, see booking_money_rules). Without p_service_id the request is a free
--    request exactly as before (name required, one hour), so nothing that worked is refused.
--
-- The old 6-argument function is replaced (a second overload would make every 6-argument call ambiguous); old app versions keep working
-- because the new argument has a default.

alter table public.bookings
  add column if not exists provider_service_id uuid references public.provider_services(id) on delete set null,
  add column if not exists service_duration_minutes integer;
alter table public.bookings drop constraint if exists bookings_service_duration_positive;
alter table public.bookings add constraint bookings_service_duration_positive check (service_duration_minutes is null or service_duration_minutes > 0);

drop function if exists public.create_booking(integer, text, text, timestamptz, text, text);

create or replace function public.create_booking(
  p_provider_listing_id integer, p_service_category text, p_service_description text, p_service_date timestamptz,
  p_location_text text, p_customer_note text default '', p_service_id uuid default null)
returns public.bookings
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_customer uuid := public.require_auth_uid();
  v_customer_status text; v_provider_profile_id uuid; v_provider_status text; v_verification text; v_customer_name text;
  v_row public.bookings; v_slot_end timestamptz; v_day integer; v_start time; v_has_window boolean;
  v_available boolean; v_svc public.provider_services%rowtype; v_minutes integer := 60; v_category text;
begin
  select account_status, full_name into v_customer_status, v_customer_name from public.profiles where id = v_customer and role = 'customer';
  if not found or v_customer_status is distinct from 'active' then raise exception 'forbidden'; end if;
  if p_service_date is null or p_service_date <= now() then raise exception 'invalid_service_date'; end if;
  select provider_profile_id, available into v_provider_profile_id, v_available
    from public.providers where id = p_provider_listing_id and listing_kind = 'real' and published_at is not null;
  if not found or v_provider_profile_id is null then raise exception 'provider_not_found'; end if;
  select pp.verification_status, pr.account_status into v_verification, v_provider_status
    from public.provider_profiles pp join public.profiles pr on pr.id = pp.id where pp.id = v_provider_profile_id;
  if not found or v_verification is distinct from 'approved' or v_provider_status is distinct from 'active' then raise exception 'provider_not_bookable'; end if;
  if v_available is not distinct from false then raise exception 'provider_not_bookable'; end if;

  if p_service_id is not null then
    select * into v_svc from public.provider_services s where s.id = p_service_id and s.provider_id = v_provider_profile_id and s.is_active;
    if not found then raise exception 'service_unavailable'; end if;
    v_category := btrim(v_svc.name);
    if v_svc.duration_minutes is not null then v_minutes := v_svc.duration_minutes; end if;
    if v_minutes > 720 then raise exception 'invalid_service_duration'; end if;
  else
    if p_service_category is null or btrim(p_service_category) = '' then raise exception 'invalid_service'; end if;
    v_category := btrim(p_service_category);
  end if;

  v_slot_end := p_service_date + make_interval(mins => v_minutes);
  if (p_service_date at time zone current_setting('TIMEZONE'))::date is distinct from (v_slot_end at time zone current_setting('TIMEZONE'))::date then raise exception 'invalid_service_date'; end if;
  v_day := extract(dow from p_service_date)::integer; v_start := p_service_date::time;
  select exists (select 1 from public.provider_availability pa
                 where pa.provider_id = p_provider_listing_id and pa.day_of_week = v_day and pa.is_available
                   and pa.start_time <= v_start and pa.end_time >= v_slot_end::time) into v_has_window;
  if not v_has_window then raise exception 'provider_unavailable'; end if;

  insert into public.bookings(customer_id, provider_id, provider_listing_id, service_category, service_description, service_date, location_text, customer_note,
                              status, customer_name, provider_service_id, service_duration_minutes, price, currency, payment_status)
  values (v_customer, v_provider_profile_id, p_provider_listing_id, v_category, coalesce(p_service_description, ''), p_service_date, p_location_text, coalesce(p_customer_note, ''),
          'pending', v_customer_name, case when p_service_id is not null then v_svc.id end, case when p_service_id is not null then v_minutes end,
          case when v_svc.price is not null then round(v_svc.price, 2) end, coalesce(case when v_svc.price is not null then v_svc.currency end, 'USD'),
          case when v_svc.price is not null then 'pending' else 'unpaid' end)
  returning * into v_row;
  insert into public.booking_slots(booking_id, provider_id, start_time, end_time, status) values (v_row.id, p_provider_listing_id, p_service_date, v_slot_end, 'pending');
  perform public.notify_user(v_provider_profile_id, 'booking_new', 'notifications.bookingNewTitle', 'notifications.bookingNewBody',
                             jsonb_build_object('booking_id', v_row.id, 'provider_listing_id', p_provider_listing_id));
  return v_row;
exception when exclusion_violation then raise exception 'slot_unavailable';
end;
$$;

revoke execute on function public.create_booking(integer, text, text, timestamptz, text, text, uuid) from public, anon;
grant execute on function public.create_booking(integer, text, text, timestamptz, text, text, uuid) to authenticated;
