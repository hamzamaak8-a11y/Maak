-- Let anyone (including signed-out visitors) read the ACTIVE price list of a published, approved,
-- active provider, so customers can see what a provider charges before booking.
-- Providers keep full control of their own rows through the existing owner policies.
create or replace function public.is_published_provider(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.providers p
    join public.provider_profiles pp on pp.id = p.provider_profile_id
    join public.profiles pr on pr.id = pp.id
    where p.provider_profile_id = p_profile_id
      and p.listing_kind = 'real'
      and p.published_at is not null
      and pp.verification_status = 'approved'
      and pr.account_status = 'active'
  );
$$;

revoke all on function public.is_published_provider(uuid) from public;
grant execute on function public.is_published_provider(uuid) to anon, authenticated;

drop policy if exists "provider services public read" on public.provider_services;
create policy "provider services public read" on public.provider_services
  for select to anon, authenticated
  using (is_active and public.is_published_provider(provider_id));

grant select on public.provider_services to anon;
