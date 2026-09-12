insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'provider-portfolio',
  'provider-portfolio',
  false,
  5242880,
  array['image/jpeg','image/png','image/webp']::text[]
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "provider portfolio select owner or admin"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'provider-portfolio'
  and (
    owner_id = (select auth.uid()::text)
    or (select public.is_admin())
  )
);

create policy "provider portfolio insert own folder"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'provider-portfolio'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

create policy "provider portfolio delete own"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'provider-portfolio'
  and (
    owner_id = (select auth.uid()::text)
    or (select public.is_admin())
  )
);
