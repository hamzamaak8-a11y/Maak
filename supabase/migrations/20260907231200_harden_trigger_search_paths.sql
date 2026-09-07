-- Harden trigger functions against search_path manipulation.
-- These functions are invoked by triggers and do not need a caller-controlled search_path.

create or replace function public.chat_touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at=now();
  return new;
end;
$$;

create or replace function public.guard_document_status_change()
returns trigger
language plpgsql
set search_path = public
as $$
declare actor text;
begin
  actor := current_setting('request.jwt.claim.role', true);
  if actor is null or actor = 'service_role' then return new; end if;
  if old.status in ('approved','rejected') then raise exception 'cannot modify a reviewed document'; end if;
  if new.status is distinct from old.status and new.status <> 'pending' then raise exception 'not allowed to set document status'; end if;
  return new;
end;
$$;

create or replace function public.guard_verification_status_change()
returns trigger
language plpgsql
set search_path = public
as $$
declare actor text;
begin
  actor := current_setting('request.jwt.claim.role', true);
  if actor is null or actor = 'service_role' then return new; end if;
  if old.verification_status in ('approved','suspended') then raise exception 'cannot modify an approved or suspended provider profile'; end if;
  if new.verification_status not in ('draft','pending') then raise exception 'not allowed to set this verification_status'; end if;
  return new;
end;
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at=now();
  return new;
end;
$$;
