-- maak providers table. Run once in the Supabase dashboard SQL editor.
create table if not exists providers (
  id integer primary key,
  name text not null,
  job text not null,
  city text not null,
  distance text not null,
  price text not null,
  rating text not null,
  reviews integer not null,
  image text not null,
  available boolean not null,
  services jsonb not null,
  experience text not null,
  intro text not null
);

-- The Worker uses the service_role key, which bypasses RLS by default, so no
-- policy is required to read/write this table. If you later switch to the anon
-- key, add RLS policies here.
