-- set_booking_price notifies the customer when the price OR the currency changes (and only then).
-- Run on a replayed schema:  bash supabase/ci/replay.sh maak_replay && psql -d maak_replay -f supabase/ci/price-change-notification-test.sql
begin;
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
insert into public.bookings(id, customer_id, provider_id, provider_listing_id, service_category, service_date, status, customer_name, price, payment_status)
 values ('10000000-0000-0000-0000-0000000000b1','00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000e1', :listing, 'x', now() + interval '3 day', 'accepted', 'Cust', null, 'unpaid'),
        ('10000000-0000-0000-0000-0000000000b2','00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000e1', :listing, 'x', now() + interval '4 day', 'accepted', 'Cust', 80, 'paid');
create temp table res(case_name text, expect text, got text);
grant all on res to public;
create or replace function pg_temp.notices() returns int language sql as $$ select count(*)::int from public.notifications where type = 'booking_price' and metadata->>'booking_id' = '10000000-0000-0000-0000-0000000000b1' $$;
create or replace function pg_temp.try(q text) returns text language plpgsql as $$ begin execute q; return 'ok'; exception when others then return sqlerrm; end $$;
grant execute on function pg_temp.notices(), pg_temp.try(text) to public;
select set_config('request.jwt.claim.role','authenticated',false);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000e1',false);
select public.set_booking_price('10000000-0000-0000-0000-0000000000b1', 120, 'MAD');
insert into res select 'first price (none -> 120 MAD) notifies', '1', pg_temp.notices()::text;
select public.set_booking_price('10000000-0000-0000-0000-0000000000b1', 120, 'MAD');
insert into res select 'nothing changed: no new notification', '1', pg_temp.notices()::text;
select public.set_booking_price('10000000-0000-0000-0000-0000000000b1', 150, 'MAD');
insert into res select 'number only (120 -> 150 MAD) notifies', '2', pg_temp.notices()::text;
select public.set_booking_price('10000000-0000-0000-0000-0000000000b1', 150, 'USD');
insert into res select 'currency only (150 MAD -> 150 USD) notifies', '3', pg_temp.notices()::text;
select public.set_booking_price('10000000-0000-0000-0000-0000000000b1', 150, 'USD');
insert into res select 'same again: still no duplicate', '3', pg_temp.notices()::text;
select public.set_booking_price('10000000-0000-0000-0000-0000000000b1', 200, 'EUR');
insert into res select 'number and currency together: ONE notification', '4', pg_temp.notices()::text;
insert into res select 'the stored values are the new ones', '200.00 EUR', (select price::text || ' ' || currency from public.bookings where id = '10000000-0000-0000-0000-0000000000b1');
select public.set_booking_price('10000000-0000-0000-0000-0000000000b1', 200, 'eur ');
insert into res select 'lower-case / spaced code normalises to the same currency: no notification', '4', pg_temp.notices()::text;
insert into res select 'the notification carries the new currency', '1', (select count(*)::text from public.notifications where type = 'booking_price' and metadata->>'currency' = 'EUR' and metadata->>'booking_id' = '10000000-0000-0000-0000-0000000000b1');
-- rules from before stay in force
insert into res select 'a paid booking still cannot change currency', 'price_locked', pg_temp.try($$select public.set_booking_price('10000000-0000-0000-0000-0000000000b2', 80, 'USD')$$);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c1',false);
insert into res select 'a customer still cannot set a price', 'forbidden_or_invalid_booking', pg_temp.try($$select public.set_booking_price('10000000-0000-0000-0000-0000000000b1', 1, 'MAD')$$);
\echo ===== mismatches (must be empty) =====
select case_name, expect, got from res where expect <> got;
select count(*) as total_checks, count(*) filter (where expect = got) as passed from res;
rollback;
