-- Starting a direct chat with a provider twice at the same moment (double tap, two devices) created two conversations for the same
-- customer and provider: both transactions looked, found nothing, and both inserted.
--
-- The lookup/insert now runs under a transaction-scoped advisory lock keyed by the pair, so the second caller waits for the first, finds
-- its conversation and returns it. When duplicates already exist the OLDEST one is returned, so every caller converges on the same thread.
-- Existing conversations and messages are not merged, moved or deleted.

create or replace function public.get_or_create_provider_conversation(p_provider_profile_id uuid)
returns uuid
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_customer uuid := auth.uid();
  v_customer_status text;
  v_provider_status text;
  v_verification text;
  v_conversation uuid;
begin
  if v_customer is null then
    raise exception 'not_authenticated';
  end if;

  select p.account_status
    into v_customer_status
  from public.profiles as p
  where p.id = v_customer
    and p.role = 'customer';

  if not found or v_customer_status is distinct from 'active' then
    raise exception 'forbidden';
  end if;

  if p_provider_profile_id is null or v_customer = p_provider_profile_id then
    raise exception 'provider_not_found';
  end if;

  select pp.verification_status, pr.account_status
    into v_verification, v_provider_status
  from public.provider_profiles as pp
  join public.profiles as pr on pr.id = pp.id
  where pp.id = p_provider_profile_id;

  if not found
     or v_verification is distinct from 'approved'
     or v_provider_status is distinct from 'active' then
    raise exception 'provider_not_bookable';
  end if;

  if not exists (
    select 1
    from public.providers as p
    where p.provider_profile_id = p_provider_profile_id
      and p.listing_kind = 'real'
      and p.published_at is not null
  ) then
    raise exception 'provider_not_bookable';
  end if;

  -- one at a time per (customer, provider) pair
  perform pg_advisory_xact_lock(hashtextextended('direct-chat:' || v_customer::text || ':' || p_provider_profile_id::text, 0));

  select c.id
    into v_conversation
  from public.conversations as c
  join public.conversation_participants as cp_customer
    on cp_customer.conversation_id = c.id
   and cp_customer.user_id = v_customer
  join public.conversation_participants as cp_provider
    on cp_provider.conversation_id = c.id
   and cp_provider.user_id = p_provider_profile_id
  where c.booking_id is null
  order by c.created_at, c.id
  limit 1;

  if v_conversation is not null then
    return v_conversation;
  end if;

  insert into public.conversations default values
  returning id into v_conversation;

  insert into public.conversation_participants(conversation_id, user_id)
  values
    (v_conversation, v_customer),
    (v_conversation, p_provider_profile_id);

  return v_conversation;
end
$function$;
