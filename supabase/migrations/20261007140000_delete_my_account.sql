-- In-app account deletion (required by Apple App Store and Google Play).
--
-- public.delete_my_account() permanently deletes the CALLING user's account:
--   * the Auth user (auth.users) — every table that references it cascades: profile, provider profile,
--     provider documents rows, bookings, reviews, messages, notifications, favourites, conversation membership;
--   * the provider's public marketplace listing (public.providers), which would otherwise keep their name/city/intro.
-- Uploaded files in Storage are removed by the app through the Storage API before this call.
--
-- Guard rails: authenticated callers only, only for their own account, never for administrators
-- (admin_audit_log keeps a RESTRICT foreign key on purpose), and never while a booking is still open
-- (pending / accepted / in progress) so the other party is not left hanging.
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_role text;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;

  select role into v_role from public.profiles where id = v_uid;
  if v_role = 'admin' then raise exception 'admin_cannot_delete'; end if;

  if exists (
    select 1 from public.bookings b
    where (b.customer_id = v_uid or b.provider_id = v_uid)
      and b.status in ('pending', 'accepted', 'in_progress')
  ) then
    raise exception 'active_bookings';
  end if;

  delete from public.providers where provider_profile_id = v_uid and listing_kind = 'real';
  delete from auth.users where id = v_uid;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;
