-- create_booking: paused listing, service duration + overlap, active price list vs free request.
-- Run on a replayed schema:  bash supabase/ci/replay.sh maak_replay && psql -d maak_replay -f supabase/ci/booking-service-duration-test.sql
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
insert into storage.objects(bucket_id,name,owner_id) values ('provider-documents','x/1','00000000-0000-0000-0000-0000000000e1'),('provider-documents','x/2','00000000-0000-0000-0000-0000000000e1');
update public.provider_profiles set verification_status='approved' where id='00000000-0000-0000-0000-0000000000e1';
select id as listing from public.providers where provider_profile_id='00000000-0000-0000-0000-0000000000e1' \gset
insert into public.provider_availability(provider_id,day_of_week,start_time,end_time,is_available) select :listing, d, '08:00','20:00', true from generate_series(0,6) d;
-- bookings in each state (direct inserts, service role)

select set_config('request.jwt.claim.role','service_role',false);
delete from public.provider_availability where provider_id = :listing;
insert into public.provider_availability(provider_id, day_of_week, start_time, end_time, is_available) select :listing, 0, '08:00', '18:00', true;
insert into public.provider_services(id, provider_id, name, price, currency, duration_minutes, is_active) values
 ('50000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000e1','Deep clean 2h', 300, 'MAD', 120, true),
 ('50000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000e1','Quick fix', 80, 'MAD', null, true),
 ('50000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-0000000000e1','Old offer', 50, 'MAD', 60, false),
 ('50000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-0000000000e1','Marathon', null, 'MAD', 900, true);
create temp table cfg as select :listing::int as listing, (date_trunc('day', now()) + ((7 - extract(dow from now())::int) % 7 + 7) * interval '1 day') as sunday;
create temp table res(case_name text, expect text, got text);
grant all on res to public; grant all on cfg to public;
create or replace function pg_temp.book(at_hour numeric, svc uuid default null, name text default 'Free request') returns text language plpgsql as $$
declare s timestamptz := (select sunday from cfg) + make_interval(secs => (at_hour * 3600)::int);
begin perform public.create_booking((select listing from cfg), name, 'd', s, 'Rue 1', '', svc); return 'ok'; exception when others then return sqlerrm; end $$;
grant execute on function pg_temp.book(numeric, uuid, text) to public;
select set_config('request.jwt.claim.role','authenticated',false);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c1',false);

-- 1. paused listing
reset role;
update public.providers set available = false where id = :listing;
select set_config('request.jwt.claim.role','authenticated',false);
insert into res select 'paused listing refuses a direct booking (hours exist)', 'provider_not_bookable', pg_temp.book(10);
update public.providers set available = null where id = :listing;
insert into res select 'unset availability (null) is bookable', 'ok', pg_temp.book(8);
update public.providers set available = true where id = :listing;
insert into res select 'available = true is bookable', 'ok', pg_temp.book(9);

-- 2. duration: a 2-hour service reserves 2 hours
insert into res select 'service of 120 min books', 'ok', pg_temp.book(10, '50000000-0000-0000-0000-000000000001');
insert into res select 'slot lasts 120 minutes', '120', (select (extract(epoch from end_time - start_time) / 60)::int::text from public.booking_slots s join public.bookings b on b.id = s.booking_id where b.provider_service_id = '50000000-0000-0000-0000-000000000001');
insert into res select 'second hour of that service is NOT free', 'slot_unavailable', pg_temp.book(11);
insert into res select 'a 1-hour request overlapping its end is refused', 'slot_unavailable', pg_temp.book(11.5);
insert into res select 'a request that starts when it ends works', 'ok', pg_temp.book(12);
insert into res select 'a 2-hour service cannot start inside an existing booking', 'slot_unavailable', pg_temp.book(9.5, '50000000-0000-0000-0000-000000000001');
insert into res select 'a 2-hour service must fit inside the working hours', 'provider_unavailable', pg_temp.book(17.5, '50000000-0000-0000-0000-000000000001');
insert into res select 'a 15-hour service cannot be booked online', 'invalid_service_duration', pg_temp.book(9, '50000000-0000-0000-0000-000000000004');

-- 3. price list
insert into res select 'service without duration books (1 hour)', 'ok', pg_temp.book(14, '50000000-0000-0000-0000-000000000002');
insert into res select 'service without duration keeps the 1-hour default', '60', (select (extract(epoch from end_time - start_time) / 60)::int::text from public.booking_slots s join public.bookings b on b.id = s.booking_id where b.provider_service_id = '50000000-0000-0000-0000-000000000002');
insert into res select 'booking carries the list price and currency', '80.00 MAD pending', (select price::text || ' ' || currency || ' ' || payment_status from public.bookings where provider_service_id = '50000000-0000-0000-0000-000000000002');
insert into res select 'booking carries the service name', 'Quick fix', (select service_category from public.bookings where provider_service_id = '50000000-0000-0000-0000-000000000002');
insert into res select 'the name sent by the client cannot override the service', 'ok', pg_temp.book(14.0 + 2, '50000000-0000-0000-0000-000000000002', 'Hacked name');
insert into res select 'the stored name is still the service name', '2', (select count(*)::text from public.bookings where provider_service_id = '50000000-0000-0000-0000-000000000002' and service_category = 'Quick fix');
insert into res select 'disabled service is refused', 'service_unavailable', pg_temp.book(13, '50000000-0000-0000-0000-000000000003');
insert into res select 'unknown service id is refused', 'service_unavailable', pg_temp.book(13, '50000000-0000-0000-0000-0000000000ff');
insert into res select 'free request still works (name only)', 'ok', pg_temp.book(14.0 + 3, null, 'Anything else');
insert into res select 'free request keeps its name and has no list price', 'Anything else|', (select service_category || '|' || coalesce(price::text, '') from public.bookings where service_category = 'Anything else');
insert into res select 'free request still needs a name', 'invalid_service', pg_temp.book(3, null, '  ');
-- an old 6-argument call (older app versions) still resolves
insert into res select 'old 6-argument call still works', 'ok', (select case when (public.create_booking((select listing from cfg), 'Legacy', 'd', (select sunday from cfg) + interval '13 hours', 'Rue', '')).id is not null then 'ok' else 'no' end);

-- 4. regressions: the hours still bound bookings, pricing rules still apply to a list-priced booking
insert into res select 'outside the hours is still refused', 'provider_unavailable', pg_temp.book(6);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000e1',false);
insert into res select 'provider may still adjust a list price while pending', 'ok', (select case when (public.set_booking_price((select id from public.bookings where provider_service_id = '50000000-0000-0000-0000-000000000002' limit 1), 90, 'MAD')).price = 90 then 'ok' else 'no' end);

\echo ===== mismatches (must be empty) =====
select case_name, expect, got from res where expect <> got;
select count(*) as total_checks, count(*) filter (where expect = got) as passed from res;
rollback;
