-- A listing is bookable when it is published (approved + active provider), the provider did not pause it (providers.available is not false)
-- and at least one working-hours window exists. Before, the app required providers.available = true, a flag that refresh_provider_listing()
-- resets to NULL and that nothing else sets, so no real provider could ever be booked. create_booking already checks the working hours
-- of the chosen slot; this only aligns the customer-side availability read with it. No data is changed.

CREATE OR REPLACE FUNCTION public.get_provider_availability(p_provider_id integer)
RETURNS TABLE(
  id uuid,
  provider_id integer,
  day_of_week integer,
  start_time time,
  end_time time,
  is_available boolean,
  created_at timestamptz,
  updated_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_is_owner boolean;
BEGIN
  PERFORM public.require_auth_uid();
  IF p_provider_id IS NULL THEN
    RAISE EXCEPTION 'invalid_provider';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.providers p
    WHERE p.id = p_provider_id AND p.provider_profile_id = auth.uid()
  ) INTO v_is_owner;

  IF NOT v_is_owner THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.providers p
      WHERE p.id = p_provider_id
        AND p.published_at IS NOT NULL
        AND p.available IS DISTINCT FROM false
        AND EXISTS (SELECT 1 FROM public.provider_availability w WHERE w.provider_id = p.id AND w.is_available)
    ) THEN
      RAISE EXCEPTION 'provider_not_bookable';
    END IF;
  END IF;

  RETURN QUERY
  SELECT pa.id, pa.provider_id, pa.day_of_week, pa.start_time, pa.end_time,
         pa.is_available, pa.created_at, pa.updated_at
  FROM public.provider_availability pa
  WHERE pa.provider_id = p_provider_id
  ORDER BY pa.day_of_week, pa.start_time;
END;
$$;
