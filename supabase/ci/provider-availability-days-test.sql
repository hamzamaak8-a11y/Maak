-- Working-hours days against the REAL functions: a day with no row can be closed, reopened and closed again; the hours bound
-- bookings; an existing booking survives closing the day; two bookings cannot overlap.
-- Run on a replayed schema:  bash supabase/ci/replay.sh maak_replay && psql -d maak_replay -f supabase/ci/provider-availability-days-test.sql
-- Ends with a ROLLBACK. Expect no row under 'mismatches' and passed = total_checks.
begin;
set time zone 'UTC';
-- fixture on top of the replayed schema (run as superuser; claims emulate PostgREST)
select set_config('request.jwt.claim.role','service_role',false);
insert into auth.users(id,email) values
 ('00000000-0000-0000-0000-0000000000a1','admin@x'),('00000000-0000-0000-0000-0000000000c1','cust@x'),('00000000-0000-0000-0000-0000000000c2','cust2@x'),('00000000-0000-0000-0000-0000000000e1','prov@x');
insert into public.profiles(id,role,full_name,city,account_status) values
 ('00000000-0000-0000-0000-0000000000a1','admin','Boss','Rabat','active'),('00000000-0000-0000-0000-0000000000c1','customer','Cust One','Fes','active'),('00000000-0000-0000-0000-0000000000c2','customer','Cust Two','Fes','active'),('00000000-0000-0000-0000-0000000000e1','provider','Prov','Fes','active')
 on conflict (id) do update set role=excluded.role, full_name=excluded.full_name, city=excluded.city, account_status='active';
insert into public.provider_profiles(id,profession,verification_status,service_category,bio,services) values ('00000000-0000-0000-0000-0000000000e1','Plumber','pending','x','bio',array['a']) on conflict (id) do nothing;
insert into public.provider_documents(provider_id,document_type,status,storage_path) values ('00000000-0000-0000-0000-0000000000e1','national_id','pending','x/1'),('00000000-0000-0000-0000-0000000000e1','profile_photo','pending','x/2');
update public.provider_profiles set verification_status='approved' where id='00000000-0000-0000-0000-0000000000e1';
select id as listing from public.providers where provider_profile_id='00000000-0000-0000-0000-0000000000e1' \gset
insert into public.provider_availability(provider_id,day_of_week,start_time,end_time,is_available) select :listing, d, '08:00','20:00', true from generate_series(0,6) d;
-- bookings in each state (direct inserts, service role)

select set_config('request.jwt.claim.role','service_role',false);
delete from public.provider_availability where provider_id = :listing;
create temp table cfg as select :listing::int as listing, (date_trunc('day', now()) + ((7 - extract(dow from now())::int) % 7 + 7) * interval '1 day') as sunday;
create temp table res(case_name text, expect text, got text);
grant all on res to public; grant all on cfg to public;
create or replace function pg_temp.try(q text) returns text language plpgsql as $$ begin execute q; return 'ok'; exception when others then return sqlerrm; end $$;
create or replace function pg_temp.book(at_hour int) returns text language plpgsql as $$
declare l int := (select listing from cfg); s timestamptz := (select sunday from cfg) + make_interval(hours => at_hour);
begin perform public.create_booking(l, 'x', 'd', s, 'Rue 1', ''); return 'ok'; exception when others then return sqlerrm; end $$;
create or replace function pg_temp.hours() returns text language sql as $$
  select coalesce(string_agg(start_time::text || '-' || end_time::text || ':' || is_available::text, ',' order by start_time, created_at), 'none') from public.provider_availability where provider_id = (select listing from cfg) and day_of_week = 0 $$;
grant execute on function pg_temp.try(text), pg_temp.book(int), pg_temp.hours() to public;

select set_config('request.jwt.claim.role','authenticated',false);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000e1',false);
-- 1. a day that never had a row
insert into res select 'close a day that has no row yet', 'ok', pg_temp.try($$select public.set_provider_availability((select listing from cfg), 0, null, null, false)$$);
insert into res select 'closed day is stored as not available', '00:00:00-00:00:00:false', pg_temp.hours();
insert into res select 'closing again is idempotent', 'ok', pg_temp.try($$select public.set_provider_availability((select listing from cfg), 0, null, null, false)$$);
-- 2. open it
insert into res select 'open the day 09:00-12:00', 'ok', pg_temp.try($$select public.set_provider_availability((select listing from cfg), 0, '09:00', '12:00', true)$$);
insert into res select 'rejects an end before the start', 'invalid_availability', pg_temp.try($$select public.set_provider_availability((select listing from cfg), 0, '12:00', '09:00', true)$$);
insert into res select 'rejects an empty window', 'invalid_availability', pg_temp.try($$select public.set_provider_availability((select listing from cfg), 0, '10:00', '10:00', true)$$);
insert into res select 'customers can read the window', '1', (select count(*)::text from public.get_provider_availability((select listing from cfg)) where is_available and day_of_week = 0);

-- 3. bookings follow the hours
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c1',false);
insert into res select 'booking before opening is refused', 'provider_unavailable', pg_temp.book(7);
insert into res select 'booking that ends after closing is refused', 'provider_unavailable', pg_temp.book(12);
insert into res select 'booking inside the hours works', 'ok', pg_temp.book(10);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c2',false);
insert into res select 'overlapping booking is refused', 'slot_unavailable', pg_temp.book(10);
insert into res select 'the next free hour still works', 'ok', pg_temp.book(11);

-- 4. close the day again: existing bookings stay, new ones are refused
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000e1',false);
insert into res select 'close the day with bookings on it', 'ok', pg_temp.try($$select public.set_provider_availability((select listing from cfg), 0, null, null, false)$$);
insert into res select 'existing bookings are untouched', '2', (select count(*)::text from public.bookings where status = 'pending');
insert into res select 'their slots are still reserved', '2', (select count(*)::text from public.booking_slots where status = 'pending');
insert into res select 'no available window is left', 'true', (select (not exists (select 1 from public.provider_availability where provider_id = (select listing from cfg) and day_of_week = 0 and is_available))::text);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c1',false);
insert into res select 'closed day refuses new bookings', 'provider_unavailable', pg_temp.book(9);
-- 5. reopen with a different window
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000e1',false);
insert into res select 'reopen 14:00-18:00', 'ok', pg_temp.try($$select public.set_provider_availability((select listing from cfg), 0, '14:00', '18:00', true)$$);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c1',false);
insert into res select 'old morning hours stay closed', 'provider_unavailable', pg_temp.book(9);
insert into res select 'new afternoon hours work', 'ok', pg_temp.book(15);
-- 6. only the owner (approved provider) can change the hours
insert into res select 'a customer cannot change the hours', 'forbidden', pg_temp.try($$select public.set_provider_availability((select listing from cfg), 3, '09:00', '10:00', true)$$);

\echo ===== mismatches (must be empty) =====
select case_name, expect, got from res where expect <> got;
select count(*) as total_checks, count(*) filter (where expect = got) as passed from res;
rollback;
