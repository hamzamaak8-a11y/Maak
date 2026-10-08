-- A provider can only become "approved" after identity documents were submitted. The rule lives in the database,
-- so it holds for the admin RPC, direct writes with the service-role key (Worker, CSV import) and any future code path.
--
-- Required documents (same set as submit_provider_application): a national ID and a profile photo, each with
-- status 'pending' (submitted, waiting for review) or 'approved'. Rejected documents never count.

create or replace function public.provider_has_required_documents(p_provider uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.provider_documents d where d.provider_id = p_provider and d.document_type = 'national_id' and d.status in ('pending', 'approved'))
     and exists (select 1 from public.provider_documents d where d.provider_id = p_provider and d.document_type = 'profile_photo' and d.status in ('pending', 'approved'));
$$;

revoke all on function public.provider_has_required_documents(uuid) from public, anon, authenticated;

-- Last line of defence: any INSERT / UPDATE that makes a provider profile 'approved' is refused without documents.
create or replace function public.enforce_documents_before_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.verification_status = 'approved'
     and (tg_op = 'INSERT' or old.verification_status is distinct from 'approved')
     and not public.provider_has_required_documents(new.id) then
    raise exception 'documents_required' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke all on function public.enforce_documents_before_approval() from public, anon, authenticated;

drop trigger if exists provider_profiles_require_documents on public.provider_profiles;
create trigger provider_profiles_require_documents
  before insert or update of verification_status on public.provider_profiles
  for each row execute function public.enforce_documents_before_approval();

-- The admin RPC: refuses early with a clear error and marks the reviewed documents as approved.
create or replace function public.admin_approve_provider(target uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare actor uuid := auth.uid();
declare previous_status text;
begin
  if actor is null or not public.is_admin() then raise exception 'forbidden: admin only'; end if;
  select verification_status into previous_status from public.provider_profiles where id = target for update;
  if not found then raise exception 'provider application not found'; end if;
  if not public.provider_has_required_documents(target) then raise exception 'documents_required'; end if;
  perform set_config('request.jwt.claim.role', 'service_role', true);
  update public.provider_documents set status = 'approved'
    where provider_id = target and status = 'pending' and document_type in ('national_id', 'profile_photo', 'professional_document');
  update public.provider_profiles set verification_status = 'approved', rejection_reason = null where id = target;
  update public.profiles set role = 'provider', updated_at = now() where id = target and role in ('customer', 'provider');
  insert into public.admin_audit_log(admin_id, action, target_type, target_id, metadata)
  values (actor, 'provider_approved', 'provider', target, jsonb_build_object('previous_status', previous_status, 'documents_checked', true));
end
$function$;
