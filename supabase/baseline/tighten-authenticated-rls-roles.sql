-- Maak RLS tightening follow-up.
-- Keep public marketplace reads public; make private application data authenticated-only.

drop policy if exists bookings_select_admin on public.bookings;
create policy bookings_select_admin on public.bookings for select to authenticated
using (exists (select 1 from public.profiles p where p.id=auth.uid() and p.role='admin' and p.account_status='active'));

drop policy if exists bookings_select_customer on public.bookings;
create policy bookings_select_customer on public.bookings for select to authenticated
using (auth.uid()=customer_id and exists (select 1 from public.profiles p where p.id=auth.uid() and p.account_status='active'));

drop policy if exists bookings_select_provider on public.bookings;
create policy bookings_select_provider on public.bookings for select to authenticated
using (exists (select 1 from public.provider_profiles pp join public.profiles p on p.id=pp.id where pp.id=auth.uid() and pp.id=bookings.provider_id and pp.verification_status='approved' and p.account_status='active'));

drop policy if exists conversation_participants_select_self on public.conversation_participants;
create policy conversation_participants_select_self on public.conversation_participants for select to authenticated using (user_id=auth.uid());

drop policy if exists conversation_select_participant on public.conversations;
create policy conversation_select_participant on public.conversations for select to authenticated using (exists (select 1 from public.conversation_participants cp where cp.conversation_id=conversations.id and cp.user_id=auth.uid()));

drop policy if exists messages_select_participant on public.messages;
create policy messages_select_participant on public.messages for select to authenticated using (exists (select 1 from public.conversation_participants cp where cp.conversation_id=messages.conversation_id and cp.user_id=auth.uid()));

drop policy if exists provider_documents_select_admin on public.provider_documents;
create policy provider_documents_select_admin on public.provider_documents for select to authenticated using (is_admin());
drop policy if exists provider_documents_select_own on public.provider_documents;
create policy provider_documents_select_own on public.provider_documents for select to authenticated using (auth.uid()=provider_id);
drop policy if exists provider_documents_insert_own on public.provider_documents;
create policy provider_documents_insert_own on public.provider_documents for insert to authenticated with check (auth.uid()=provider_id and status='pending');
drop policy if exists provider_documents_update_own on public.provider_documents;
create policy provider_documents_update_own on public.provider_documents for update to authenticated using (auth.uid()=provider_id and status='pending') with check (auth.uid()=provider_id and status='pending');
drop policy if exists provider_documents_delete_own on public.provider_documents;
create policy provider_documents_delete_own on public.provider_documents for delete to authenticated using (auth.uid()=provider_id and status='pending');

drop policy if exists provider_profiles_select_admin on public.provider_profiles;
create policy provider_profiles_select_admin on public.provider_profiles for select to authenticated using (is_admin());
drop policy if exists provider_profiles_insert_own on public.provider_profiles;
create policy provider_profiles_insert_own on public.provider_profiles for insert to authenticated with check (auth.uid()=id and verification_status in ('draft','pending'));

revoke all on table public.admin_audit_log from anon, public; grant select on table public.admin_audit_log to authenticated;
revoke all on table public.profiles from anon, public; grant select, insert, update on table public.profiles to authenticated;
revoke all on table public.provider_profiles from anon, public; grant select, insert, update on table public.provider_profiles to authenticated;
revoke all on table public.provider_documents from anon, public; grant select, insert, update, delete on table public.provider_documents to authenticated;
revoke all on table public.bookings from anon, public; grant select on table public.bookings to authenticated;
revoke all on table public.conversations from anon, public; grant select on table public.conversations to authenticated;
revoke all on table public.conversation_participants from anon, public; grant select on table public.conversation_participants to authenticated;
revoke all on table public.messages from anon, public; grant select on table public.messages to authenticated;
revoke insert, update, delete on table public.providers from anon, public;
grant select on table public.providers to anon, authenticated;

drop policy if exists provider_documents_storage_read_admin on storage.objects;
create policy provider_documents_storage_read_admin on storage.objects for select to authenticated using (bucket_id='provider-documents' and is_admin());
drop policy if exists provider_documents_storage_read_own on storage.objects;
create policy provider_documents_storage_read_own on storage.objects for select to authenticated using (bucket_id='provider-documents' and auth.uid()::text=(storage.foldername(name))[1]);
drop policy if exists provider_documents_storage_insert_own on storage.objects;
create policy provider_documents_storage_insert_own on storage.objects for insert to authenticated with check (bucket_id='provider-documents' and auth.uid()::text=(storage.foldername(name))[1]);
drop policy if exists provider_documents_storage_update_own on storage.objects;
create policy provider_documents_storage_update_own on storage.objects for update to authenticated using (bucket_id='provider-documents' and auth.uid()::text=(storage.foldername(name))[1]) with check (bucket_id='provider-documents' and auth.uid()::text=(storage.foldername(name))[1]);
drop policy if exists provider_documents_storage_delete_own on storage.objects;
create policy provider_documents_storage_delete_own on storage.objects for delete to authenticated using (bucket_id='provider-documents' and auth.uid()::text=(storage.foldername(name))[1]);
