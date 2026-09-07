-- Regression fix discovered by an actual anon-RLS test.
-- The previous marketplace policy attempted to read provider_profiles from the
-- anon role inside the policy expression, which is intentionally not allowed.
-- Publication eligibility is already enforced by refresh_provider_listing and
-- admin/provider lifecycle guards; the public table policy should only expose
-- real, published, provider-linked listings.

drop policy if exists providers_select_published_real on public.providers;
create policy providers_select_published_real on public.providers
for select to public
using (
  listing_kind = 'real'
  and published_at is not null
  and provider_profile_id is not null
);

-- A booking request is a requested appointment time, not an availability claim.
-- Still, the platform must never persist a time in the past.
create or replace function public.create_booking(p_provider_listing_id integer, p_service_category text, p_service_description text, p_service_date timestamp with time zone, p_location_text text, p_customer_note text default '')
returns public.bookings
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_customer uuid:=public.require_auth_uid();
  v_customer_status text;
  v_provider_profile_id uuid;
  v_provider_status text;
  v_verification text;
  v_customer_name text;
  v_row public.bookings;
begin
  select account_status,full_name into v_customer_status,v_customer_name
  from public.profiles where id=v_customer and role='customer';
  if not found or v_customer_status is distinct from 'active' then raise exception 'forbidden'; end if;
  if p_service_category is null or btrim(p_service_category)='' then raise exception 'invalid_service'; end if;
  if p_service_date is not null and p_service_date <= now() then raise exception 'invalid_service_date'; end if;

  select provider_profile_id into v_provider_profile_id
  from public.providers
  where id=p_provider_listing_id and listing_kind='real' and published_at is not null;
  if not found or v_provider_profile_id is null then raise exception 'provider_not_found'; end if;

  select pp.verification_status,pr.account_status into v_verification,v_provider_status
  from public.provider_profiles pp join public.profiles pr on pr.id=pp.id
  where pp.id=v_provider_profile_id;
  if not found or v_verification is distinct from 'approved' or v_provider_status is distinct from 'active' then raise exception 'provider_not_bookable'; end if;

  insert into public.bookings(customer_id,provider_id,provider_listing_id,service_category,service_description,service_date,location_text,customer_note,status,customer_name)
  values(v_customer,v_provider_profile_id,p_provider_listing_id,btrim(p_service_category),coalesce(p_service_description,''),p_service_date,p_location_text,coalesce(p_customer_note,''),'pending',v_customer_name)
  returning * into v_row;
  return v_row;
end
$function$;