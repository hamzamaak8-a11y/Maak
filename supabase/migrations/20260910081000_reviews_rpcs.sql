create or replace function public.submit_review(
  p_booking_id uuid,
  p_rating integer,
  p_comment text default null
)
returns public.reviews
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_customer_id uuid;
  v_provider_id uuid;
  v_status text;
  v_row public.reviews;
  v_comment text;
begin
  if v_uid is null then
    raise exception 'forbidden';
  end if;

  if p_booking_id is null then
    raise exception 'booking_not_found';
  end if;

  if p_rating is null or p_rating < 1 or p_rating > 5 then
    raise exception 'invalid_rating';
  end if;

  v_comment := nullif(btrim(coalesce(p_comment, '')), '');
  if v_comment is not null and char_length(v_comment) > 1000 then
    raise exception 'comment_too_long';
  end if;

  select b.customer_id, b.provider_id, b.status
    into v_customer_id, v_provider_id, v_status
  from public.bookings b
  where b.id = p_booking_id
  for share;

  if not found then
    raise exception 'booking_not_found';
  end if;

  if v_customer_id is distinct from v_uid then
    raise exception 'forbidden';
  end if;

  if v_status is distinct from 'completed' then
    raise exception 'booking_not_completed';
  end if;

  if exists (select 1 from public.reviews r where r.booking_id = p_booking_id) then
    raise exception 'already_reviewed';
  end if;

  insert into public.reviews (booking_id, customer_id, provider_id, rating, comment)
  values (p_booking_id, v_uid, v_provider_id, p_rating, v_comment)
  returning * into v_row;

  return v_row;
exception
  when unique_violation then
    raise exception 'already_reviewed';
end;
$$;

revoke all on function public.submit_review(uuid, integer, text) from public;
grant execute on function public.submit_review(uuid, integer, text) to authenticated;

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

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', r.id,
      'booking_id', r.booking_id,
      'rating', r.rating,
      'comment', r.comment,
      'created_at', r.created_at
    ) order by r.created_at desc
  ), '[]'::jsonb)
    into v_reviews
  from public.reviews r
  where r.provider_id = p_provider_id
    and r.is_hidden = false
  offset v_offset
  limit v_limit;

  return jsonb_build_object(
    'reviews', v_reviews,
    'total_count', v_total,
    'average_rating', v_average
  );
end;
$$;

revoke all on function public.get_provider_reviews(uuid, integer, integer) from public;
grant execute on function public.get_provider_reviews(uuid, integer, integer) to anon, authenticated;
