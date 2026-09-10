create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  customer_id uuid not null references auth.users(id) on delete cascade,
  provider_id uuid not null references public.provider_profiles(id) on delete cascade,
  rating integer not null check (rating between 1 and 5),
  comment text null,
  is_hidden boolean not null default false,
  created_at timestamptz not null default now(),
  constraint reviews_booking_unique unique (booking_id),
  constraint reviews_comment_length check (comment is null or char_length(comment) <= 1000)
);

create index if not exists reviews_provider_created_idx on public.reviews(provider_id, created_at desc);

alter table public.reviews enable row level security;
revoke all on public.reviews from anon, authenticated;

drop policy if exists reviews_public_select on public.reviews;
drop policy if exists reviews_admin_select on public.reviews;

create policy reviews_public_select
  on public.reviews for select to anon, authenticated
  using (is_hidden = false);

create policy reviews_admin_select
  on public.reviews for select to authenticated
  using (exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and p.account_status = 'active'
  ));

grant select on public.reviews to anon, authenticated;
