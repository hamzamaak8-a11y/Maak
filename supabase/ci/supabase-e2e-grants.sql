-- CI-only grants for the isolated E2E Supabase runner.
-- Never apply this file to a production project.
-- The E2E seed uses the local Supabase service_role API key and needs explicit
-- table/sequence privileges even though service_role bypasses RLS.

grant usage on schema public to service_role;

grant all privileges on all tables in schema public to service_role;
grant all privileges on all sequences in schema public to service_role;

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
