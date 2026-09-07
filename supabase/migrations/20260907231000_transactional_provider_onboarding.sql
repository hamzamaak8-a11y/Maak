-- Keep provider onboarding atomic and server-authorized.
-- Safe to replay: CREATE OR REPLACE + REVOKE/GRANT are idempotent.

create or replace function public.submit_provider_onboarding(
  p_full_name text,
  p_phone text,
  p_city text,
  p_profession text,
  p_service_category text,
  p_bio text,
  p_experience_years integer,
  p_services text[],
  p_price_from numeric,
  p_service_radius_km numeric
)
returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_uid uuid := auth.uid();
  v_status text;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select account_status into v_status from public.profiles where id=v_uid;
  if not found or v_status is distinct from 'active' then raise exception 'forbidden'; end if;
  if nullif(btrim(p_full_name),'') is null then raise exception 'invalid_full_name'; end if;
  if nullif(btrim(p_phone),'') is null then raise exception 'invalid_phone'; end if;
  if nullif(btrim(p_city),'') is null then raise exception 'invalid_city'; end if;
  if nullif(btrim(p_profession),'') is null then raise exception 'invalid_profession'; end if;
  if nullif(btrim(p_service_category),'') is null then raise exception 'invalid_service_category'; end if;
  if nullif(btrim(p_bio),'') is null then raise exception 'invalid_bio'; end if;
  if p_experience_years is not null and (p_experience_years < 0 or p_experience_years > 99) then raise exception 'invalid_experience'; end if;
  if p_price_from is not null and p_price_from < 0 then raise exception 'invalid_price'; end if;
  if p_service_radius_km is not null and p_service_radius_km <= 0 then raise exception 'invalid_radius'; end if;
  if p_services is null or array_length(p_services,1) is null or array_length(p_services,1) < 1 then raise exception 'services_required'; end if;

  if not exists (
    select 1 from public.provider_documents d
    where d.provider_id=v_uid and d.document_type='national_id' and d.status in ('pending','approved')
  ) then raise exception 'documents_required'; end if;
  if not exists (
    select 1 from public.provider_documents d
    where d.provider_id=v_uid and d.document_type='profile_photo' and d.status in ('pending','approved')
  ) then raise exception 'documents_required'; end if;

  update public.profiles
    set full_name=btrim(p_full_name), phone=btrim(p_phone), city=btrim(p_city), updated_at=now()
  where id=v_uid and account_status='active';

  insert into public.provider_profiles(
    id,profession,service_category,bio,experience_years,services,price_from,service_radius_km,
    verification_status,rejection_reason,updated_at
  ) values (
    v_uid,btrim(p_profession),btrim(p_service_category),btrim(p_bio),p_experience_years,p_services,
    p_price_from,p_service_radius_km,'pending',null,now()
  )
  on conflict (id) do update set
    profession=excluded.profession,
    service_category=excluded.service_category,
    bio=excluded.bio,
    experience_years=excluded.experience_years,
    services=excluded.services,
    price_from=excluded.price_from,
    service_radius_km=excluded.service_radius_km,
    verification_status='pending',
    rejection_reason=null,
    updated_at=now();
end
$function$;

revoke execute on function public.submit_provider_onboarding(text,text,text,text,text,text,integer,text[],numeric,numeric) from public;
revoke execute on function public.submit_provider_onboarding(text,text,text,text,text,text,integer,text[],numeric,numeric) from anon;
grant execute on function public.submit_provider_onboarding(text,text,text,text,text,text,integer,text[],numeric,numeric) to authenticated;
