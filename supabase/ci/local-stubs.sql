-- Minimal stand-ins for the Supabase platform pieces the migrations rely on (auth schema, storage, roles, realtime publication).
-- Used ONLY by supabase/ci/replay.sh on a throw-away Postgres. Never run on a live project.
do $$ begin create role anon nologin; exception when duplicate_object then null; end $$;
do $$ begin create role authenticated nologin; exception when duplicate_object then null; end $$;
do $$ begin create role service_role nologin bypassrls; exception when duplicate_object then null; end $$;
create schema auth; create schema storage; create schema extensions;
create table auth.users(id uuid primary key default gen_random_uuid(), email varchar(255), raw_user_meta_data jsonb default '{}', email_confirmed_at timestamptz, last_sign_in_at timestamptz, created_at timestamptz default now());
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
create function auth.role() returns text language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.role', true),''),'authenticated') $$;
create function auth.jwt() returns jsonb language sql stable as $$ select jsonb_build_object('role', coalesce(nullif(current_setting('request.jwt.claim.role', true),''),'authenticated')) $$;
create table storage.buckets(id text primary key, name text, public boolean default false, file_size_limit bigint, allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text, name text, owner uuid, owner_id text, created_at timestamptz default now(), updated_at_marker boolean default false);
create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name, '/') $$;
grant usage on schema storage to anon, authenticated, service_role;
grant select, insert, update, delete on storage.objects to authenticated;
alter table storage.objects enable row level security;
create publication supabase_realtime;
grant usage on schema public, auth to anon, authenticated, service_role;
