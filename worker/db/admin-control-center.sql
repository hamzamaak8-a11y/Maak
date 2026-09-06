/* Maak — Admin control center backend
   Safe, non-destructive administration primitives. */

alter table public.profiles add column if not exists account_status text not null default 'active';
alter table public.profiles drop constraint if exists profiles_account_status_check;
alter table public.profiles add constraint profiles_account_status_check check (account_status in ('active','suspended'));

create table if not exists public.admin_audit_log (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references auth.users(id) on delete restrict,
  action text not null,
  target_type text not null,
  target_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

alter table public.admin_audit_log enable row level security;
drop policy if exists admin_audit_select on public.admin_audit_log;
create policy admin_audit_select on public.admin_audit_log for select to authenticated using (
  admin_id = auth.uid() or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin')
);

create or replace function public.admin_set_account_status(target uuid, new_status text)
returns void language plpgsql security definer set search_path = public
as $$
declare actor uuid := auth.uid();
begin
  if actor is null or not exists (select 1 from public.profiles where id = actor and role = 'admin') then raise exception 'forbidden'; end if;
  if new_status not in ('active','suspended') then raise exception 'invalid status'; end if;
  if target = actor then raise exception 'cannot change own status'; end if;
  if not exists (select 1 from public.profiles where id = target) then raise exception 'account not found'; end if;
  update public.profiles set account_status = new_status, updated_at = now() where id = target;
  insert into public.admin_audit_log(admin_id, action, target_type, target_id, metadata)
  values(actor, case when new_status='suspended' then 'account_suspended' else 'account_reactivated' end, 'profile', target, jsonb_build_object('status',new_status));
end;
$$;
grant execute on function public.admin_set_account_status(uuid,text) to authenticated;

create or replace function public.admin_cancel_booking(target uuid, reason text default null)
returns void language plpgsql security definer set search_path = public
as $$
declare actor uuid := auth.uid(); r public.bookings%rowtype;
begin
  if actor is null or not exists (select 1 from public.profiles where id = actor and role = 'admin') then raise exception 'forbidden'; end if;
  select * into r from public.bookings where id = target for update;
  if not found then raise exception 'booking not found'; end if;
  if r.status in ('completed','cancelled','rejected') then raise exception 'booking cannot be cancelled'; end if;
  update public.bookings set status='cancelled', cancelled_at=coalesce(cancelled_at,now()), rejection_reason=coalesce(nullif(trim(reason),''), rejection_reason), updated_at=now() where id=target;
  insert into public.admin_audit_log(admin_id, action, target_type, target_id, metadata)
  values(actor,'booking_cancelled','booking',target,jsonb_build_object('reason',nullif(trim(reason),''),'previous_status',r.status));
end;
$$;
grant execute on function public.admin_cancel_booking(uuid,text) to authenticated;
create index if not exists admin_audit_log_created_at_idx on public.admin_audit_log(created_at desc);