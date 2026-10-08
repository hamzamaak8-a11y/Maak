-- Booking money rules against the REAL functions (set_booking_price, mark_booking_paid, admin_refund_booking, admin_cancel_booking).
-- Run on a replayed schema:  bash supabase/ci/replay.sh maak_replay && psql -d maak_replay -f supabase/ci/booking-money-rules-test.sql
-- Ends with a ROLLBACK, so it can be repeated. Expect no row under 'mismatches' and passed = total_checks.
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
update public.provider_profiles set verification_status='approved' where id='00000000-0000-0000-0000-0000000000e1';
select id as listing from public.providers where provider_profile_id='00000000-0000-0000-0000-0000000000e1' \gset
insert into public.provider_availability(provider_id,day_of_week,start_time,end_time,is_available) select :listing, d, '08:00','20:00', true from generate_series(0,6) d;
-- bookings in each state (direct inserts, service role)
create temp table ids(name text, id uuid);
insert into public.bookings(id,customer_id,provider_id,provider_listing_id,service_category,service_date,status,customer_name,price,payment_status) values
 ('10000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000e1',:listing,'x',now()+interval '3 day','pending','Cust One',null,'unpaid'),
 ('10000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000e1',:listing,'x',now()+interval '4 day','accepted','Cust One',100,'pending'),
 ('10000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000e1',:listing,'x',now()+interval '5 day','in_progress','Cust One',null,'unpaid'),
 ('10000000-0000-0000-0000-000000000004','00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000e1',:listing,'x',now()-interval '1 day','completed','Cust One',null,'unpaid'),
 ('10000000-0000-0000-0000-000000000005','00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000e1',:listing,'x',now()-interval '2 day','completed','Cust One',120,'pending'),
 ('10000000-0000-0000-0000-000000000006','00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000e1',:listing,'x',now()+interval '6 day','cancelled','Cust One',50,'pending'),
 ('10000000-0000-0000-0000-000000000007','00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000e1',:listing,'x',now()+interval '7 day','rejected','Cust One',50,'pending'),
 ('10000000-0000-0000-0000-000000000008','00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000e1',:listing,'x',now()-interval '3 day','completed','Cust One',80,'paid'),
 ('10000000-0000-0000-0000-000000000009','00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000e1',:listing,'x',now()-interval '4 day','completed','Cust One',80,'refunded'),
 ('10000000-0000-0000-0000-00000000000a','00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000e1',:listing,'x',now()+interval '8 day','pending','Cust One',70,'pending');

