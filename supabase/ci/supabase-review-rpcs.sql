-- CI-only review RPC baseline.
-- These functions predate the repository's incremental review migrations and
-- exist in the isolated runner only so the tracked migrations can be replayed.

create or replace function public.admin_toggle_review_visibility(p_review_id uuid)
returns public.reviews
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_admin_status text;
  v_row public.reviews;
begin
  select p.account_status into v_admin_status
  from public.profiles p
  where p.id = v_uid and p.role = 'admin';

  if v_uid is null or v_admin_status is distinct from 'active' then
    raise exception 'forbidden';
  end if;

  select * into v_row from public.reviews r where r.id = p_review_id for update;
  if not found then raise exception 'review_not_found'; end if;

  update public.reviews
  set is_hidden = not v_row.is_hidden
  where id = p_review_id
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.get_admin_reviews(p_limit integer default 50, p_offset integer default 0)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_admin_status text;
  v_limit integer := greatest(1, least(coalesce(p_limit, 50), 100));
  v_offset integer := greatest(coalesce(p_offset, 0), 0);
  v_total integer;
  v_reviews jsonb;
begin
  select p.account_status into v_admin_status
  from public.profiles p
  where p.id = v_uid and p.role = 'admin';

  if v_uid is null or v_admin_status is distinct from 'active' then
    raise exception 'forbidden';
  end if;

  select count(*)::integer into v_total from public.reviews;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', r.id,
      'booking_id', r.booking_id,
      'customer_id', r.customer_id,
      'provider_id', r.provider_id,
      'rating', r.rating,
      'comment', r.comment,
      'is_hidden', r.is_hidden,
      'created_at', r.created_at,
      'customer_name', cp.full_name,
      'provider_name', pp.full_name
    ) order by r.created_at desc
  ), '[]'::jsonb)
  into v_reviews
  from public.reviews r
  left join public.profiles cp on cp.id = r.customer_id
  left join public.profiles pp on pp.id = r.provider_id
  offset v_offset limit v_limit;

  return jsonb_build_object('reviews', v_reviews, 'total_count', v_total);
end;
$$;
