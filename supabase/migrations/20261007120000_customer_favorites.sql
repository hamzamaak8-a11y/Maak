-- Customer favourites: a customer can save marketplace listings and see them later.
-- Owner-only access through RLS; no other role can read or modify another user's favourites.
create table if not exists public.customer_favorites (
  customer_id uuid not null references auth.users(id) on delete cascade,
  provider_listing_id integer not null references public.providers(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (customer_id, provider_listing_id)
);

create index if not exists customer_favorites_listing_idx on public.customer_favorites(provider_listing_id);

alter table public.customer_favorites enable row level security;

drop policy if exists "customer favorites select own" on public.customer_favorites;
create policy "customer favorites select own" on public.customer_favorites
  for select to authenticated using (customer_id = (select auth.uid()));

drop policy if exists "customer favorites insert own" on public.customer_favorites;
create policy "customer favorites insert own" on public.customer_favorites
  for insert to authenticated with check (customer_id = (select auth.uid()));

drop policy if exists "customer favorites delete own" on public.customer_favorites;
create policy "customer favorites delete own" on public.customer_favorites
  for delete to authenticated using (customer_id = (select auth.uid()));

revoke all on public.customer_favorites from anon, public;
grant select, insert, delete on public.customer_favorites to authenticated;
