create table if not exists public.provider_services (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references public.provider_profiles(id) on delete cascade,
  name text not null,
  description text,
  price numeric,
  currency text not null default 'USD',
  duration_minutes integer,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint provider_services_name_nonempty check (btrim(name) <> ''),
  constraint provider_services_price_nonnegative check (price is null or price >= 0),
  constraint provider_services_duration_positive check (duration_minutes is null or duration_minutes > 0),
  constraint provider_services_currency_valid check (currency ~ '^[A-Z]{3}$')
);

create index if not exists provider_services_provider_id_idx on public.provider_services(provider_id);
create index if not exists provider_services_active_idx on public.provider_services(provider_id, is_active);

alter table public.provider_services enable row level security;

create policy "provider services select own" on public.provider_services
  for select to authenticated using ((select auth.uid()) = provider_id);

create policy "provider services insert own" on public.provider_services
  for insert to authenticated with check ((select auth.uid()) = provider_id);

create policy "provider services update own" on public.provider_services
  for update to authenticated
  using ((select auth.uid()) = provider_id)
  with check ((select auth.uid()) = provider_id);

create policy "provider services delete own" on public.provider_services
  for delete to authenticated using ((select auth.uid()) = provider_id);

drop trigger if exists provider_services_set_updated_at on public.provider_services;
create trigger provider_services_set_updated_at
before update on public.provider_services
for each row execute function public.set_updated_at();

create or replace function public.add_provider_service(
  p_name text,
  p_description text default null,
  p_price numeric default null,
  p_currency text default 'USD',
  p_duration_minutes integer default null,
  p_is_active boolean default true
)
returns public.provider_services
language plpgsql
security invoker
set search_path = public
as $$
declare v_row public.provider_services;
begin
  perform public.require_auth_uid();
  if not exists (
    select 1
    from public.provider_profiles pp
    join public.profiles pr on pr.id = pp.id
    where pp.id = auth.uid()
      and pp.verification_status = 'approved'
      and pr.role = 'provider'
      and pr.account_status = 'active'
  ) then raise exception 'forbidden'; end if;

  insert into public.provider_services(provider_id, name, description, price, currency, duration_minutes, is_active)
  values (
    auth.uid(), btrim(p_name), nullif(btrim(p_description), ''), p_price,
    upper(btrim(coalesce(p_currency, 'USD'))), p_duration_minutes, coalesce(p_is_active, true)
  )
  returning * into v_row;
  return v_row;
end;
$$;

create or replace function public.update_provider_service(
  p_service_id uuid,
  p_name text,
  p_description text default null,
  p_price numeric default null,
  p_currency text default 'USD',
  p_duration_minutes integer default null,
  p_is_active boolean default true
)
returns public.provider_services
language plpgsql
security invoker
set search_path = public
as $$
declare v_row public.provider_services;
begin
  perform public.require_auth_uid();
  update public.provider_services
  set name = btrim(p_name),
      description = nullif(btrim(p_description), ''),
      price = p_price,
      currency = upper(btrim(coalesce(p_currency, 'USD'))),
      duration_minutes = p_duration_minutes,
      is_active = coalesce(p_is_active, true)
  where id = p_service_id and provider_id = auth.uid()
  returning * into v_row;
  if v_row.id is null then raise exception 'not_found'; end if;
  return v_row;
end;
$$;

create or replace function public.delete_provider_service(p_service_id uuid)
returns boolean
language plpgsql
security invoker
set search_path = public
as $$
declare v_deleted integer;
begin
  perform public.require_auth_uid();
  delete from public.provider_services where id = p_service_id and provider_id = auth.uid();
  get diagnostics v_deleted = row_count;
  if v_deleted = 0 then raise exception 'not_found'; end if;
  return true;
end;
$$;

create or replace function public.get_provider_services()
returns setof public.provider_services
language plpgsql
security invoker
set search_path = public
as $$
begin
  perform public.require_auth_uid();
  return query
    select * from public.provider_services
    where provider_id = auth.uid()
    order by is_active desc, created_at asc;
end;
$$;

grant select, insert, update, delete on public.provider_services to authenticated;
revoke all on function public.add_provider_service(text,text,numeric,text,integer,boolean) from public, anon;
revoke all on function public.update_provider_service(uuid,text,text,numeric,text,integer,boolean) from public, anon;
revoke all on function public.delete_provider_service(uuid) from public, anon;
revoke all on function public.get_provider_services() from public, anon;
grant execute on function public.add_provider_service(text,text,numeric,text,integer,boolean) to authenticated;
grant execute on function public.update_provider_service(uuid,text,text,numeric,text,integer,boolean) to authenticated;
grant execute on function public.delete_provider_service(uuid) to authenticated;
grant execute on function public.get_provider_services() to authenticated;
