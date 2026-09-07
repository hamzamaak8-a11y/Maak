-- Maak production hardening follow-up.
-- Idempotent. Run after security-hardening.sql and chat.sql.
-- Prevents stale authenticated sessions from creating bookings or using provider chat
-- when the account is suspended, and ensures booking targets are published real listings.

create or replace function public.assert_provider_owner(p_provider_id uuid)
returns void
language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := public.require_auth_uid();
  v_status text;
  v_account text;
begin
  if p_provider_id is distinct from v_uid then raise exception 'forbidden'; end if;
  select pp.verification_status, pr.account_status
    into v_status, v_account
    from public.provider_profiles pp
    join public.profiles pr on pr.id = pp.id
   where pp.id = v_uid;
  if not found or v_status is distinct from 'approved' or v_account is distinct from 'active' then
    raise exception 'forbidden';
  end if;
end $$;

create or replace function public.create_booking(
  p_provider_listing_id integer,
  p_service_category text,
  p_service_description text,
  p_service_date timestamptz,
  p_location_text text,
  p_customer_note text default ''
) returns public.bookings
language plpgsql security definer set search_path = public as $$
declare
  v_customer uuid := public.require_auth_uid();
  v_customer_status text;
  v_provider_profile_id uuid;
  v_provider_status text;
  v_verification text;
  v_customer_name text;
  v_row public.bookings;
begin
  select account_status, full_name into v_customer_status, v_customer_name
    from public.profiles where id = v_customer and role = 'customer';
  if not found or v_customer_status is distinct from 'active' then raise exception 'forbidden'; end if;
  if p_service_category is null or btrim(p_service_category) = '' then raise exception 'invalid_service'; end if;

  select provider_profile_id into v_provider_profile_id
    from public.providers
   where id = p_provider_listing_id
     and listing_kind = 'real'
     and published_at is not null;
  if not found or v_provider_profile_id is null then raise exception 'provider_not_found'; end if;

  select pp.verification_status, pr.account_status
    into v_verification, v_provider_status
    from public.provider_profiles pp
    join public.profiles pr on pr.id = pp.id
   where pp.id = v_provider_profile_id;
  if not found or v_verification is distinct from 'approved' or v_provider_status is distinct from 'active' then
    raise exception 'provider_not_bookable';
  end if;

  insert into public.bookings(
    customer_id, provider_id, provider_listing_id, service_category,
    service_description, service_date, location_text, customer_note,
    status, customer_name
  ) values(
    v_customer, v_provider_profile_id, p_provider_listing_id, btrim(p_service_category),
    coalesce(p_service_description,''), p_service_date, p_location_text,
    coalesce(p_customer_note,''), 'pending', v_customer_name
  ) returning * into v_row;
  return v_row;
end $$;

revoke all on function public.create_booking(integer,text,text,timestamptz,text,text) from public, anon;
grant execute on function public.create_booking(integer,text,text,timestamptz,text,text) to authenticated;

create or replace function public.get_or_create_provider_conversation(p_provider_profile_id uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_customer uuid := auth.uid();
  v_customer_status text;
  v_provider_status text;
  v_verification text;
  v_conversation uuid;
begin
  if v_customer is null then raise exception 'not_authenticated'; end if;
  select account_status into v_customer_status from public.profiles where id=v_customer and role='customer';
  if not found or v_customer_status is distinct from 'active' then raise exception 'forbidden'; end if;
  if p_provider_profile_id is null or v_customer=p_provider_profile_id then raise exception 'provider_not_found'; end if;
  select pp.verification_status,pr.account_status into v_verification,v_provider_status
    from public.provider_profiles pp join public.profiles pr on pr.id=pp.id
   where pp.id=p_provider_profile_id;
  if not found or v_verification is distinct from 'approved' or v_provider_status is distinct from 'active' then raise exception 'provider_not_bookable'; end if;

  select c.id into v_conversation
    from public.conversations c
    join public.conversation_participants cp1 on cp1.conversation_id=c.id and cp1.user_id=v_customer
    join public.conversation_participants cp2 on cp2.conversation_id=c.id and cp2.user_id=p_provider_profile_id
   where c.booking_id is null limit 1;
  if v_conversation is not null then return v_conversation; end if;

  insert into public.conversations default values returning id into v_conversation;
  insert into public.conversation_participants(conversation_id,user_id)
  values(v_conversation,v_customer),(v_conversation,p_provider_profile_id);
  return v_conversation;
end $$;

grant execute on function public.get_or_create_provider_conversation(uuid) to authenticated;
revoke all on function public.get_or_create_provider_conversation(uuid) from anon, public;
