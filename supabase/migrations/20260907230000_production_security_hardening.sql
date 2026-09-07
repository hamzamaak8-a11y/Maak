-- Production security hardening applied to the Maak Supabase project.
-- Keeps public marketplace reads restricted to genuinely publishable providers,
-- prevents stale/inactive customer booking cancellation, prevents accidental
-- republication of unapproved providers, and records provider verification actions.

revoke execute on function public.assert_provider_owner(uuid) from public, anon, authenticated;
revoke execute on function public.require_auth_uid() from public, anon, authenticated;
revoke execute on function public.guard_role_change() from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.create_booking_conversation_trigger() from public, anon, authenticated;
revoke execute on function public.provider_profiles_refresh_listing() from public, anon, authenticated;
revoke execute on function public.refresh_provider_listing(uuid) from public, anon, authenticated;
revoke execute on function public.assert_active_chat_user() from public, anon, authenticated;
revoke execute on function public.is_admin() from public, anon;
revoke execute on function public.admin_approve_provider(uuid) from anon;
revoke execute on function public.admin_reject_provider(uuid, text) from anon;
revoke execute on function public.admin_cancel_booking(uuid, text) from anon;
revoke execute on function public.admin_set_account_status(uuid, text) from anon;

drop policy if exists providers_select_published_real on public.providers;
create policy providers_select_published_real on public.providers
for select to public
using (
  listing_kind = 'real'
  and published_at is not null
  and provider_profile_id is not null
  and exists (
    select 1
    from public.provider_profiles pp
    join public.profiles pr on pr.id = pp.id
    where pp.id = providers.provider_profile_id
      and pp.verification_status = 'approved'
      and pr.account_status = 'active'
  )
);

alter policy profiles_select_admin on public.profiles to authenticated;

create or replace function public.refresh_provider_listing(p_provider_profile_id uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_prof text;
  v_full_name text;
  v_city text;
  v_bio text;
  v_exp int;
  v_services text[];
  v_price numeric;
  v_account_status text;
  v_verification text;
  v_services_json jsonb;
  v_price_text text;
  v_exp_text text;
  v_published timestamptz;
  v_existing integer;
begin
  select pp.profession,p.full_name,p.city,pp.bio,pp.experience_years,pp.services,pp.price_from,
         p.account_status,pp.verification_status
    into v_prof,v_full_name,v_city,v_bio,v_exp,v_services,v_price,v_account_status,v_verification
  from public.provider_profiles pp
  join public.profiles p on p.id=pp.id
  where pp.id=p_provider_profile_id;

  if not found then return; end if;
  if v_full_name is null or btrim(v_full_name)='' or v_prof is null or btrim(v_prof)='' or v_city is null or btrim(v_city)='' then
    delete from public.providers where provider_profile_id=p_provider_profile_id and listing_kind='real';
    return;
  end if;

  v_services_json:=to_jsonb(coalesce(v_services,ARRAY[]::text[]));
  v_price_text:=case when v_price is null then null else v_price::text end;
  v_exp_text:=case when v_exp is null then null else v_exp::text||' سنوات' end;
  if v_account_status='active' and v_verification='approved' and v_services is not null and array_length(v_services,1)>0 then
    v_published:=now();
  else
    v_published:=null;
  end if;

  select id into v_existing from public.providers where provider_profile_id=p_provider_profile_id and listing_kind='real';
  if found then
    update public.providers
      set name=v_full_name,job=v_prof,city=v_city,distance=null,price=v_price_text,
          rating=null,reviews=0,image=null,available=null,services=v_services_json,
          experience=v_exp_text,intro=v_bio,published_at=v_published
      where id=v_existing;
  else
    insert into public.providers(name,job,city,distance,price,rating,reviews,image,available,services,experience,intro,provider_profile_id,listing_kind,published_at)
    values(v_full_name,v_prof,v_city,null,v_price_text,null,0,null,null,v_services_json,v_exp_text,v_bio,p_provider_profile_id,'real',v_published);
  end if;
end
$function$;

create or replace function public.cancel_booking(p_booking_id uuid)
returns public.bookings
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid:=public.require_auth_uid();
  v_row public.bookings;
  v_account_status text;
begin
  select account_status into v_account_status from public.profiles where id=v_uid and role='customer';
  if not found or v_account_status is distinct from 'active' then raise exception 'forbidden'; end if;
  select * into v_row from public.bookings where id=p_booking_id for update;
  if not found then raise exception 'not_found'; end if;
  if v_row.customer_id is distinct from v_uid then raise exception 'forbidden'; end if;
  if v_row.status <> 'pending' then raise exception 'invalid_transition'; end if;
  update public.bookings set status='cancelled',cancelled_at=now(),updated_at=now() where id=p_booking_id returning * into v_row;
  return v_row;
end
$function$;

create or replace function public.admin_approve_provider(target uuid)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare actor uuid:=auth.uid();
declare previous_status text;
begin
  if actor is null or not public.is_admin() then raise exception 'forbidden: admin only'; end if;
  select verification_status into previous_status from public.provider_profiles where id=target for update;
  if not found then raise exception 'provider application not found'; end if;
  perform set_config('request.jwt.claim.role','service_role',true);
  update public.provider_profiles set verification_status='approved', rejection_reason=null where id=target;
  update public.profiles set role='provider', updated_at=now() where id=target and role in ('customer','provider');
  insert into public.admin_audit_log(admin_id,action,target_type,target_id,metadata)
  values(actor,'provider_approved','provider',target,jsonb_build_object('previous_status',previous_status));
end
$function$;

create or replace function public.admin_reject_provider(target uuid, reason text)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare actor uuid:=auth.uid();
declare previous_status text;
begin
  if actor is null or not public.is_admin() then raise exception 'forbidden: admin only'; end if;
  if nullif(btrim(reason),'') is null then raise exception 'reason_required'; end if;
  select verification_status into previous_status from public.provider_profiles where id=target for update;
  if not found then raise exception 'provider application not found'; end if;
  perform set_config('request.jwt.claim.role','service_role',true);
  update public.provider_profiles set verification_status='rejected',rejection_reason=btrim(reason) where id=target;
  insert into public.admin_audit_log(admin_id,action,target_type,target_id,metadata)
  values(actor,'provider_rejected','provider',target,jsonb_build_object('reason',btrim(reason),'previous_status',previous_status));
end
$function$;
