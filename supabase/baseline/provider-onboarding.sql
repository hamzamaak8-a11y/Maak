-- maak — provider onboarding + private document storage.
-- Idempotent. Assumes worker/db/profiles.sql has been run.
-- Extends provider_profiles; creates provider_documents + a PRIVATE storage
-- bucket + RLS/storage policies. Does NOT touch public.providers or profiles.
-- Run ONCE in the Supabase dashboard SQL editor.

-- =========================================================================
-- 1. Extend provider_profiles with onboarding fields
-- =========================================================================
alter table public.provider_profiles
  add column if not exists service_category text;
alter table public.provider_profiles
  add column if not exists bio text;
alter table public.provider_profiles
  add column if not exists experience_years int;

-- =========================================================================
-- 2. provider_documents (metadata for uploaded files; files live in storage)
-- =========================================================================
create table if not exists public.provider_documents (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.provider_profiles(id) on delete cascade,
  document_type text not null,
  storage_path text not null,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'provider_documents_document_type_check') then
    alter table public.provider_documents add constraint provider_documents_document_type_check
      check (document_type in ('national_id','profile_photo','professional_document','other'));
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'provider_documents_status_check') then
    alter table public.provider_documents add constraint provider_documents_status_check
      check (status in ('pending','approved','rejected'));
  end if;
end $$;

create index if not exists provider_documents_provider_idx on public.provider_documents(provider_id);

-- =========================================================================
-- 3. RLS on provider_documents (own only; client may only create pending)
-- =========================================================================
alter table public.provider_documents enable row level security;

drop policy if exists "provider_documents_select_own" on public.provider_documents;
create policy "provider_documents_select_own" on public.provider_documents
  for select using (auth.uid() = provider_id);

drop policy if exists "provider_documents_insert_own" on public.provider_documents;
create policy "provider_documents_insert_own" on public.provider_documents
  for insert with check (auth.uid() = provider_id and status = 'pending');

drop policy if exists "provider_documents_update_own" on public.provider_documents;
create policy "provider_documents_update_own" on public.provider_documents
  for update using (auth.uid() = provider_id and status = 'pending')
  with check (auth.uid() = provider_id and status = 'pending');

drop policy if exists "provider_documents_delete_own" on public.provider_documents;
create policy "provider_documents_delete_own" on public.provider_documents
  for delete using (auth.uid() = provider_id and status = 'pending');

-- =========================================================================
-- 4. Guard: a client cannot approve/reject their own documents, nor touch a
--    document that has already been reviewed.
-- =========================================================================
create or replace function public.guard_document_status_change()
returns trigger language plpgsql as $$
declare actor text;
begin
  actor := current_setting('request.jwt.claim.role', true);
  if actor is null or actor = 'service_role' then
    return new;
  end if;
  if old.status in ('approved','rejected') then
    raise exception 'cannot modify a reviewed document';
  end if;
  if new.status is distinct from old.status and new.status <> 'pending' then
    raise exception 'not allowed to set document status';
  end if;
  return new;
end $$;

drop trigger if exists provider_documents_guard_status on public.provider_documents;
create trigger provider_documents_guard_status
  before update on public.provider_documents
  for each row execute function public.guard_document_status_change();

-- =========================================================================
-- 5. provider_profiles: allow a customer to INSERT (draft/pending) and
--    rework the verification_status guard so a customer may move
--    draft|rejected -> pending, but can NEVER set approved/rejected/suspended
--    and can NEVER touch an already approved/suspended profile.
-- =========================================================================
drop policy if exists "provider_profiles_insert_own" on public.provider_profiles;
create policy "provider_profiles_insert_own" on public.provider_profiles
  for insert with check (auth.uid() = id and verification_status in ('draft','pending'));

create or replace function public.guard_verification_status_change()
returns trigger language plpgsql as $$
declare actor text;
begin
  actor := current_setting('request.jwt.claim.role', true);
  if actor is null or actor = 'service_role' then
    return new;
  end if;
  if old.verification_status in ('approved','suspended') then
    raise exception 'cannot modify an approved or suspended provider profile';
  end if;
  if new.verification_status not in ('draft','pending') then
    raise exception 'not allowed to set this verification_status';
  end if;
  return new;
end $$;

-- =========================================================================
-- 6. PRIVATE storage bucket + storage RLS policies (own folder only)
--    Path convention: <auth.uid>/<docType>-<ts>-<rand>.<ext>
--    No public access. No public URLs. Owner-only read/write/delete.
-- =========================================================================
insert into storage.buckets (id, name, public)
values ('provider-documents', 'provider-documents', false)
on conflict (id) do nothing;

drop policy if exists "provider_documents_storage_read_own" on storage.objects;
create policy "provider_documents_storage_read_own" on storage.objects
  for select using (bucket_id = 'provider-documents' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "provider_documents_storage_insert_own" on storage.objects;
create policy "provider_documents_storage_insert_own" on storage.objects
  for insert with check (bucket_id = 'provider-documents' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "provider_documents_storage_update_own" on storage.objects;
create policy "provider_documents_storage_update_own" on storage.objects
  for update using (bucket_id = 'provider-documents' and auth.uid()::text = (storage.foldername(name))[1])
  with check (bucket_id = 'provider-documents' and auth.uid()::text = (storage.foldername(name))[1]);

drop policy if exists "provider_documents_storage_delete_own" on storage.objects;
create policy "provider_documents_storage_delete_own" on storage.objects
  for delete using (bucket_id = 'provider-documents' and auth.uid()::text = (storage.foldername(name))[1]);
