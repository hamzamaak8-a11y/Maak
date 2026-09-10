create or replace function public.get_provider_reviews(
  p_provider_id uuid,
  p_limit integer default 10,
  p_offset integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
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
$$;

revoke execute on function public.get_provider_reviews(uuid, integer, integer) from public, anon, authenticated;
grant execute on function public.get_provider_reviews(uuid, integer, integer) to anon, authenticated;
