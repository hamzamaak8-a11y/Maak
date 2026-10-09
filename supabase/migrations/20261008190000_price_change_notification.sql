-- set_booking_price notified the customer only when the NUMBER changed. The currency was compared after the UPDATE (new value against
-- the same new value), so 120 MAD -> 120 USD stayed silent. The old currency is now read before the update.
-- Everything else is unchanged: who may set a price, when it is locked, and one notification per real change (price, currency or both).

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
  v_old_currency text;
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
  v_old_currency := v_row.currency;
  update public.bookings b
  set price = round(p_price, 2), currency = v_currency, payment_status = 'pending', updated_at = now()
  where b.id = p_booking_id
  returning b.* into v_row;

  if v_old_price is distinct from v_row.price or v_old_currency is distinct from v_row.currency then
    perform public.notify_user(v_row.customer_id, 'booking_price', 'notifications.bookingPriceTitle', 'notifications.bookingPriceBody',
                               jsonb_build_object('booking_id', v_row.id, 'price', v_row.price, 'currency', v_row.currency));
  end if;
  return v_row;
end;
$$;

revoke all on function public.set_booking_price(uuid, numeric, text) from public, anon, authenticated;
grant execute on function public.set_booking_price(uuid, numeric, text) to authenticated;
