-- User-generated-content moderation (App Store guideline 1.2 / Google Play UGC policy):
-- users can report another user, a review or a chat message; administrators review the queue.
--
-- All access goes through RPCs. The table itself is closed to clients (RLS on, no policies, no grants).
create table if not exists public.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references auth.users(id) on delete set null,
  reported_user_id uuid references auth.users(id) on delete set null,
  target_type text not null check (target_type in ('user', 'review', 'message')),
  target_id uuid not null,
  reason text not null check (reason in ('spam', 'abuse', 'fraud', 'inappropriate', 'other')),
  details text check (details is null or char_length(details) <= 1000),
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  resolution_note text check (resolution_note is null or char_length(resolution_note) <= 1000),
  resolved_by uuid references auth.users(id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists content_reports_status_created_idx on public.content_reports(status, created_at desc);
create index if not exists content_reports_reporter_idx on public.content_reports(reporter_id, created_at desc);

alter table public.content_reports enable row level security;
revoke all on public.content_reports from anon, authenticated, public;

-- Submit a report. Derives the reported user from the target and checks the reporter may see it.
create or replace function public.submit_report(p_target_type text, p_target_id uuid, p_reason text, p_details text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_status text;
  v_reported uuid;
  v_id uuid;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select account_status into v_status from public.profiles where id = v_uid;
  if v_status is distinct from 'active' then raise exception 'forbidden'; end if;
  if p_target_type not in ('user', 'review', 'message') or p_target_id is null then raise exception 'invalid_report'; end if;
  if p_reason not in ('spam', 'abuse', 'fraud', 'inappropriate', 'other') then raise exception 'invalid_report'; end if;
  if p_details is not null and char_length(p_details) > 1000 then raise exception 'invalid_report'; end if;

  if p_target_type = 'user' then
    select id into v_reported from public.profiles where id = p_target_id;
  elsif p_target_type = 'review' then
    select r.customer_id into v_reported
    from public.reviews r
    where r.id = p_target_id and (r.provider_id = v_uid or r.customer_id = v_uid or r.is_hidden = false);
  else
    select m.sender_id into v_reported
    from public.messages m
    join public.conversation_participants cp on cp.conversation_id = m.conversation_id and cp.user_id = v_uid
    where m.id = p_target_id;
  end if;

  if v_reported is null then raise exception 'not_found'; end if;
  if v_reported = v_uid then raise exception 'invalid_report'; end if;

  if (select count(*) from public.content_reports where reporter_id = v_uid and created_at > now() - interval '1 day') >= 20 then
    raise exception 'rate_limited';
  end if;

  insert into public.content_reports(reporter_id, reported_user_id, target_type, target_id, reason, details)
  values (v_uid, v_reported, p_target_type, p_target_id, p_reason, nullif(btrim(coalesce(p_details, '')), ''))
  returning id into v_id;
  return v_id;
end;
$$;

revoke all on function public.submit_report(text, uuid, text, text) from public, anon;
grant execute on function public.submit_report(text, uuid, text, text) to authenticated;

-- Admin queue.
create or replace function public.admin_list_reports(p_status text default 'open')
returns table (
  id uuid, target_type text, target_id uuid, reason text, details text, status text, resolution_note text, created_at timestamptz,
  reporter_id uuid, reporter_name text, reported_user_id uuid, reported_name text, reported_account_status text, content text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null or not exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin' and p.account_status = 'active') then
    raise exception 'forbidden';
  end if;
  if p_status not in ('open', 'resolved', 'dismissed') then raise exception 'invalid_report'; end if;
  return query
    select c.id, c.target_type, c.target_id, c.reason, c.details, c.status, c.resolution_note, c.created_at,
           c.reporter_id, rp.full_name, c.reported_user_id, tp.full_name, tp.account_status,
           case c.target_type
             when 'message' then (select m.body from public.messages m where m.id = c.target_id)
             when 'review' then (select r.comment from public.reviews r where r.id = c.target_id)
             else null
           end
    from public.content_reports c
    left join public.profiles rp on rp.id = c.reporter_id
    left join public.profiles tp on tp.id = c.reported_user_id
    where c.status = p_status
    order by c.created_at desc
    limit 100;
end;
$$;

revoke all on function public.admin_list_reports(text) from public, anon;
grant execute on function public.admin_list_reports(text) to authenticated;

create or replace function public.admin_resolve_report(p_id uuid, p_status text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null or not exists (select 1 from public.profiles p where p.id = v_uid and p.role = 'admin' and p.account_status = 'active') then
    raise exception 'forbidden';
  end if;
  if p_status not in ('resolved', 'dismissed') then raise exception 'invalid_report'; end if;
  update public.content_reports
     set status = p_status, resolution_note = nullif(btrim(coalesce(p_note, '')), ''), resolved_by = v_uid, resolved_at = now()
   where id = p_id and status = 'open';
  if not found then raise exception 'not_found'; end if;
  insert into public.admin_audit_log(admin_id, action, target_type, target_id, metadata)
  values (v_uid, 'report_' || p_status, 'report', p_id, jsonb_build_object('note', p_note));
end;
$$;

revoke all on function public.admin_resolve_report(uuid, text, text) from public, anon;
grant execute on function public.admin_resolve_report(uuid, text, text) to authenticated;