select set_config('request.jwt.claim.role','service_role',false);
insert into public.booking_slots(booking_id,provider_id,start_time,end_time,status) select '10000000-0000-0000-0000-000000000002', :listing, now()+interval '4 day', now()+interval '4 day 1 hour','confirmed';
select set_config('request.jwt.claim.role','authenticated',false);
create or replace function pg_temp.try(q text) returns text language plpgsql as $$ begin execute q; return 'ok'; exception when others then return sqlerrm; end $$;
create temp table res(case_name text, expect text, got text);
grant all on res to public;
\set PROV '00000000-0000-0000-0000-0000000000e1'
select set_config('request.jwt.claim.sub',:'PROV',false);
-- ===== PRICE =====
insert into res select 'price: pending, none -> set', 'ok', pg_temp.try($$select public.set_booking_price('10000000-0000-0000-0000-000000000001', 50, 'MAD')$$);
insert into res select 'price: pending, change', 'ok', pg_temp.try($$select public.set_booking_price('10000000-0000-0000-0000-000000000001', 60, 'MAD')$$);
insert into res select 'price: accepted, change existing', 'ok', pg_temp.try($$select public.set_booking_price('10000000-0000-0000-0000-000000000002', 90, 'MAD')$$);
insert into res select 'price: in_progress, none -> set late quote', 'ok', pg_temp.try($$select public.set_booking_price('10000000-0000-0000-0000-000000000003', 70, 'MAD')$$);
insert into res select 'price: in_progress, change existing', 'price_locked', pg_temp.try($$select public.set_booking_price('10000000-0000-0000-0000-000000000003', 80, 'MAD')$$);
insert into res select 'price: completed, none -> set', 'ok', pg_temp.try($$select public.set_booking_price('10000000-0000-0000-0000-000000000004', 40, 'MAD')$$);
insert into res select 'price: completed, change existing', 'price_locked', pg_temp.try($$select public.set_booking_price('10000000-0000-0000-0000-000000000004', 45, 'MAD')$$);
insert into res select 'price: cancelled', 'forbidden_or_invalid_booking', pg_temp.try($$select public.set_booking_price('10000000-0000-0000-0000-000000000006', 10, 'MAD')$$);
insert into res select 'price: rejected', 'forbidden_or_invalid_booking', pg_temp.try($$select public.set_booking_price('10000000-0000-0000-0000-000000000007', 10, 'MAD')$$);
insert into res select 'price: paid', 'price_locked', pg_temp.try($$select public.set_booking_price('10000000-0000-0000-0000-000000000008', 10, 'MAD')$$);
insert into res select 'price: refunded', 'price_locked', pg_temp.try($$select public.set_booking_price('10000000-0000-0000-0000-000000000009', 10, 'MAD')$$);
insert into res select 'price: negative', 'invalid_price', pg_temp.try($$select public.set_booking_price('10000000-0000-0000-0000-000000000001', -1, 'MAD')$$);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c1',false);
insert into res select 'price: customer cannot set', 'forbidden_or_invalid_booking', pg_temp.try($$select public.set_booking_price('10000000-0000-0000-0000-000000000001', 1, 'MAD')$$);
-- ===== PAYMENT =====
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a1',false);
insert into res select 'paid: completed + price', 'ok', pg_temp.try($$select public.mark_booking_paid('10000000-0000-0000-0000-000000000005','cash')$$);
insert into res select 'paid: again', 'already_paid', pg_temp.try($$select public.mark_booking_paid('10000000-0000-0000-0000-000000000005','cash')$$);
insert into res select 'paid: completed without price', 'booking_not_payable', pg_temp.try($$select public.mark_booking_paid('10000000-0000-0000-0000-000000000003','cash')$$);
insert into res select 'paid: cancelled', 'booking_not_payable', pg_temp.try($$select public.mark_booking_paid('10000000-0000-0000-0000-000000000006','cash')$$);
insert into res select 'paid: rejected', 'booking_not_payable', pg_temp.try($$select public.mark_booking_paid('10000000-0000-0000-0000-000000000007','cash')$$);
insert into res select 'paid: pending', 'booking_not_payable', pg_temp.try($$select public.mark_booking_paid('10000000-0000-0000-0000-00000000000a','cash')$$);
insert into res select 'paid: refunded stays refunded', 'payment_locked', pg_temp.try($$select public.mark_booking_paid('10000000-0000-0000-0000-000000000009','cash')$$);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c1',false);
insert into res select 'paid: customer is not admin', 'forbidden', pg_temp.try($$select public.mark_booking_paid('10000000-0000-0000-0000-000000000004','cash')$$);
select set_config('request.jwt.claim.sub',:'PROV',false);
insert into res select 'paid: provider is not admin', 'forbidden', pg_temp.try($$select public.mark_booking_paid('10000000-0000-0000-0000-000000000004','cash')$$);
-- ===== REFUND =====
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a1',false);
insert into res select 'refund: paid + reason', 'ok', pg_temp.try($$select public.admin_refund_booking('10000000-0000-0000-0000-000000000008','customer complaint')$$);
insert into res select 'refund: again', 'booking_not_refundable', pg_temp.try($$select public.admin_refund_booking('10000000-0000-0000-0000-000000000008','again')$$);
insert into res select 'refund: unpaid', 'booking_not_refundable', pg_temp.try($$select public.admin_refund_booking('10000000-0000-0000-0000-000000000004','x')$$);
insert into res select 'refund: needs reason', 'reason_required', pg_temp.try($$select public.admin_refund_booking('10000000-0000-0000-0000-000000000005','  ')$$);
select set_config('request.jwt.claim.sub',:'PROV',false);
insert into res select 'refund: provider cannot', 'forbidden', pg_temp.try($$select public.admin_refund_booking('10000000-0000-0000-0000-000000000005','x')$$);
-- ===== ADMIN CANCEL =====
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a1',false);
insert into res select 'cancel: accepted by admin', 'ok', pg_temp.try($$select public.admin_cancel_booking('10000000-0000-0000-0000-000000000002','provider unavailable')$$);
insert into res select 'cancel: slot released', 'cancelled', (select status from public.booking_slots where booking_id='10000000-0000-0000-0000-000000000002');
insert into res select 'cancel: both people notified', '2', (select count(*)::text from public.notifications where metadata->>'booking_id'='10000000-0000-0000-0000-000000000002' and type='booking_cancelled');
insert into res select 'cancel: completed refused', 'booking cannot be cancelled', pg_temp.try($$select public.admin_cancel_booking('10000000-0000-0000-0000-000000000004',null)$$);
insert into res select 'notify: price change notified the customer', '>=1', (select case when count(*)>=1 then '>=1' else '0' end from public.notifications where type='booking_price' and user_id='00000000-0000-0000-0000-0000000000c1');
insert into res select 'audit: paid/refund/cancel logged', '3', (select count(*)::text from public.admin_audit_log where action in ('booking_marked_paid','booking_refunded','booking_cancelled'));
\echo ===== mismatches (must be empty) =====
select case_name, expect, got from res where expect <> got;
select count(*) as total_checks, count(*) filter (where expect = got) as passed from res;
rollback;
