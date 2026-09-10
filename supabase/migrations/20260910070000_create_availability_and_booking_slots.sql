create extension if not exists btree_gist;

create table if not exists public.provider_availability (
  id uuid primary key default gen_random_uuid(),
  provider_id integer not null references public.providers(id) on delete cascade,
  day_of_week integer not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  is_available boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint provider_availability_time_order check (end_time > start_time),
  constraint provider_availability_unique_slot unique (provider_id, day_of_week, start_time, end_time)
);
create index if not exists provider_availability_provider_day_idx on public.provider_availability(provider_id, day_of_week);

create table if not exists public.booking_slots (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  provider_id integer not null references public.providers(id) on delete cascade,
  start_time timestamptz not null,
  end_time timestamptz not null,
  status text not null default 'pending' check (status in ('pending','confirmed','cancelled')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint booking_slots_time_order check (end_time > start_time),
  constraint booking_slots_booking_unique unique (booking_id)
);
create index if not exists booking_slots_provider_start_idx on public.booking_slots(provider_id, start_time);
alter table public.booking_slots drop constraint if exists booking_slots_provider_time_excl;
alter table public.booking_slots add constraint booking_slots_provider_time_excl exclude using gist (provider_id with =, tstzrange(start_time,end_time,'[)') with &&) where (status in ('pending','confirmed'));

alter table public.provider_availability enable row level security;
alter table public.booking_slots enable row level security;
revoke all on public.provider_availability from anon, authenticated;
revoke all on public.booking_slots from anon, authenticated;

create or replace function public.check_availability(p_provider_id integer,p_start_time timestamptz,p_end_time timestamptz)
returns boolean language plpgsql security definer set search_path=public as $$
declare v_day integer; v_start time; v_end time; v_has_window boolean; v_has_conflict boolean;
begin
  perform public.require_auth_uid();
  if p_provider_id is null or p_start_time is null or p_end_time is null or p_end_time <= p_start_time then return false; end if;
  if (p_start_time at time zone current_setting('TIMEZONE'))::date is distinct from (p_end_time at time zone current_setting('TIMEZONE'))::date then return false; end if;
  v_day:=extract(dow from p_start_time)::integer; v_start:=p_start_time::time; v_end:=p_end_time::time;
  select exists(select 1 from public.provider_availability pa where pa.provider_id=p_provider_id and pa.day_of_week=v_day and pa.is_available and pa.start_time<=v_start and pa.end_time>=v_end) into v_has_window;
  if not v_has_window then return false; end if;
  select exists(select 1 from public.booking_slots bs where bs.provider_id=p_provider_id and bs.status in ('pending','confirmed') and tstzrange(bs.start_time,bs.end_time,'[)') && tstzrange(p_start_time,p_end_time,'[)')) into v_has_conflict;
  return not v_has_conflict;
end $$;
revoke all on function public.check_availability(integer,timestamptz,timestamptz) from public;
grant execute on function public.check_availability(integer,timestamptz,timestamptz) to authenticated;

create or replace function public.create_booking(p_provider_listing_id integer,p_service_category text,p_service_description text,p_service_date timestamptz,p_location_text text,p_customer_note text default ''::text)
returns public.bookings language plpgsql security definer set search_path=public as $$
declare v_customer uuid:=public.require_auth_uid(); v_customer_status text; v_provider_profile_id uuid; v_provider_status text; v_verification text; v_customer_name text; v_row public.bookings; v_slot_end timestamptz; v_day integer; v_start time; v_has_window boolean;
begin
  select account_status,full_name into v_customer_status,v_customer_name from public.profiles where id=v_customer and role='customer';
  if not found or v_customer_status is distinct from 'active' then raise exception 'forbidden'; end if;
  if p_service_category is null or btrim(p_service_category)='' then raise exception 'invalid_service'; end if;
  if p_service_date is null or p_service_date<=now() then raise exception 'invalid_service_date'; end if;
  select provider_profile_id into v_provider_profile_id from public.providers where id=p_provider_listing_id and listing_kind='real' and published_at is not null;
  if not found or v_provider_profile_id is null then raise exception 'provider_not_found'; end if;
  select pp.verification_status,pr.account_status into v_verification,v_provider_status from public.provider_profiles pp join public.profiles pr on pr.id=pp.id where pp.id=v_provider_profile_id;
  if not found or v_verification is distinct from 'approved' or v_provider_status is distinct from 'active' then raise exception 'provider_not_bookable'; end if;
  v_slot_end:=p_service_date+interval '1 hour';
  if (p_service_date at time zone current_setting('TIMEZONE'))::date is distinct from (v_slot_end at time zone current_setting('TIMEZONE'))::date then raise exception 'invalid_service_date'; end if;
  v_day:=extract(dow from p_service_date)::integer; v_start:=p_service_date::time;
  select exists(select 1 from public.provider_availability pa where pa.provider_id=p_provider_listing_id and pa.day_of_week=v_day and pa.is_available and pa.start_time<=v_start and pa.end_time>=v_slot_end::time) into v_has_window;
  if not v_has_window then raise exception 'provider_unavailable'; end if;
  insert into public.bookings(customer_id,provider_id,provider_listing_id,service_category,service_description,service_date,location_text,customer_note,status,customer_name) values(v_customer,v_provider_profile_id,p_provider_listing_id,btrim(p_service_category),coalesce(p_service_description,''),p_service_date,p_location_text,coalesce(p_customer_note,''),'pending',v_customer_name) returning * into v_row;
  insert into public.booking_slots(booking_id,provider_id,start_time,end_time,status) values(v_row.id,p_provider_listing_id,p_service_date,v_slot_end,'pending');
  return v_row;
exception when exclusion_violation then raise exception 'slot_unavailable';
end $$;
revoke all on function public.create_booking(integer,text,text,timestamptz,text,text) from public;
grant execute on function public.create_booking(integer,text,text,timestamptz,text,text) to authenticated;

create or replace function public.accept_booking(p_booking_id uuid) returns public.bookings language plpgsql security definer set search_path=public as $$ declare v_row public.bookings; begin perform public.require_auth_uid(); select * into v_row from public.bookings where id=p_booking_id for update; if not found then raise exception 'not_found'; end if; perform public.assert_provider_owner(v_row.provider_id); if v_row.status<>'pending' then raise exception 'invalid_transition'; end if; update public.bookings set status='accepted',accepted_at=now(),updated_at=now() where id=p_booking_id returning * into v_row; update public.booking_slots set status='confirmed',updated_at=now() where booking_id=p_booking_id and status='pending'; return v_row; end $$;
create or replace function public.reject_booking(p_booking_id uuid,p_reason text) returns public.bookings language plpgsql security definer set search_path=public as $$ declare v_row public.bookings; begin perform public.require_auth_uid(); if p_reason is null or btrim(p_reason)='' then raise exception 'reason_required'; end if; select * into v_row from public.bookings where id=p_booking_id for update; if not found then raise exception 'not_found'; end if; perform public.assert_provider_owner(v_row.provider_id); if v_row.status<>'pending' then raise exception 'invalid_transition'; end if; update public.bookings set status='rejected',rejection_reason=btrim(p_reason),updated_at=now() where id=p_booking_id returning * into v_row; update public.booking_slots set status='cancelled',updated_at=now() where booking_id=p_booking_id and status='pending'; return v_row; end $$;
create or replace function public.cancel_booking(p_booking_id uuid) returns public.bookings language plpgsql security definer set search_path=public as $$ declare v_uid uuid:=public.require_auth_uid(); v_row public.bookings; v_account_status text; begin select account_status into v_account_status from public.profiles where id=v_uid and role='customer'; if not found or v_account_status is distinct from 'active' then raise exception 'forbidden'; end if; select * into v_row from public.bookings where id=p_booking_id for update; if not found then raise exception 'not_found'; end if; if v_row.customer_id is distinct from v_uid then raise exception 'forbidden'; end if; if v_row.status<>'pending' then raise exception 'invalid_transition'; end if; update public.bookings set status='cancelled',cancelled_at=now(),updated_at=now() where id=p_booking_id returning * into v_row; update public.booking_slots set status='cancelled',updated_at=now() where booking_id=p_booking_id and status='pending'; return v_row; end $$;