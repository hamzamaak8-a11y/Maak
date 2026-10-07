-- Maak critical security hardening follow-up.
-- Idempotent and non-destructive. Run after the existing security hardening files.
-- Protects server-owned identity/verification fields from direct client updates
-- and enforces the same storage limits at the bucket layer as the UI validation.

create or replace function public.guard_profile_security_fields()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if current_setting('request.jwt.claim.role', true) = 'service_role' then
    return new;
  end if;
  if new.id is distinct from old.id then raise exception 'protected_profile_id'; end if;
  if new.created_at is distinct from old.created_at then raise exception 'protected_profile_created_at'; end if;
  if new.role is distinct from old.role then raise exception 'protected_profile_role'; end if;
  if new.account_status is distinct from old.account_status then raise exception 'protected_profile_account_status'; end if;
  return new;
end;
$$;

drop trigger if exists guard_profile_security_fields on public.profiles;
create trigger guard_profile_security_fields
before update on public.profiles
for each row execute function public.guard_profile_security_fields();

create or replace function public.guard_provider_security_fields()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
begin
  if current_setting('request.jwt.claim.role', true) = 'service_role' then
    return new;
  end if;
  if new.id is distinct from old.id then raise exception 'protected_provider_id'; end if;
  if new.created_at is distinct from old.created_at then raise exception 'protected_provider_created_at'; end if;
  if new.rejection_reason is distinct from old.rejection_reason then raise exception 'protected_verification_reason'; end if;
  if new.verification_status is distinct from old.verification_status then
    if not (new.verification_status = 'pending' and old.verification_status in ('draft','rejected','pending')) then
      raise exception 'protected_verification_status';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists guard_provider_security_fields on public.provider_profiles;
create trigger guard_provider_security_fields
before update on public.provider_profiles
for each row execute function public.guard_provider_security_fields();

-- Approved profiles are edited through the dedicated SECURITY DEFINER RPC,
-- so direct table updates cannot bypass its validation.
drop policy if exists provider_profiles_update_own on public.provider_profiles;
create policy provider_profiles_update_own
on public.provider_profiles
for update to authenticated
using (auth.uid() = id and verification_status <> 'approved')
with check (auth.uid() = id and verification_status in ('draft','pending','rejected'));

-- The trigger protects role/account_status. Keep the user's normal self-edit
-- policy for profile fields such as name, phone and city.
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own
on public.profiles
for update to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);

-- Admin account-status changes must cross the trigger as an explicit
-- privileged operation.
create or replace function public.admin_set_account_status(target uuid,new_status text)
returns void
language plpgsql
security definer
set search_path=public
as $$
declare actor uuid := auth.uid();
begin
  if actor is null or not public.is_admin() then raise exception 'forbidden'; end if;
  if new_status not in ('active','suspended') then raise exception 'invalid status'; end if;
  if target = actor then raise exception 'cannot change own status'; end if;
  if not exists(select 1 from public.profiles where id=target) then raise exception 'account not found'; end if;
  perform set_config('request.jwt.claim.role','service_role',true);
  update public.profiles set account_status=new_status, updated_at=now() where id=target;
  if new_status='suspended' then
    update public.providers set published_at=null, available=null where provider_profile_id=target and listing_kind='real';
  else
    perform public.refresh_provider_listing(target);
  end if;
  insert into public.admin_audit_log(admin_id,action,target_type,target_id,metadata)
  values(actor,case when new_status='suspended' then 'account_suspended' else 'account_reactivated' end,'profile',target,jsonb_build_object('status',new_status));
end;
$$;
revoke all on function public.admin_set_account_status(uuid,text) from public,anon;
grant execute on function public.admin_set_account_status(uuid,text) to authenticated;

-- Enforce the same private-document upload restrictions server-side.
update storage.buckets
set file_size_limit = 5242880,
    allowed_mime_types = array['image/jpeg','image/png','application/pdf']
where id = 'provider-documents';
