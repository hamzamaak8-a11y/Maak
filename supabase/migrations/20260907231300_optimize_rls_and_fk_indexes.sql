-- Performance hardening: cache auth.uid() per statement and index uncovered foreign keys.

create index if not exists admin_audit_log_admin_id_idx on public.admin_audit_log(admin_id);
create index if not exists bookings_provider_listing_id_idx on public.bookings(provider_listing_id);
create index if not exists messages_sender_id_idx on public.messages(sender_id);

alter policy profiles_select_own on public.profiles using ((select auth.uid()) = id);
alter policy profiles_update_own on public.profiles using ((select auth.uid()) = id) with check ((select auth.uid()) = id);
alter policy provider_profiles_select_own on public.provider_profiles using ((select auth.uid()) = id);
alter policy provider_profiles_insert_own on public.provider_profiles with check (((select auth.uid()) = id) and (verification_status = any (array['draft'::text,'pending'::text])));
alter policy provider_profiles_update_own on public.provider_profiles using (((select auth.uid()) = id) and (verification_status <> 'approved'::text)) with check (((select auth.uid()) = id) and (verification_status = any (array['draft'::text,'pending'::text,'rejected'::text])));
alter policy provider_documents_select_own on public.provider_documents using ((select auth.uid()) = provider_id);
alter policy provider_documents_insert_own on public.provider_documents with check (((select auth.uid()) = provider_id) and (status = 'pending'::text));
alter policy provider_documents_update_own on public.provider_documents using (((select auth.uid()) = provider_id) and (status = 'pending'::text)) with check (((select auth.uid()) = provider_id) and (status = 'pending'::text));
alter policy provider_documents_delete_own on public.provider_documents using (((select auth.uid()) = provider_id) and (status = 'pending'::text));
alter policy conversation_participants_select_self on public.conversation_participants using ((user_id = (select auth.uid())));
alter policy conversation_select_participant on public.conversations using (exists (select 1 from public.conversation_participants cp where cp.conversation_id = conversations.id and cp.user_id = (select auth.uid())));
alter policy messages_select_participant on public.messages using (exists (select 1 from public.conversation_participants cp where cp.conversation_id = messages.conversation_id and cp.user_id = (select auth.uid())));
alter policy admin_audit_select on public.admin_audit_log using ((admin_id = (select auth.uid())) or is_admin());
alter policy bookings_select_admin on public.bookings using (exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin' and p.account_status = 'active'));
alter policy bookings_select_customer on public.bookings using (((select auth.uid()) = customer_id) and exists (select 1 from public.profiles p where p.id = (select auth.uid()) and p.account_status = 'active'));
alter policy bookings_select_provider on public.bookings using (exists (select 1 from public.provider_profiles pp join public.profiles p on p.id = pp.id where pp.id = (select auth.uid()) and pp.id = bookings.provider_id and pp.verification_status = 'approved' and p.account_status = 'active'));
