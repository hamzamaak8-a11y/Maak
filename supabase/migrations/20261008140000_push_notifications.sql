-- Push notifications for people whose app is closed (free path: Expo Push Service -> FCM on Android).
--
-- 1. public.push_tokens      one row per device token; a user can read and delete only their own rows, writes go through RPCs.
-- 2. register_push_token()   / unregister_push_token()   called by the app after the user allows notifications.
-- 3. private.dispatch_push() AFTER INSERT trigger on public.notifications. It is DORMANT until the owner inserts ONE row into
--    private.push_config (Worker URL + shared secret) and the pg_net extension is enabled. It never blocks or fails the
--    notification insert: any problem is swallowed.
--
-- Nothing here is secret: the shared secret is entered by the owner in the SQL editor and is never part of the repository.

create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.push_config (
  id boolean primary key default true check (id),   -- a single row
  worker_url text not null,                          -- e.g. https://maak.hamzamaak8.workers.dev/push/notify
  secret text not null check (char_length(secret) >= 24)
);
revoke all on private.push_config from public, anon, authenticated;

create table if not exists public.push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  token text not null unique,
  platform text not null check (platform in ('android', 'ios')),
  lang text not null default 'en' check (lang in ('ar', 'fr', 'en')),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index if not exists push_tokens_user_idx on public.push_tokens(user_id);

alter table public.push_tokens enable row level security;
revoke all on public.push_tokens from public, anon, authenticated;
grant select, delete on public.push_tokens to authenticated;
drop policy if exists push_tokens_select_own on public.push_tokens;
create policy push_tokens_select_own on public.push_tokens for select to authenticated using (user_id = (select auth.uid()));
drop policy if exists push_tokens_delete_own on public.push_tokens;
create policy push_tokens_delete_own on public.push_tokens for delete to authenticated using (user_id = (select auth.uid()));

create or replace function public.register_push_token(p_token text, p_platform text, p_lang text default 'en')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_token text := btrim(coalesce(p_token, ''));
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  if v_token !~ '^Expo(nent)?PushToken\[[A-Za-z0-9_-]{10,}\]$' then raise exception 'invalid_push_token'; end if;
  if p_platform not in ('android', 'ios') then raise exception 'invalid_push_token'; end if;
  if not exists (select 1 from public.profiles p where p.id = v_uid and p.account_status = 'active') then raise exception 'forbidden'; end if;

  -- a device that signs in with another account moves to that account
  insert into public.push_tokens(user_id, token, platform, lang)
  values (v_uid, v_token, p_platform, case when p_lang in ('ar', 'fr', 'en') then p_lang else 'en' end)
  on conflict (token) do update set user_id = excluded.user_id, platform = excluded.platform, lang = excluded.lang, last_seen_at = now();

  -- keep a user's list short: newest 10 devices
  delete from public.push_tokens t
  where t.user_id = v_uid and t.id in (select id from public.push_tokens where user_id = v_uid order by last_seen_at desc offset 10);
end;
$$;

create or replace function public.unregister_push_token(p_token text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  delete from public.push_tokens where token = btrim(coalesce(p_token, '')) and user_id = auth.uid();
end;
$$;

revoke all on function public.register_push_token(text, text, text) from public, anon, authenticated;
revoke all on function public.unregister_push_token(text) from public, anon, authenticated;
grant execute on function public.register_push_token(text, text, text) to authenticated;
grant execute on function public.unregister_push_token(text) to authenticated;

create or replace function private.dispatch_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  cfg record;
begin
  begin
    select c.worker_url, c.secret into cfg from private.push_config c limit 1;
    if found
       and to_regprocedure('net.http_post(text,jsonb,jsonb,jsonb,integer)') is not null
       and exists (select 1 from public.push_tokens t where t.user_id = new.user_id) then
      execute 'select net.http_post(url := $1, body := $2, headers := $3, timeout_milliseconds := 3000)'
        using cfg.worker_url,
              jsonb_build_object('user_id', new.user_id, 'type', new.type, 'title', new.title, 'body', new.body, 'metadata', coalesce(new.metadata, '{}'::jsonb)),
              jsonb_build_object('Content-Type', 'application/json', 'X-Maak-Push-Secret', cfg.secret);
    end if;
  exception when others then
    null; -- push must never break the notification itself
  end;
  return new;
end;
$$;

revoke all on function private.dispatch_push() from public, anon, authenticated;

drop trigger if exists notifications_dispatch_push on public.notifications;
create trigger notifications_dispatch_push
  after insert on public.notifications
  for each row execute function private.dispatch_push();
