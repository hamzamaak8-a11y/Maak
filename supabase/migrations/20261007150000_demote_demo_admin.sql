-- One-time, audited demotion of the demo administrator.
--
-- Rule: the only administrator of MAAK is the official account hamzamaak8@gmail.com.
-- This demotes maak.admin.demo@gmail.com from `admin` to `customer`. The account is NOT deleted or suspended
-- and no guard is changed; it uses the same transaction-local internal service-role mechanism as
-- 20261007130000_bootstrap_official_admin.sql (see that file) for one UPDATE, then restores the previous claim.
--
-- Fail-closed preconditions (any failure raises and changes nothing):
--   * the official admin exists, is confirmed, active and has role `admin` (so MAAK is never left without an admin);
--   * the demo account is a different account;
--   * the demo account currently has role `admin` (already `customer` -> no-op; any other role -> error);
--   * the demo account has no provider application (it would need role `provider`, not `customer`).
-- It is idempotent, and a no-op on databases where the demo account does not exist (CI / fresh environments).
do $$
declare
  c_official constant text := 'hamzamaak8@gmail.com';
  c_demo constant text := 'maak.admin.demo@gmail.com';
  v_official uuid;
  v_official_confirmed timestamptz;
  v_official_role text;
  v_official_status text;
  v_demo uuid;
  v_demo_role text;
  v_prev_claim text;
begin
  select u.id into v_demo from auth.users u where lower(u.email) = c_demo;
  if v_demo is null then
    raise notice 'demote_demo_admin: % does not exist - nothing to do', c_demo;
    return;
  end if;

  select u.id, u.email_confirmed_at into v_official, v_official_confirmed from auth.users u where lower(u.email) = c_official;
  if v_official is null then
    raise exception 'demote_demo_admin: official admin % does not exist; refusing to demote', c_official;
  end if;
  if v_official = v_demo then
    raise exception 'demote_demo_admin: demo and official accounts are the same account';
  end if;
  if v_official_confirmed is null then
    raise exception 'demote_demo_admin: official admin % is not confirmed; refusing to demote', c_official;
  end if;

  select p.role, p.account_status into v_official_role, v_official_status from public.profiles p where p.id = v_official;
  if v_official_role is distinct from 'admin' or v_official_status is distinct from 'active' then
    raise exception 'demote_demo_admin: official admin % is not an active admin; refusing to demote', c_official;
  end if;

  select p.role into v_demo_role from public.profiles p where p.id = v_demo;
  if not found then
    raise exception 'demote_demo_admin: profile row missing for %', c_demo;
  end if;
  if v_demo_role = 'customer' then
    raise notice 'demote_demo_admin: % is already a customer - nothing to do', c_demo;
    return;
  end if;
  if v_demo_role is distinct from 'admin' then
    raise exception 'demote_demo_admin: % has unexpected role %; refusing to change it', c_demo, v_demo_role;
  end if;
  if exists (select 1 from public.provider_profiles pp where pp.id = v_demo) then
    raise exception 'demote_demo_admin: % has a provider application; demote it manually', c_demo;
  end if;

  -- Transaction-local internal service-role context (same mechanism as admin_approve_provider).
  v_prev_claim := current_setting('request.jwt.claim.role', true);
  perform set_config('request.jwt.claim.role', 'service_role', true);

  update public.profiles
     set role = 'customer', updated_at = now()
   where id = v_demo and role = 'admin';

  perform set_config('request.jwt.claim.role', coalesce(v_prev_claim, ''), true);

  select p.role into v_demo_role from public.profiles p where p.id = v_demo;
  if v_demo_role is distinct from 'customer' then
    raise exception 'demote_demo_admin: the role guard still blocks this change; nothing was modified';
  end if;

  -- Never leave MAAK without an active admin.
  if not exists (select 1 from public.profiles p where p.id = v_official and p.role = 'admin' and p.account_status = 'active') then
    raise exception 'demote_demo_admin: the official admin is no longer an active admin; rolling back';
  end if;

  insert into public.admin_audit_log(admin_id, action, target_type, target_id, metadata)
  values (v_official, 'admin_demoted', 'profile', v_demo,
          jsonb_build_object('email', c_demo, 'previous_role', 'admin', 'new_role', 'customer', 'method', 'migration 20261007150000'));
end
$$;
