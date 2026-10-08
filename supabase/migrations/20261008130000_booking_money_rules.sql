-- Booking money rules, enforced in the database (the UI only mirrors them).
--
-- PRICE (set_booking_price, provider only)
--   * pending / accepted     : the provider may set or change the price while nothing was paid.
--   * in_progress / completed: the provider may only SET a price that is still empty (a quote given late);
--                              an existing price can no longer be changed, so the customer's agreed price is protected.
--   * rejected / cancelled   : never.  paid / refunded bookings: never ("price_locked").
--   The customer is notified whenever the price is set or changed.
--
-- PAYMENT (mark_booking_paid, admin only - or service_role for a future payment provider)
--   * only a COMPLETED booking with a price, still unpaid / pending, can be marked paid.
--   * paid again -> "already_paid", refunded -> "payment_locked", anything else -> "booking_not_payable".
-- REFUND (admin_refund_booking, admin only): only paid -> refunded, with a written reason. Every change is audited.
--
-- ADMIN CANCEL (admin_cancel_booking): now also releases the provider's time slot (it stayed 'confirmed' and blocked the
-- hour for good) and notifies both people.

create or replace function public.set_booking_price(p_booking_id uuid, p_price numeric, p_currency text default 'USD')
returns public.bookings
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_row public.bookings;
  v_currency text := upper(trim(coalesce(p_currency, 'USD')));
  v_old_price numeric;
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if p_price is null or p_price < 0 or p_price <> p_price then raise exception 'invalid_price'; end if;
  if v_currency !~ '^[A-Z]{3}$' then raise exception 'invalid_currency'; end if;

  select * into v_row from public.bookings b where b.id = p_booking_id for update;
  if not found then raise exception 'booking_not_found'; end if;
  if v_row.provider_id is distinct from auth.uid() then raise exception 'forbidden_or_invalid_booking'; end if;
  if v_row.status not in ('pending', 'accepted', 'in_progress', 'completed') then raise exception 'forbidden_or_invalid_booking'; end if;
  if v_row.payment_status in ('paid', 'refunded') then raise exception 'price_locked'; end if;
  if v_row.price is not null and v_row.status not in ('pending', 'accepted') then raise exception 'price_locked'; end if;

  v_old_price := v_row.price;
  update public.bookings b
  set price = round(p_price, 2), currency = v_currency, payment_status = 'pending', updated_at = now()
  where b.id = p_booking_id
  returning b.* into v_row;

  if v_old_price is distinct from v_row.price or v_row.currency is distinct from v_currency then
    perform public.notify_user(v_row.customer_id, 'booking_price', 'notifications.bookingPriceTitle', 'notifications.bookingPriceBody',
                               jsonb_build_object('booking_id', v_row.id, 'price', v_row.price, 'currency', v_row.currency));
  end if;
  return v_row;
end;
$$;

revoke all on function public.set_booking_price(uuid, numeric, text) from public, anon, authenticated;
grant execute on function public.set_booking_price(uuid, numeric, text) to authenticated;

create or replace function public.mark_booking_paid(p_booking_id uuid, p_payment_method text)
returns public.bookings
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_row public.bookings;
  v_role text := coalesce(auth.jwt() ->> 'role', '');
  v_admin uuid := auth.uid();
begin
  if v_admin is null and v_role <> 'service_role' then raise exception 'not_authenticated'; end if;
  if v_role <> 'service_role' and not exists (select 1 from public.profiles p where p.id = v_admin and p.role = 'admin' and p.account_status = 'active') then
    raise exception 'forbidden';
  end if;

  select * into v_row from public.bookings b where b.id = p_booking_id for update;
  if not found then raise exception 'booking_not_found'; end if;
  if v_row.payment_status = 'paid' then raise exception 'already_paid'; end if;
  if v_row.payment_status = 'refunded' then raise exception 'payment_locked'; end if;
  if v_row.status is distinct from 'completed' or v_row.price is null then raise exception 'booking_not_payable'; end if;

  update public.bookings b
  set payment_status = 'paid', payment_method = nullif(trim(coalesce(p_payment_method, '')), ''), paid_at = now(), updated_at = now()
  where b.id = p_booking_id
  returning b.* into v_row;

  if v_admin is not null then
    insert into public.admin_audit_log(admin_id, action, target_type, target_id, metadata)
    values (v_admin, 'booking_marked_paid', 'booking', p_booking_id, jsonb_build_object('price', v_row.price, 'currency', v_row.currency, 'method', v_row.payment_method));
  end if;
  return v_row;
end;
$$;

revoke all on function public.mark_booking_paid(uuid, text) from public, anon, authenticated, service_role;
grant execute on function public.mark_booking_paid(uuid, text) to authenticated, service_role;

create or replace function public.admin_refund_booking(p_booking_id uuid, p_reason text)
returns public.bookings
language plpgsql
security definer
set search_path to ''
as $$
declare
  v_admin uuid := auth.uid();
  v_row public.bookings;
begin
  if v_admin is null or not exists (select 1 from public.profiles p where p.id = v_admin and p.role = 'admin' and p.account_status = 'active') then
    raise exception 'forbidden';
  end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then raise exception 'reason_required'; end if;

  select * into v_row from public.bookings b where b.id = p_booking_id for update;
  if not found then raise exception 'booking_not_found'; end if;
  if v_row.payment_status is distinct from 'paid' then raise exception 'booking_not_refundable'; end if;

  update public.bookings b set payment_status = 'refunded', updated_at = now() where b.id = p_booking_id returning b.* into v_row;
  insert into public.admin_audit_log(admin_id, action, target_type, target_id, metadata)
  values (v_admin, 'booking_refunded', 'booking', p_booking_id, jsonb_build_object('reason', btrim(p_reason), 'price', v_row.price, 'currency', v_row.currency));
  return v_row;
end;
$$;

revoke all on function public.admin_refund_booking(uuid, text) from public, anon, authenticated;
grant execute on function public.admin_refund_booking(uuid, text) to authenticated;

create or replace function public.admin_cancel_booking(target uuid, reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  actor uuid := auth.uid();
  r public.bookings%rowtype;
begin
  if actor is null or not public.is_admin() then raise exception 'forbidden'; end if;
  select * into r from public.bookings where id = target for update;
  if not found then raise exception 'booking not found'; end if;
  if r.status in ('completed', 'cancelled', 'rejected') then raise exception 'booking cannot be cancelled'; end if;
  update public.bookings
    set status = 'cancelled', cancelled_at = coalesce(cancelled_at, now()),
        rejection_reason = coalesce(nullif(trim(reason), ''), rejection_reason), updated_at = now()
    where id = target;
  update public.booking_slots set status = 'cancelled', updated_at = now() where booking_id = target and status in ('pending', 'confirmed');
  perform public.notify_user(r.customer_id, 'booking_cancelled', 'notifications.bookingCancelledSupportTitle', 'notifications.bookingCancelledSupportBody', jsonb_build_object('booking_id', r.id));
  perform public.notify_user(r.provider_id, 'booking_cancelled', 'notifications.bookingCancelledSupportTitle', 'notifications.bookingCancelledSupportBody', jsonb_build_object('booking_id', r.id));
  insert into public.admin_audit_log(admin_id, action, target_type, target_id, metadata)
  values (actor, 'booking_cancelled', 'booking', target, jsonb_build_object('reason', nullif(trim(reason), ''), 'previous_status', r.status));
end;
$$;

revoke all on function public.admin_cancel_booking(uuid, text) from public, anon;
grant execute on function public.admin_cancel_booking(uuid, text) to authenticated;
