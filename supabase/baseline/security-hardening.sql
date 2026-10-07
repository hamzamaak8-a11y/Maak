-- =============================================================================
-- MAAK — Security hardening for the booking state machine (idempotent)
-- =============================================================================
-- Apply in the Supabase SQL editor AFTER bookings.sql / admin-verification.sql /
-- phase-a-listing-foundation.sql. Safe to re-run.
--
-- What this fixes (found during the production audit of worker/db/bookings.sql):
--
--   1. cancel/accept/reject/start/complete_booking compared the row owner with
--      auth.uid() using `<>`. For an unauthenticated caller auth.uid() is NULL
--      and `uuid <> NULL` evaluates to NULL (not TRUE), so the `forbidden`
--      branch was skipped. The status guard still blocked most abuse, but the
--      functions must fail closed: every transition now starts with an explicit
--      `auth.uid() is null -> not_authenticated` check and uses `is distinct
--      from` for the ownership comparison.
--
--   2. All six booking RPCs were granted to `anon`. Only signed-in users may
--      create or move bookings, so EXECUTE is revoked from anon (and public) and
--      kept for `authenticated` only. Unauthenticated calls now fail at the
--      permission layer before the function body runs.
--
--   3. Provider ownership is verified against the provider_profiles row AND the
--      provider must still be `approved` to act on a booking (a suspended /
--      rejected provider cannot accept new work).
--
-- The state machine itself is unchanged:
--   pending -> accepted (provider) | rejected (provider, reason required) | cancelled (customer)
--   accepted -> in_progress (provider)
--   in_progress -> completed (provider)
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Helper: current caller must be authenticated
-- ---------------------------------------------------------------------------
create or replace function public.require_auth_uid()
returns uuid
language plpgsql stable security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  return v_uid;
end $$;

revoke all on function public.require_auth_uid() from public;
grant execute on function public.require_auth_uid() to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Helper: caller must own an APPROVED provider profile matching p_provider
-- ---------------------------------------------------------------------------
create or replace function public.assert_provider_owner(p_provider_id uuid)
returns void
language plpgsql stable security definer set search_path = public as $$
declare
  v_uid uuid := public.require_auth_uid();
  v_status text;
begin
  if p_provider_id is distinct from v_uid then
    raise exception 'forbidden';
  end if;
  select verification_status into v_status
    from public.provider_profiles where id = v_uid;
  if not found then
    raise exception 'forbidden';
  end if;
  if v_status is distinct from 'approved' then
    raise exception 'forbidden';
  end if;
end $$;

