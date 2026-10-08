-- Run from the repository root against a scratch Postgres: psql -f supabase/ci/provider-approval-documents-test.sql
-- Each statement marked 'expect documents_required' / 'forbidden' must fail; D and G must succeed.
drop database if exists t_docs; create database t_docs;
\c t_docs
do $$ begin create role anon; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated; exception when duplicate_object then null; end $$;
create schema auth; create table auth.users(id uuid primary key, email text);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
create table public.profiles(id uuid primary key references auth.users, role text default 'customer', account_status text default 'active', updated_at timestamptz);
create table public.provider_profiles(id uuid primary key references public.profiles, verification_status text, rejection_reason text);
create table public.provider_documents(id uuid primary key default gen_random_uuid(), provider_id uuid references public.provider_profiles on delete cascade, document_type text, storage_path text default 'x', status text default 'pending');
create table public.admin_audit_log(id uuid primary key default gen_random_uuid(), admin_id uuid, action text, target_type text, target_id uuid, metadata jsonb);
create function public.is_admin() returns boolean language sql stable security definer as $$ select exists(select 1 from public.profiles where id=auth.uid() and role='admin') $$;
-- existing guard: only service_role may set approved
create function public.guard_verification_status_change() returns trigger language plpgsql as $$ declare actor text; begin actor:=current_setting('request.jwt.claim.role',true); if actor is null or actor='service_role' then return new; end if; if new.verification_status not in ('draft','pending') then raise exception 'not allowed'; end if; return new; end $$;
create trigger g before insert or update on public.provider_profiles for each row execute function public.guard_verification_status_change();
\i supabase/migrations/20261008110000_provider_approval_requires_documents.sql
grant usage on schema public, auth to authenticated; grant all on all tables in schema public to authenticated; grant execute on function public.admin_approve_provider(uuid), public.is_admin() to authenticated;
insert into auth.users values ('00000000-0000-0000-0000-0000000000a1','a'),('00000000-0000-0000-0000-0000000000b1','p1'),('00000000-0000-0000-0000-0000000000b2','p2'),('00000000-0000-0000-0000-0000000000b3','p3'),('00000000-0000-0000-0000-0000000000b4','p4'),('00000000-0000-0000-0000-0000000000c1','c');
insert into public.profiles(id,role) values ('00000000-0000-0000-0000-0000000000a1','admin'),('00000000-0000-0000-0000-0000000000b1','customer'),('00000000-0000-0000-0000-0000000000b2','customer'),('00000000-0000-0000-0000-0000000000b3','customer'),('00000000-0000-0000-0000-0000000000b4','customer'),('00000000-0000-0000-0000-0000000000c1','customer');
insert into public.provider_profiles values ('00000000-0000-0000-0000-0000000000b1','pending'),('00000000-0000-0000-0000-0000000000b2','pending'),('00000000-0000-0000-0000-0000000000b3','pending'),('00000000-0000-0000-0000-0000000000b4','pending');
-- b2: only national id; b3: docs rejected; b4: both pending
insert into public.provider_documents(provider_id,document_type,status) values ('00000000-0000-0000-0000-0000000000b2','national_id','pending'),('00000000-0000-0000-0000-0000000000b3','national_id','rejected'),('00000000-0000-0000-0000-0000000000b3','profile_photo','rejected'),('00000000-0000-0000-0000-0000000000b4','national_id','pending'),('00000000-0000-0000-0000-0000000000b4','profile_photo','pending');
set role authenticated; set request.jwt.claim.sub='00000000-0000-0000-0000-0000000000a1';
\echo A: no documents (expect documents_required)
select public.admin_approve_provider('00000000-0000-0000-0000-0000000000b1');
\echo B: only national id (expect documents_required)
select public.admin_approve_provider('00000000-0000-0000-0000-0000000000b2');
\echo C: rejected documents (expect documents_required)
select public.admin_approve_provider('00000000-0000-0000-0000-0000000000b3');
\echo D: both pending (expect ok)
select public.admin_approve_provider('00000000-0000-0000-0000-0000000000b4');
select verification_status, (select role from public.profiles where id=p.id) role, (select string_agg(status,',') from public.provider_documents d where d.provider_id=p.id) docs from public.provider_profiles p where id='00000000-0000-0000-0000-0000000000b4';
\echo H: customer calls approve (expect forbidden)
set request.jwt.claim.sub='00000000-0000-0000-0000-0000000000c1';
select public.admin_approve_provider('00000000-0000-0000-0000-0000000000b1');
reset role;
\echo E: service role inserts approved provider without docs (CSV path) (expect documents_required)
select set_config('request.jwt.claim.role','service_role',false);
insert into auth.users values ('00000000-0000-0000-0000-0000000000d1','csv');
insert into public.profiles(id) values ('00000000-0000-0000-0000-0000000000d1');
insert into public.provider_profiles(id,verification_status) values ('00000000-0000-0000-0000-0000000000d1','approved');
\echo F: service role updates pending -> approved without docs (expect documents_required)
update public.provider_profiles set verification_status='approved' where id='00000000-0000-0000-0000-0000000000b1';
\echo G: already approved provider, other change (expect ok)
update public.provider_profiles set rejection_reason='x' where id='00000000-0000-0000-0000-0000000000b4';
\echo draft insert by service role (expect ok)
insert into public.provider_profiles(id,verification_status) values ('00000000-0000-0000-0000-0000000000d1','draft');
select count(*) from public.provider_profiles where verification_status='approved';
