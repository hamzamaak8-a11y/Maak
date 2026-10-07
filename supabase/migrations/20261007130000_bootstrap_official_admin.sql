-- One-time, audited bootstrap of the official MAAK administrator.
--
-- Official account (the only one): hamzamaak8@gmail.com
--
-- Why a migration: `public.profiles.role` is protected by guard triggers (guard_role_change,
-- guard_profile_security_fields) so that no client, and no plain SQL-editor UPDATE, can change a role.
-- The project's own privileged paths (e.g. admin_approve_provider) pass the guard by running inside a
-- transaction whose `request.jwt.claim.role` is the internal `service_role`. This script uses exactly that
-- mechanism, for ONE statement, in ONE transaction, then restores the previous claim.
--
-- Safety properties
--   * the guards are NOT disabled, altered or bypassed permanently; no function or policy is added;
--   * it targets one e-mail only and refuses to run unless that account exists, is confirmed and is active;
--   * it verifies the result and RAISES (rolling everything back) if the guard still blocked the change;
--   * it is idempotent (already admin -> no-op) and a no-op on databases where the account does not exist;
--   * it writes an `admin_audit_log` entry.
do $$
declare
  c_email constant text := 'hamzamaak8@gmail.com';
  v_uid uuid;
  v_confirmed timestamptz;
  v_role text;
  v_status text;
  v_prev_claim text;
begin
  select u.id, u.email_confirmed_at into v_uid, v_confirmed
  from auth.users u
  where lower(u.email) = c_email;

  if v_uid is null then
    raise notice 'bootstrap_official_admin: % does not exist in auth.users - nothing to do', c_email;
    return;
  end if;
  if v_confirmed is null then
    raise exception 'bootstrap_official_admin: % has not confirmed its e-mail', c_email;
  end if;

  select p.role, p.account_status into v_role, v_status
  from public.profiles p
  where p.id = v_uid;

  if not found then
    raise exception 'bootstrap_official_admin: profile row missing for %', c_email;
  end if;
  if v_status is distinct from 'active' then
    raise exception 'bootstrap_official_admin: account % is not active', c_email;
  end if;
  if v_role = 'admin' then
    raise notice 'bootstrap_official_admin: % is already admin - nothing to do', c_email;
    return;
  end if;

  -- Transaction-local internal service-role context (same mechanism as admin_approve_provider).
  v_prev_claim := current_setting('request.jwt.claim.role', true);
  perform set_config('request.jwt.claim.role', 'service_role', true);

  update public.profiles
     set role = 'admin', updated_at = now()
   where id = v_uid;

  perform set_config('request.jwt.claim.role', coalesce(v_prev_claim, ''), true);

  select p.role into v_role from public.profiles p where p.id = v_uid;
  if v_role is distinct from 'admin' then
    raise exception 'bootstrap_official_admin: the role guard still blocks this change; nothing was modified';
  end if;

  insert into public.admin_audit_log(admin_id, action, target_type, target_id, metadata)
  values (v_uid, 'admin_bootstrapped', 'profile', v_uid,
          jsonb_build_object('email', c_email, 'previous_role', 'customer', 'method', 'migration 20261007130000'));
end
$$;
