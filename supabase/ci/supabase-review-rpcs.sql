-- CI-only review baseline.
-- This creates the pre-existing review relation/function surface required by the
-- incremental tracked migrations. It is NEVER a production migration.

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  customer_id uuid not null references auth.users(id) on delete cascade,
  provider_id uuid not null references public.provider_profiles(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text null,
  is_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  constraint reviews_booking_unique unique (booking_id),
  constraint reviews_comment_length check (comment is null or char_length(comment) <= 1000)
);

create index if not exists reviews_provider_created_idx
  on public.reviews(provider_id, created_at desc);

alter table public.reviews enable row level security;
revoke all on public.reviews from anon, authenticated;

drop policy if exists reviews_public_select on public.reviews;
create policy reviews_public_select
  on public.reviews for select to anon, authenticated
  using (is_hidden = false);

drop policy if exists reviews_admin_select on public.reviews;
create policy reviews_admin_select
  on public.reviews for select to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and p.account_status = 'active'
  ));

grant select on public.reviews to anon, authenticated;

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
