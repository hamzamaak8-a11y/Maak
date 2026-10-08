-- Administration panel back-end: user directory with e-mail / last sign-in, user overview, platform statistics,
-- announcements and safe user deletion. Every function re-checks that the CALLER is an active admin
-- (profiles.role = 'admin' and account_status = 'active'); nothing here is reachable by customers, providers or anon.

create or replace function public.maak_assert_admin()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null or not exists (
    select 1 from public.profiles p where p.id = v_uid and p.role = 'admin' and p.account_status = 'active'
  ) then
    raise exception 'forbidden';
  end if;
  return v_uid;
end;
$$;

revoke all on function public.maak_assert_admin() from public, anon;
grant execute on function public.maak_assert_admin() to authenticated;

-- 1) Directory ------------------------------------------------------------------------------------------------
create or replace function public.admin_list_users(
  p_search text default null,
  p_role text default null,
  p_status text default null,
  p_limit integer default 50,
  p_offset integer default 0
)
returns table (
  id uuid, email text, full_name text, phone text, city text, role text, account_status text,
  created_at timestamptz, last_sign_in_at timestamptz, provider_status text, total_count bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare v_like text;
begin
  perform public.maak_assert_admin();
  if p_role is not null and p_role not in ('customer', 'provider', 'admin') then raise exception 'invalid_filter'; end if;
  if p_status is not null and p_status not in ('active', 'suspended') then raise exception 'invalid_filter'; end if;
  v_like := case when p_search is null or btrim(p_search) = '' then null
                 else '%' || replace(replace(replace(btrim(p_search), '\', '\\'), '%', '\%'), '_', '\_') || '%' end;
  return query
    select p.id, u.email::text, p.full_name, p.phone, p.city, p.role, p.account_status, p.created_at, u.last_sign_in_at,
           pp.verification_status::text, count(*) over()
    from public.profiles p
    join auth.users u on u.id = p.id
    left join public.provider_profiles pp on pp.id = p.id
    where (p_role is null or p.role = p_role)
      and (p_status is null or p.account_status = p_status)
      and (v_like is null or u.email ilike v_like or p.full_name ilike v_like or p.phone ilike v_like or p.city ilike v_like)
    order by p.created_at desc
    limit least(greatest(coalesce(p_limit, 50), 1), 200)
    offset greatest(coalesce(p_offset, 0), 0);
end;
$$;

revoke all on function public.admin_list_users(text, text, text, integer, integer) from public, anon;
grant execute on function public.admin_list_users(text, text, text, integer, integer) to authenticated;

-- 2) One user at a glance -----------------------------------------------------------------------------------
create or replace function public.admin_user_overview(p_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare v jsonb;
begin
  perform public.maak_assert_admin();
  select jsonb_build_object(
    'id', p.id, 'email', u.email, 'full_name', p.full_name, 'phone', p.phone, 'city', p.city,
    'role', p.role, 'account_status', p.account_status, 'created_at', p.created_at,
    'last_sign_in_at', u.last_sign_in_at, 'email_confirmed', u.email_confirmed_at is not null,
    'provider_status', pp.verification_status, 'profession', pp.profession, 'service_category', pp.service_category,
    'rejection_reason', pp.rejection_reason,
    'listing_published', exists (select 1 from public.providers l where l.provider_profile_id = p.id and l.published_at is not null),
    'bookings_as_customer', (select count(*) from public.bookings b where b.customer_id = p.id),
    'bookings_as_provider', (select count(*) from public.bookings b where b.provider_id = p.id),
    'open_bookings', (select count(*) from public.bookings b where (b.customer_id = p.id or b.provider_id = p.id) and b.status in ('pending', 'accepted', 'in_progress')),
    'reviews_written', (select count(*) from public.reviews r where r.customer_id = p.id),
    'reviews_received', (select count(*) from public.reviews r where r.provider_id = p.id),
    'reports_against', (select count(*) from public.content_reports c where c.reported_user_id = p.id),
    'open_reports_against', (select count(*) from public.content_reports c where c.reported_user_id = p.id and c.status = 'open')
  ) into v
  from public.profiles p
  join auth.users u on u.id = p.id
  left join public.provider_profiles pp on pp.id = p.id
  where p.id = p_user;
  if v is null then raise exception 'not_found'; end if;
  return v;
end;
$$;

revoke all on function public.admin_user_overview(uuid) from public, anon;
grant execute on function public.admin_user_overview(uuid) to authenticated;

-- 3) Platform statistics (dashboard) -------------------------------------------------------------------------
create or replace function public.admin_overview_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare v jsonb;
begin
  perform public.maak_assert_admin();
  select jsonb_build_object(
    'customers', (select count(*) from public.profiles where role = 'customer'),
    'providers', (select count(*) from public.profiles p where p.role = 'provider'),
    'approved_providers', (select count(*) from public.provider_profiles where verification_status = 'approved'),
    'pending_applications', (select count(*) from public.provider_profiles where verification_status = 'pending'),
    'open_reports', (select count(*) from public.content_reports where status = 'open'),
    'suspended_accounts', (select count(*) from public.profiles where account_status = 'suspended'),
    'total_bookings', (select count(*) from public.bookings),
    'open_bookings', (select count(*) from public.bookings where status in ('pending', 'accepted', 'in_progress')),
    'bookings_7d', (select count(*) from public.bookings where created_at > now() - interval '7 days'),
    'bookings_30d', (select count(*) from public.bookings where created_at > now() - interval '30 days'),
    'completed_30d', (select count(*) from public.bookings where status = 'completed' and completed_at > now() - interval '30 days'),
    'new_users_7d', (select count(*) from public.profiles where role <> 'admin' and created_at > now() - interval '7 days'),
    'new_users_30d', (select count(*) from public.profiles where role <> 'admin' and created_at > now() - interval '30 days'),
    'unpaid_completed', (select count(*) from public.bookings where status = 'completed' and price is not null and payment_status <> 'paid'),
    'paid_30d', coalesce((select jsonb_object_agg(currency, total) from (
        select currency, round(sum(price), 2) as total from public.bookings
        where payment_status = 'paid' and paid_at > now() - interval '30 days' and price is not null group by currency) t), '{}'::jsonb),
    'reviews', (select count(*) from public.reviews),
    'daily', coalesce((select jsonb_agg(jsonb_build_object('day', d::date,
        'bookings', (select count(*) from public.bookings b where b.created_at::date = d::date),
        'users', (select count(*) from public.profiles p where p.role <> 'admin' and p.created_at::date = d::date)) order by d)
      from generate_series(current_date - 13, current_date, interval '1 day') d), '[]'::jsonb)
  ) into v;
  return v;
end;
$$;

revoke all on function public.admin_overview_stats() from public, anon;
grant execute on function public.admin_overview_stats() to authenticated;

-- 4) Announcements -------------------------------------------------------------------------------------------
create or replace function public.admin_send_announcement(p_audience text, p_title text, p_body text)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := public.maak_assert_admin();
  v_title text := btrim(coalesce(p_title, ''));
  v_body text := btrim(coalesce(p_body, ''));
  v_count integer;
begin
  if p_audience not in ('all', 'customers', 'providers') then raise exception 'invalid_audience'; end if;
  if char_length(v_title) not between 1 and 80 then raise exception 'invalid_title'; end if;
  if char_length(v_body) not between 1 and 500 then raise exception 'invalid_body'; end if;

  insert into public.notifications(user_id, type, title, body, metadata)
  select p.id, 'announcement', v_title, v_body, jsonb_build_object('announcement', true)
  from public.profiles p
  where p.account_status = 'active'
    and case p_audience when 'customers' then p.role = 'customer'
                        when 'providers' then p.role = 'provider'
                        else p.role in ('customer', 'provider') end;
  get diagnostics v_count = row_count;

  insert into public.admin_audit_log(admin_id, action, target_type, target_id, metadata)
  values (v_admin, 'announcement_sent', 'announcement', null, jsonb_build_object('audience', p_audience, 'title', v_title, 'recipients', v_count));
  return v_count;
end;
$$;

revoke all on function public.admin_send_announcement(text, text, text) from public, anon;
grant execute on function public.admin_send_announcement(text, text, text) to authenticated;

-- 5) Delete a user (never an admin, never yourself, never with open bookings) -----------------------
create or replace function public.admin_delete_user(p_target uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := public.maak_assert_admin();
  v_role text;
  v_email text;
begin
  if p_target is null or p_target = v_admin then raise exception 'invalid_target'; end if;
  select p.role, u.email into v_role, v_email from public.profiles p join auth.users u on u.id = p.id where p.id = p_target;
  if not found then raise exception 'not_found'; end if;
  if v_role = 'admin' then raise exception 'admin_cannot_delete'; end if;
  if exists (select 1 from public.bookings b where (b.customer_id = p_target or b.provider_id = p_target) and b.status in ('pending', 'accepted', 'in_progress')) then
    raise exception 'active_bookings';
  end if;

  insert into public.admin_audit_log(admin_id, action, target_type, target_id, metadata)
  values (v_admin, 'user_deleted', 'profile', p_target, jsonb_build_object('email', v_email, 'role', v_role));

  delete from public.providers where provider_profile_id = p_target and listing_kind = 'real';
  delete from auth.users where id = p_target;
end;
$$;

revoke all on function public.admin_delete_user(uuid) from public, anon;
grant execute on function public.admin_delete_user(uuid) to authenticated;
