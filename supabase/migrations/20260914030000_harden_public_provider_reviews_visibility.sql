-- Restrict public provider review aggregates to genuinely public provider listings.
-- Preserves existing review behavior for published, approved, active providers while
-- preventing anonymous access to reviews attached to unpublished provider profiles.

create or replace function public.get_provider_reviews(p_provider_id uuid, p_limit integer default 10, p_offset integer default 0)
returns jsonb
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_limit integer := greatest(1, least(coalesce(p_limit, 10), 50));
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_total integer;
  v_average numeric;
  v_reviews jsonb;
begin
  if p_provider_id is null then
    return jsonb_build_object('reviews', '[]'::jsonb, 'total_count', 0, 'average_rating', 0);
  end if;

  if not exists (
    select 1
    from public.providers pr
    join public.provider_profiles pp on pp.id = pr.provider_profile_id
    join public.profiles p on p.id = pp.id
    where pr.provider_profile_id = p_provider_id
      and pr.listing_kind = 'real'
      and pr.published_at is not null
      and pp.verification_status = 'approved'
      and p.account_status = 'active'
  ) then
    return jsonb_build_object('reviews', '[]'::jsonb, 'total_count', 0, 'average_rating', 0);
  end if;

  select count(*)::integer, coalesce(round(avg(r.rating)::numeric, 2), 0)
    into v_total, v_average
  from public.reviews r
  where r.provider_id = p_provider_id
    and r.is_hidden = false;

  select coalesce(jsonb_agg(x.review order by x.created_at desc), '[]'::jsonb)
    into v_reviews
  from (
    select
      jsonb_build_object(
        'id', r.id,
        'booking_id', r.booking_id,
        'rating', r.rating,
        'comment', r.comment,
        'created_at', r.created_at
      ) as review,
      r.created_at
    from public.reviews r
    where r.provider_id = p_provider_id
      and r.is_hidden = false
    order by r.created_at desc
    offset v_offset
    limit v_limit
  ) x;

  return jsonb_build_object(
    'reviews', v_reviews,
    'total_count', v_total,
    'average_rating', v_average
  );
end;
$function$;
