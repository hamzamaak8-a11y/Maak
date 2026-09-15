-- CI-only bootstrap for the isolated Supabase runner.
-- This file is NOT a production migration and must never be applied to a live project.
-- It recreates only the pre-migration public schema needed by the repository's
-- incremental migrations. No production rows, UUIDs, credentials, or secrets are copied.

create extension if not exists pgcrypto;
create extension if not exists btree_gist;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'customer' check (role in ('customer','provider','admin')),
  full_name text,
  phone text,
  city text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  account_status text not null default 'active' check (account_status in ('active','suspended'))
);

create table if not exists public.provider_profiles (
  id uuid primary key references public.profiles(id) on delete cascade,
  profession text,
  verification_status text not null default 'draft' check (verification_status in ('draft','pending','approved','rejected','suspended')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  service_category text,
  bio text,
  experience_years integer,
  rejection_reason text,
  services text[],
  price_from numeric,
  service_radius_km integer,
  profile_photo_public boolean not null default false
);

create table if not exists public.providers (
  id serial primary key,
  name text not null,
  job text not null,
  city text not null,
  distance text,
  price text,
  rating text,
  reviews integer not null default 0,
  image text,
  available boolean,
  services jsonb not null default '[]'::jsonb,
  experience text,
  intro text,
  provider_profile_id uuid references public.provider_profiles(id) on delete set null,
  listing_kind text not null default 'seed' check (listing_kind in ('seed','real')),
  published_at timestamptz
);

create table if not exists public.bookings (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete cascade,
  provider_id uuid not null references public.provider_profiles(id) on delete cascade,
  provider_listing_id integer references public.providers(id) on delete set null,
  service_category text not null,
  service_description text not null default '',
  service_date timestamptz,
  location_text text,
  customer_note text not null default '',
  provider_note text not null default '',
  status text not null default 'pending' check (status in ('pending','accepted','rejected','cancelled','in_progress','completed')),
  rejection_reason text,
  customer_name text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  accepted_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  cancelled_at timestamptz
);

create table if not exists public.provider_documents (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.provider_profiles(id) on delete cascade,
  document_type text not null check (document_type in ('national_id','profile_photo','professional_document','other')),
  storage_path text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now()
);

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references auth.users(id) on delete restrict,
  action text not null,
  target_type text not null,
  target_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid unique references public.bookings(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.conversation_participants (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create or replace function public.chat_touch_updated_at()
returns trigger language plpgsql set search_path = public as $$ begin new.updated_at=now(); return new; end $$;

create or replace function public.require_auth_uid()
returns uuid language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); begin if v_uid is null then raise exception 'not_authenticated'; end if; return v_uid; end $$;

create or replace function public.assert_provider_owner(p_provider_id uuid)
returns void language plpgsql stable security definer set search_path = public as $$
begin if p_provider_id is distinct from auth.uid() then raise exception 'forbidden'; end if; end $$;

create or replace function public.guard_role_change()
returns trigger language plpgsql security definer set search_path = public as $$ begin return new; end $$;

create or replace function public.guard_profile_security_fields()
returns trigger language plpgsql security definer set search_path = public as $$ begin return new; end $$;

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, role, full_name)
  values(new.id, 'customer', coalesce(new.raw_user_meta_data ->> 'full_name',''))
  on conflict (id) do nothing;
  return new;
end $$;

create or replace function public.refresh_provider_listing(p_provider_profile_id uuid)
returns void language plpgsql security definer set search_path = public as $$ begin return; end $$;

create or replace function public.provider_profiles_refresh_listing()
returns trigger language plpgsql security definer set search_path = public as $$ begin return new; end $$;

create or replace function public.assert_active_chat_user()
returns uuid language plpgsql stable security definer set search_path = public as $$ begin return public.require_auth_uid(); end $$;

create or replace function public.is_admin()
returns boolean language sql security definer set search_path = public as $$ select exists(select 1 from public.profiles where id = auth.uid() and role = 'admin' and account_status = 'active'); $$;

create or replace function public.admin_approve_provider(target uuid) returns void language plpgsql security definer set search_path = public as $$ begin return; end $$;
create or replace function public.admin_reject_provider(target uuid, reason text) returns void language plpgsql security definer set search_path = public as $$ begin return; end $$;
create or replace function public.admin_cancel_booking(target uuid, reason text default null) returns void language plpgsql security definer set search_path = public as $$ begin return; end $$;
create or replace function public.admin_set_account_status(target uuid, new_status text) returns void language plpgsql security definer set search_path = public as $$ begin return; end $$;

create or replace function public.create_booking_conversation_trigger()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_conversation uuid;
begin
  insert into public.conversations(booking_id) values(new.id)
  on conflict (booking_id) do update set booking_id = excluded.booking_id
  returning id into v_conversation;
  insert into public.conversation_participants(conversation_id,user_id)
  values(v_conversation,new.customer_id),(v_conversation,new.provider_id)
  on conflict do nothing;
  return new;
end $$;

create or replace function public.get_or_create_provider_conversation(p_provider_profile_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_conversation uuid;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  select c.id into v_conversation
  from public.conversations c
  join public.conversation_participants a on a.conversation_id=c.id and a.user_id=auth.uid()
  join public.conversation_participants b on b.conversation_id=c.id and b.user_id=p_provider_profile_id
  where c.booking_id is null limit 1;
  if v_conversation is not null then return v_conversation; end if;
  insert into public.conversations default values returning id into v_conversation;
  insert into public.conversation_participants(conversation_id,user_id)
  values(v_conversation,auth.uid()),(v_conversation,p_provider_profile_id);
  return v_conversation;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

create trigger guard_profile_role_change
  before update on public.profiles
  for each row execute function public.guard_role_change();

create trigger provider_profiles_refresh_listing
  after insert or update on public.provider_profiles
  for each row execute function public.provider_profiles_refresh_listing();

create trigger bookings_create_conversation
  after insert on public.bookings
  for each row execute function public.create_booking_conversation_trigger();

create trigger conversations_touch_updated_at
  before update on public.conversations
  for each row execute function public.chat_touch_updated_at();

alter table public.profiles enable row level security;
alter table public.provider_profiles enable row level security;
alter table public.provider_documents enable row level security;
alter table public.providers enable row level security;
alter table public.bookings enable row level security;
alter table public.admin_audit_log enable row level security;
alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;

drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles for select to authenticated using (auth.uid() = id);
drop policy if exists profiles_select_admin on public.profiles;
create policy profiles_select_admin on public.profiles for select to authenticated using (is_admin());
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists provider_profiles_select_own on public.provider_profiles;
create policy provider_profiles_select_own on public.provider_profiles for select to authenticated using (auth.uid() = id);
drop policy if exists provider_profiles_insert_own on public.provider_profiles;
create policy provider_profiles_insert_own on public.provider_profiles for insert to authenticated with check (auth.uid() = id);
drop policy if exists provider_profiles_update_own on public.provider_profiles;
create policy provider_profiles_update_own on public.provider_profiles for update to authenticated using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists provider_documents_select_own on public.provider_documents;
create policy provider_documents_select_own on public.provider_documents for select to authenticated using (auth.uid() = provider_id);
drop policy if exists provider_documents_insert_own on public.provider_documents;
create policy provider_documents_insert_own on public.provider_documents for insert to authenticated with check (auth.uid() = provider_id);
drop policy if exists provider_documents_update_own on public.provider_documents;
create policy provider_documents_update_own on public.provider_documents for update to authenticated using (auth.uid() = provider_id) with check (auth.uid() = provider_id);
drop policy if exists provider_documents_delete_own on public.provider_documents;
create policy provider_documents_delete_own on public.provider_documents for delete to authenticated using (auth.uid() = provider_id);

drop policy if exists admin_audit_select on public.admin_audit_log;
create policy admin_audit_select on public.admin_audit_log for select to authenticated using (admin_id = auth.uid() or is_admin());

drop policy if exists bookings_select_customer on public.bookings;
create policy bookings_select_customer on public.bookings for select to authenticated using (auth.uid() = customer_id);
drop policy if exists bookings_select_provider on public.bookings;
create policy bookings_select_provider on public.bookings for select to authenticated using (auth.uid() = provider_id);
drop policy if exists bookings_select_admin on public.bookings;
create policy bookings_select_admin on public.bookings for select to authenticated using (is_admin());

drop policy if exists conversation_participants_select_self on public.conversation_participants;
create policy conversation_participants_select_self on public.conversation_participants for select to authenticated using (user_id = auth.uid());
drop policy if exists conversation_select_participant on public.conversations;
create policy conversation_select_participant on public.conversations for select to authenticated using (exists(select 1 from public.conversation_participants cp where cp.conversation_id=conversations.id and cp.user_id=auth.uid()));
drop policy if exists messages_select_participant on public.messages;
create policy messages_select_participant on public.messages for select to authenticated using (exists(select 1 from public.conversation_participants cp where cp.conversation_id=messages.conversation_id and cp.user_id=auth.uid()));

revoke all on public.profiles, public.provider_profiles, public.provider_documents, public.bookings, public.conversations, public.conversation_participants, public.messages, public.admin_audit_log from anon;
grant select on public.providers to anon, authenticated;
