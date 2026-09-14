-- Prevent direct client RPC access from opening conversations with providers
-- that are approved but not currently published in the public marketplace.

create or replace function public.get_or_create_provider_conversation(p_provider_profile_id uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_customer uuid:=auth.uid();
  v_customer_status text;
  v_provider_status text;
  v_verification text;
  v_conversation uuid;
begin
  if v_customer is null then raise exception 'not_authenticated'; end if;
  select account_status into v_customer_status from public.profiles where id=v_customer and role='customer';
  if not found or v_customer_status is distinct from 'active' then raise exception 'forbidden'; end if;
  if p_provider_profile_id is null or v_customer=p_provider_profile_id then raise exception 'provider_not_found'; end if;
  select p.verification_status,pr.account_status into v_verification,v_provider_status
    from public.provider_profiles p
    join public.profiles pr on pr.id=p.id
    where p.id=p_provider_profile_id;
  if not found or v_verification is distinct from 'approved' or v_provider_status is distinct from 'active' then raise exception 'provider_not_bookable'; end if;
  if not exists (
    select 1
    from public.providers p
    where p.provider_profile_id=p_provider_profile_id
      and p.listing_kind='real'
      and p.published_at is not null
  ) then raise exception 'provider_not_bookable'; end if;
  select c.id into v_conversation
    from public.conversations c
    join public.conversation_participants cp1 on cp1.conversation_id=c.id and cp1.user_id=v_customer
    join public.conversation_participants cp2 on cp2.conversation_id=c.id and cp2.user_id=p_provider_profile_id
    where c.booking_id is null limit 1;
  if v_conversation is not null then return v_conversation; end if;
  insert into public.conversations default values returning id into v_conversation;
  insert into public.conversation_participants(conversation_id,user_id) values(v_conversation,v_customer),(v_conversation,p_provider_profile_id);
  return v_conversation;
end
$function$;
