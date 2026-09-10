create or replace function public.get_admin_dashboard_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if not exists (
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
      and account_status = 'active'
  ) then
    raise exception 'forbidden';
  end if;

  with customer_stats as (
    select count(*) filter (where role = 'customer')::bigint as total_customers
    from public.profiles
  ),
  provider_stats as (
    select
      count(*)::bigint as total_providers,
      count(*) filter (where verification_status = 'approved')::bigint as approved_providers,
      count(*) filter (where verification_status = 'pending')::bigint as pending_providers,
      count(*) filter (where verification_status = 'rejected')::bigint as rejected_providers
    from public.provider_profiles
  ),
  booking_stats as (
    select
      count(*)::bigint as total_bookings,
      count(*) filter (where status = 'pending')::bigint as pending,
      count(*) filter (where status = 'accepted')::bigint as accepted,
      count(*) filter (where status = 'rejected')::bigint as rejected,
      count(*) filter (where status = 'cancelled')::bigint as cancelled,
      count(*) filter (where status = 'in_progress')::bigint as in_progress,
      count(*) filter (where status = 'completed')::bigint as completed
    from public.bookings
  ),
  marketplace_stats as (
    select count(*)::bigint as published_listings
    from public.providers
    where listing_kind = 'real'
      and published_at is not null
      and provider_profile_id is not null
  )
  select jsonb_build_object(
    'total_customers', customer_stats.total_customers,
    'total_providers', provider_stats.total_providers,
    'approved_providers', provider_stats.approved_providers,
    'total_bookings', booking_stats.total_bookings,
    'bookings_by_status', jsonb_build_object(
      'pending', booking_stats.pending,
      'accepted', booking_stats.accepted,
      'rejected', booking_stats.rejected,
      'cancelled', booking_stats.cancelled,
      'in_progress', booking_stats.in_progress,
      'completed', booking_stats.completed
    ),
    'providers_by_status', jsonb_build_object(
      'pending', provider_stats.pending_providers,
      'approved', provider_stats.approved_providers,
      'rejected', provider_stats.rejected_providers
    ),
    'published_listings', marketplace_stats.published_listings
  )
  into result
  from customer_stats, provider_stats, booking_stats, marketplace_stats;

  return result;
end;
$$;

revoke execute on function public.get_admin_dashboard_stats() from public;
revoke execute on function public.get_admin_dashboard_stats() from anon;
grant execute on function public.get_admin_dashboard_stats() to authenticated;