revoke all on function public.assert_provider_owner(uuid) from public;
grant execute on function public.assert_provider_owner(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Customer transition: cancel (pending only, owner only)
-- ---------------------------------------------------------------------------
create or replace function public.cancel_booking(p_booking_id uuid)
returns public.bookings
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := public.require_auth_uid();
  v_row public.bookings;
begin
  select * into v_row from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'not_found'; end if;
  if v_row.customer_id is distinct from v_uid then raise exception 'forbidden'; end if;
  if v_row.status <> 'pending' then raise exception 'invalid_transition'; end if;
  update public.bookings set status = 'cancelled', cancelled_at = now()
    where id = p_booking_id returning * into v_row;
  return v_row;
end $$;

-- ---------------------------------------------------------------------------
-- 4. Provider transitions (owner + approved provider only)
-- ---------------------------------------------------------------------------
create or replace function public.accept_booking(p_booking_id uuid)
returns public.bookings
language plpgsql security definer set search_path = public as $$
declare v_row public.bookings;
begin
  perform public.require_auth_uid();
  select * into v_row from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'not_found'; end if;
  perform public.assert_provider_owner(v_row.provider_id);
  if v_row.status <> 'pending' then raise exception 'invalid_transition'; end if;
  update public.bookings set status = 'accepted', accepted_at = now()
    where id = p_booking_id returning * into v_row;
  return v_row;
end $$;

create or replace function public.reject_booking(p_booking_id uuid, p_reason text)
returns public.bookings
language plpgsql security definer set search_path = public as $$
declare v_row public.bookings;
begin
  perform public.require_auth_uid();
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'reason_required';
  end if;
  select * into v_row from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'not_found'; end if;
  perform public.assert_provider_owner(v_row.provider_id);
  if v_row.status <> 'pending' then raise exception 'invalid_transition'; end if;
  update public.bookings set status = 'rejected', rejection_reason = btrim(p_reason)
    where id = p_booking_id returning * into v_row;
  return v_row;
end $$;

create or replace function public.start_booking(p_booking_id uuid)
returns public.bookings
language plpgsql security definer set search_path = public as $$
declare v_row public.bookings;
begin
  perform public.require_auth_uid();
  select * into v_row from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'not_found'; end if;
  perform public.assert_provider_owner(v_row.provider_id);
  if v_row.status <> 'accepted' then raise exception 'invalid_transition'; end if;
  update public.bookings set status = 'in_progress', started_at = now()
    where id = p_booking_id returning * into v_row;
  return v_row;
end $$;

create or replace function public.complete_booking(p_booking_id uuid)
returns public.bookings
language plpgsql security definer set search_path = public as $$
declare v_row public.bookings;
begin
  perform public.require_auth_uid();
  select * into v_row from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'not_found'; end if;
  perform public.assert_provider_owner(v_row.provider_id);
  if v_row.status <> 'in_progress' then raise exception 'invalid_transition'; end if;
  update public.bookings set status = 'completed', completed_at = now()
    where id = p_booking_id returning * into v_row;
  return v_row;
end $$;

-- ---------------------------------------------------------------------------
-- 5. Grants: booking RPCs are for authenticated users only (never anon)
-- ---------------------------------------------------------------------------
revoke all on function public.create_booking(integer,text,text,timestamptz,text,text) from public, anon;
revoke all on function public.cancel_booking(uuid)        from public, anon;
revoke all on function public.accept_booking(uuid)        from public, anon;
revoke all on function public.reject_booking(uuid,text)   from public, anon;
revoke all on function public.start_booking(uuid)         from public, anon;
revoke all on function public.complete_booking(uuid)      from public, anon;

grant execute on function public.create_booking(integer,text,text,timestamptz,text,text) to authenticated;
grant execute on function public.cancel_booking(uuid)        to authenticated;
grant execute on function public.accept_booking(uuid)        to authenticated;
grant execute on function public.reject_booking(uuid,text)   to authenticated;
grant execute on function public.start_booking(uuid)         to authenticated;
grant execute on function public.complete_booking(uuid)      to authenticated;

-- Provider marketplace profile edit and admin RPCs must never be callable by anon
-- either (they already check auth.uid()/is_admin, this is defence in depth).
revoke all on function public.update_provider_marketplace_profile(text[], numeric, integer, boolean) from public, anon;
grant execute on function public.update_provider_marketplace_profile(text[], numeric, integer, boolean) to authenticated;
revoke all on function public.admin_approve_provider(uuid)       from public, anon;
revoke all on function public.admin_reject_provider(uuid, text)  from public, anon;
grant execute on function public.admin_approve_provider(uuid)      to authenticated;
grant execute on function public.admin_reject_provider(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Direct table writes stay closed: all state changes go through the RPCs.
--    (Re-asserted here so a partial earlier migration cannot leave a gap.)
-- ---------------------------------------------------------------------------
alter table public.bookings enable row level security;
revoke insert, update, delete on public.bookings from anon, authenticated;
grant select on public.bookings to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Verification queries (run manually; expected results in comments)
-- ---------------------------------------------------------------------------
-- select routine_name, grantee, privilege_type
--   from information_schema.routine_privileges
--  where routine_schema = 'public'
--    and routine_name in ('create_booking','cancel_booking','accept_booking',
--                         'reject_booking','start_booking','complete_booking')
--  order by routine_name, grantee;
--   -> only grantee = 'authenticated' (plus the owner/postgres) — no 'anon', no 'PUBLIC'.
--
-- As anon (REST): POST /rest/v1/rpc/cancel_booking {"p_booking_id":"00000000-0000-0000-0000-000000000000"}
--   -> 401/403 "permission denied for function cancel_booking"
--      (before this migration it returned a raised 'not_found' from inside the function).
