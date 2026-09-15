-- CI-only grants for the isolated E2E Supabase runner.
-- Never apply this file to a production project.
-- Service-role access is used only by isolated fixture seeding. The authenticated
-- grants below give the browser role the minimum table privileges required for
-- real RLS-backed application flows; RLS remains the authorization boundary.

grant usage on schema public to service_role;

grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;

grant select on public.profiles to authenticated;
grant select, update on public.provider_profiles to authenticated;

do $$
declare
  r record;
begin
  for r in
    select n.nspname as schema_name, p.oid::regclass::text as table_name
    from pg_class p
    join pg_namespace n on n.oid = p.relnamespace
    where n.nspname = 'public'
      and p.relkind in ('r', 'p')
  loop
    execute format('grant all privileges on table %s to service_role', r.table_name);
  end loop;
end $$;
