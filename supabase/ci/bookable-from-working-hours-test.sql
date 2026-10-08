drop database if exists t_av; create database t_av;
\c t_av
create schema auth; create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
create function public.require_auth_uid() returns uuid language sql as $$ select auth.uid() $$;
create table public.providers(id integer primary key, provider_profile_id uuid, published_at timestamptz, available boolean);
create table public.provider_availability(id uuid primary key default gen_random_uuid(), provider_id integer, day_of_week int, start_time time, end_time time, is_available boolean, created_at timestamptz default now(), updated_at timestamptz default now());
insert into public.providers values (1,'00000000-0000-0000-0000-0000000000b1',now(),null),(2,'00000000-0000-0000-0000-0000000000b2',now(),null),(3,'00000000-0000-0000-0000-0000000000b3',now(),false),(4,'00000000-0000-0000-0000-0000000000b4',null,null);
insert into public.provider_availability(provider_id,day_of_week,start_time,end_time,is_available) values (1,1,'09:00','12:00',true),(3,1,'09:00','12:00',true),(4,1,'09:00','12:00',true);
\i supabase/migrations/20261008120000_bookable_from_working_hours.sql
set request.jwt.claim.sub='00000000-0000-0000-0000-0000000000c1';
\echo 1 published + working hours + available null (expect 1 row)
select count(*) from public.get_provider_availability(1);
\echo 2 published, no working hours (expect provider_not_bookable)
select count(*) from public.get_provider_availability(2);
\echo 3 paused (available=false) (expect provider_not_bookable)
select count(*) from public.get_provider_availability(3);
\echo 4 not published (expect provider_not_bookable)
select count(*) from public.get_provider_availability(4);
\echo 5 owner sees own hours even with none/unpublished (expect 1 row)
set request.jwt.claim.sub='00000000-0000-0000-0000-0000000000b4';
select count(*) from public.get_provider_availability(4);
