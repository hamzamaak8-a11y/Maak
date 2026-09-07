-- Maak production hardening follow-up.
-- Idempotent. Run after security-hardening.sql and chat.sql.
-- Prevents stale authenticated sessions from creating bookings or using provider chat
-- when the account is suspended, and keeps suspended providers out of the marketplace.

create or replace function public.assert_provider_owner(p_provider_id uuid)
returns void
language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := public.require_auth_uid(); v_status text; v_account text;
begin
  if p_provider_id is distinct from v_uid then raise exception 'forbidden'; end if;
  select pp.verification_status, pr.account_status into v_status, v_account
    from public.provider_profiles pp join public.profiles pr on pr.id=pp.id where pp.id=v_uid;
  if not found or v_status is distinct from 'approved' or v_account is distinct from 'active' then raise exception 'forbidden'; end if;
end $$;

create or replace function public.create_booking(p_provider_listing_id integer,p_service_category text,p_service_description text,p_service_date timestamptz,p_location_text text,p_customer_note text default '') returns public.bookings
language plpgsql security definer set search_path = public as $$
declare v_customer uuid:=public.require_auth_uid(); v_customer_status text; v_provider_profile_id uuid; v_provider_status text; v_verification text; v_customer_name text; v_row public.bookings;
begin
  select account_status,full_name into v_customer_status,v_customer_name from public.profiles where id=v_customer and role='customer';
  if not found or v_customer_status is distinct from 'active' then raise exception 'forbidden'; end if;
  if p_service_category is null or btrim(p_service_category)='' then raise exception 'invalid_service'; end if;
  select provider_profile_id into v_provider_profile_id from public.providers where id=p_provider_listing_id and listing_kind='real' and published_at is not null;
  if not found or v_provider_profile_id is null then raise exception 'provider_not_found'; end if;
  select pp.verification_status,pr.account_status into v_verification,v_provider_status from public.provider_profiles pp join public.profiles pr on pr.id=pp.id where pp.id=v_provider_profile_id;
  if not found or v_verification is distinct from 'approved' or v_provider_status is distinct from 'active' then raise exception 'provider_not_bookable'; end if;
  insert into public.bookings(customer_id,provider_id,provider_listing_id,service_category,service_description,service_date,location_text,customer_note,status,customer_name)
  values(v_customer,v_provider_profile_id,p_provider_listing_id,btrim(p_service_category),coalesce(p_service_description,''),p_service_date,p_location_text,coalesce(p_customer_note,''),'pending',v_customer_name)
  returning * into v_row; return v_row;
end $$;
revoke all on function public.create_booking(integer,text,text,timestamptz,text,text) from public,anon;
grant execute on function public.create_booking(integer,text,text,timestamptz,text,text) to authenticated;

create or replace function public.get_or_create_provider_conversation(p_provider_profile_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_customer uuid:=auth.uid(); v_customer_status text; v_provider_status text; v_verification text; v_conversation uuid;
begin
  if v_customer is null then raise exception 'not_authenticated'; end if;
  select account_status into v_customer_status from public.profiles where id=v_customer and role='customer';
  if not found or v_customer_status is distinct from 'active' then raise exception 'forbidden'; end if;
  if p_provider_profile_id is null or v_customer=p_provider_profile_id then raise exception 'provider_not_found'; end if;
  select pp.verification_status,pr.account_status into v_verification,v_provider_status from public.provider_profiles pp join public.profiles pr on pr.id=pp.id where pp.id=p_provider_profile_id;
  if not found or v_verification is distinct from 'approved' or v_provider_status is distinct from 'active' then raise exception 'provider_not_bookable'; end if;
  select c.id into v_conversation from public.conversations c join public.conversation_participants cp1 on cp1.conversation_id=c.id and cp1.user_id=v_customer join public.conversation_participants cp2 on cp2.conversation_id=c.id and cp2.user_id=p_provider_profile_id where c.booking_id is null limit 1;
  if v_conversation is not null then return v_conversation; end if;
  insert into public.conversations default values returning id into v_conversation;
  insert into public.conversation_participants(conversation_id,user_id) values(v_conversation,v_customer),(v_conversation,p_provider_profile_id);
  return v_conversation;
end $$;
grant execute on function public.get_or_create_provider_conversation(uuid) to authenticated;
revoke all on function public.get_or_create_provider_conversation(uuid) from anon,public;

create or replace function public.refresh_provider_listing(p_provider_profile_id uuid)
returns void language plpgsql security definer set search_path=public as $$
declare v_prof text; v_full_name text; v_city text; v_bio text; v_exp int; v_services text[]; v_price numeric; v_account_status text; v_services_json jsonb; v_price_text text; v_exp_text text; v_published timestamptz; v_existing integer;
begin
  select pp.profession,p.full_name,p.city,pp.bio,pp.experience_years,pp.services,pp.price_from,p.account_status into v_prof,v_full_name,v_city,v_bio,v_exp,v_services,v_price,v_account_status
    from public.provider_profiles pp join public.profiles p on p.id=pp.id where pp.id=p_provider_profile_id;
  if not found then return; end if;
  if v_full_name is null or v_prof is null or v_city is null then delete from public.providers where provider_profile_id=p_provider_profile_id and listing_kind='real'; return; end if;
  v_services_json:=to_jsonb(coalesce(v_services,ARRAY[]::text[]));
  v_price_text:=case when v_price is null then null else v_price::text end;
  v_exp_text:=case when v_exp is null then null else v_exp::text||' سنوات' end;
  if v_account_status='active' and v_services is not null and array_length(v_services,1)>0 then v_published:=now(); else v_published:=null; end if;
  select id into v_existing from public.providers where provider_profile_id=p_provider_profile_id and listing_kind='real';
  if found then
    update public.providers set name=v_full_name,job=v_prof,city=v_city,distance=null,price=v_price_text,rating=null,reviews=0,image=null,available=null,services=v_services_json,experience=v_exp_text,intro=v_bio,published_at=v_published where id=v_existing;
  else
    insert into public.providers(name,job,city,distance,price,rating,reviews,image,available,services,experience,intro,provider_profile_id,listing_kind,published_at)
    values(v_full_name,v_prof,v_city,null,v_price_text,null,0,null,null,v_services_json,v_exp_text,v_bio,p_provider_profile_id,'real',v_published);
  end if;
end $$;

create or replace function public.admin_set_account_status(target uuid,new_status text)
returns void language plpgsql security definer set search_path=public as $$
declare actor uuid:=auth.uid();
begin
  if actor is null or not exists(select 1 from public.profiles where id=actor and role='admin') then raise exception 'forbidden'; end if;
  if new_status not in ('active','suspended') then raise exception 'invalid status'; end if;
  if target=actor then raise exception 'cannot change own status'; end if;
  if not exists(select 1 from public.profiles where id=target) then raise exception 'account not found'; end if;
  update public.profiles set account_status=new_status,updated_at=now() where id=target;
  if new_status='suspended' then update public.providers set published_at=null,available=null where provider_profile_id=target and listing_kind='real'; else perform public.refresh_provider_listing(target); end if;
  insert into public.admin_audit_log(admin_id,action,target_type,target_id,metadata) values(actor,case when new_status='suspended' then 'account_suspended' else 'account_reactivated' end,'profile',target,jsonb_build_object('status',new_status));
end $$;
revoke all on function public.admin_set_account_status(uuid,text) from public,anon;
grant execute on function public.admin_set_account_status(uuid,text) to authenticated;
