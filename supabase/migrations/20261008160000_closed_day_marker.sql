-- Closing a working-hours day that has no row yet failed.
--
-- set_provider_availability() records a closed day as a row with is_available = false and the placeholder times 00:00-00:00, but the table
-- demanded end_time > start_time for EVERY row, so the placeholder violated provider_availability_time_order and the provider saw an error
-- instead of "saved". The time order only matters for rows that offer hours; a closed-day marker may have equal times.
--
-- Nothing else changes: the function, the booking checks (they only read rows with is_available = true) and the exclusion constraint
-- on booking_slots that forbids overlapping bookings are untouched, and every existing row still satisfies the relaxed rule.

alter table public.provider_availability drop constraint if exists provider_availability_time_order;
alter table public.provider_availability
  add constraint provider_availability_time_order check (not is_available or end_time > start_time);
