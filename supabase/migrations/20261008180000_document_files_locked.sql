-- Identity documents: the file in Storage and its metadata row must tell the same story.
--
-- BEFORE: the Storage policy let the owner delete any of their own files, while the table only lets them delete rows that are still
-- 'pending'. So an owner could delete the file of an APPROVED document: the row stayed 'approved' with nothing behind it, and the app
-- (which deleted the file first and ignored "0 rows deleted") reported success. Also, approval only looked at metadata rows.
--
-- NOW
--  1. While the account exists, the owner can delete or overwrite a document file only when its row is still pending, or when no row refers to it
--     (clean-up of an upload that failed): approved and rejected documents are locked, exactly like their rows already were.
--  2. Account deletion keeps working: the app first calls begin_account_deletion(), which unlocks the caller's own files for 15 minutes,
--     then removes the files, then calls delete_my_account(). Nothing else unlocks them.
--  3. A provider can only be approved when the national ID and the profile photo files exist in Storage, not just metadata rows
--     (admin_approve_provider and the approval trigger both use provider_has_required_documents).
--
-- No file or row is deleted by this migration, and no retention period is imposed: how long identity files are kept after approval is a
-- legal decision for the owner (see docs/DATA_RETENTION.md).

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.document_unlock (
  user_id uuid primary key references auth.users(id) on delete cascade,
  until timestamptz not null
);
revoke all on private.document_unlock from public, anon, authenticated;

create or replace function public.begin_account_deletion()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  insert into private.document_unlock(user_id, until) values (auth.uid(), now() + interval '15 minutes')
  on conflict (user_id) do update set until = excluded.until;
end;
$$;
revoke all on function public.begin_account_deletion() from public, anon, authenticated;
grant execute on function public.begin_account_deletion() to authenticated;

create or replace function public.provider_document_file_locked(p_path text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.provider_documents d where d.storage_path = p_path and d.status in ('approved', 'rejected'))
     and not exists (select 1 from private.document_unlock u where u.user_id = auth.uid() and u.until > now());
$$;
revoke all on function public.provider_document_file_locked(text) from public, anon, authenticated;
grant execute on function public.provider_document_file_locked(text) to authenticated;

-- Policies of a PERMISSIVE kind add up, and the repository holds two generations of them for this bucket (the folder-based ones from
-- baseline/provider-onboarding.sql and the owner-based one from 20260912000536). All delete/update policies are replaced by one pair,
-- otherwise the older, unconditional one would keep the files deletable and overwritable. Insert and read policies are not touched.
drop policy if exists "provider documents delete own" on storage.objects;
drop policy if exists provider_documents_storage_delete_own on storage.objects;
drop policy if exists provider_documents_storage_update_own on storage.objects;

create policy "provider documents delete own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'provider-documents'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and not (select public.provider_document_file_locked(name))
);

-- Replacing the content (upsert) or moving a file is also an UPDATE: an approved ID photo must not be swapped after approval.
create policy "provider documents update own"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'provider-documents'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and not (select public.provider_document_file_locked(name))
)
with check (
  bucket_id = 'provider-documents'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create or replace function public.provider_has_required_documents(p_provider uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
           select 1 from public.provider_documents d
           where d.provider_id = p_provider and d.document_type = 'national_id' and d.status in ('pending', 'approved')
             and exists (select 1 from storage.objects o where o.bucket_id = 'provider-documents' and o.name = d.storage_path))
     and exists (
           select 1 from public.provider_documents d
           where d.provider_id = p_provider and d.document_type = 'profile_photo' and d.status in ('pending', 'approved')
             and exists (select 1 from storage.objects o where o.bucket_id = 'provider-documents' and o.name = d.storage_path));
$$;
revoke all on function public.provider_has_required_documents(uuid) from public, anon, authenticated;
