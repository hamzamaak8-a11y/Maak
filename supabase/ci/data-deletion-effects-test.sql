-- What account deletion does to the OTHER person's history (documents the CURRENT behaviour; see docs/DATA_RETENTION.md).
-- Run on a replayed schema: bash supabase/ci/replay.sh maak_replay && psql -d maak_replay -f supabase/ci/data-deletion-effects-test.sql
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
insert into public.reviews(booking_id,customer_id,provider_id,rating,comment) values ('10000000-0000-0000-0000-000000000008','00000000-0000-0000-0000-0000000000c1','00000000-0000-0000-0000-0000000000e1',5,'great');
select 'BEFORE deleting the customer' as step,
  (select count(*) from public.bookings where provider_id='00000000-0000-0000-0000-0000000000e1') as provider_bookings,
  (select coalesce(sum(price),0) from public.bookings where provider_id='00000000-0000-0000-0000-0000000000e1' and payment_status='paid') as provider_paid_revenue,
  (select count(*) from public.reviews where provider_id='00000000-0000-0000-0000-0000000000e1') as provider_reviews;
delete from public.bookings where customer_id='00000000-0000-0000-0000-0000000000c1' and status in ('pending','accepted','in_progress');
delete from auth.users where id='00000000-0000-0000-0000-0000000000c1';
select 'AFTER deleting the customer' as step,
  (select count(*) from public.bookings where provider_id='00000000-0000-0000-0000-0000000000e1') as provider_bookings,
  (select coalesce(sum(price),0) from public.bookings where provider_id='00000000-0000-0000-0000-0000000000e1' and payment_status='paid') as provider_paid_revenue,
  (select count(*) from public.reviews where provider_id='00000000-0000-0000-0000-0000000000e1') as provider_reviews;
rollback;
