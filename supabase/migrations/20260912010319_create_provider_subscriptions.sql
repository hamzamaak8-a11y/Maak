create table public.provider_subscriptions (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.provider_profiles(id) on delete cascade,
  plan_id text not null check (plan_id in ('basic','premium','featured')),
  status text not null default 'active' check (status in ('active','cancelled','expired')),
  start_date timestamptz not null default now(),
  end_date timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint provider_subscriptions_valid_dates check (end_date >= start_date)
);

create index provider_subscriptions_provider_dates_idx
  on public.provider_subscriptions(provider_id, start_date desc);

create unique index provider_subscriptions_one_active_idx
  on public.provider_subscriptions(provider_id)
  where status = 'active';

alter table public.provider_subscriptions enable row level security;

grant select, insert, update, delete on public.provider_subscriptions to authenticated;
revoke all on public.provider_subscriptions from anon;

create policy "provider subscriptions select own"
on public.provider_subscriptions
for select
to authenticated
using ((select auth.uid()) = provider_id);

create policy "provider subscriptions insert own"
on public.provider_subscriptions
for insert
to authenticated
with check ((select auth.uid()) = provider_id);

create policy "provider subscriptions update own"
on public.provider_subscriptions
for update
to authenticated
using ((select auth.uid()) = provider_id)
with check ((select auth.uid()) = provider_id);

create policy "provider subscriptions delete own"
on public.provider_subscriptions
for delete
to authenticated
using ((select auth.uid()) = provider_id);

create trigger provider_subscriptions_set_updated_at
before update on public.provider_subscriptions
for each row execute function public.set_updated_at();

create or replace function public.subscribe_provider(p_plan_id text)
returns public.provider_subscriptions
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_row public.provider_subscriptions;
  v_provider_id uuid;
begin
  perform public.require_auth_uid();
  v_provider_id := auth.uid();

  if p_plan_id not in ('basic', 'premium', 'featured') then
    raise exception 'invalid_plan';
  end if;

  if not exists (
    select 1
    from public.provider_profiles pp
    join public.profiles p on p.id = pp.id
    where pp.id = v_provider_id
      and p.role = 'provider'
      and p.account_status = 'active'
      and pp.verification_status = 'approved'
  ) then
    raise exception 'forbidden';
  end if;

  update public.provider_subscriptions
  set status = 'expired', updated_at = now()
  where provider_id = v_provider_id
    and status = 'active'
    and end_date <= now();

  update public.provider_subscriptions
  set status = 'cancelled', end_date = least(end_date, now()), updated_at = now()
  where provider_id = v_provider_id
    and status = 'active';

  insert into public.provider_subscriptions (
    provider_id, plan_id, status, start_date, end_date
  )
  values (
    v_provider_id, p_plan_id, 'active', now(), now() + interval '30 days'
  )
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.cancel_subscription()
returns public.provider_subscriptions
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_row public.provider_subscriptions;
begin
  perform public.require_auth_uid();

  update public.provider_subscriptions
  set status = 'cancelled',
      end_date = least(end_date, now()),
      updated_at = now()
  where provider_id = auth.uid()
    and status = 'active'
    and end_date > now()
  returning * into v_row;

  if v_row.id is null then
    raise exception 'not_found';
  end if;

  return v_row;
end;
$$;

create or replace function public.get_provider_subscription()
returns setof public.provider_subscriptions
language plpgsql
security invoker
set search_path = public
as $$
begin
  perform public.require_auth_uid();

  update public.provider_subscriptions
  set status = 'expired', updated_at = now()
  where provider_id = auth.uid()
    and status = 'active'
    and end_date <= now();

  return query
  select *
  from public.provider_subscriptions
  where provider_id = auth.uid()
  order by case when status = 'active' then 0 else 1 end, start_date desc
  limit 1;
end;
$$;

revoke execute on function public.subscribe_provider(text) from public, anon, authenticated;
revoke execute on function public.cancel_subscription() from public, anon, authenticated;
revoke execute on function public.get_provider_subscription() from public, anon, authenticated;

grant execute on function public.subscribe_provider(text) to authenticated;
grant execute on function public.cancel_subscription() to authenticated;
grant execute on function public.get_provider_subscription() to authenticated;
