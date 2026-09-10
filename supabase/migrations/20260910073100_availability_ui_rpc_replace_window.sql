CREATE OR REPLACE FUNCTION public.set_provider_availability(
  p_provider_id integer,
  p_day_of_week integer,
  p_start_time time,
  p_end_time time,
  p_is_available boolean
)
RETURNS public.provider_availability
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_row public.provider_availability;
BEGIN
  PERFORM public.require_auth_uid();
  IF p_provider_id IS NULL OR p_day_of_week IS NULL OR p_day_of_week < 0 OR p_day_of_week > 6 THEN
    RAISE EXCEPTION 'invalid_availability';
  END IF;
  IF p_is_available AND (p_start_time IS NULL OR p_end_time IS NULL OR p_end_time <= p_start_time) THEN
    RAISE EXCEPTION 'invalid_availability';
  END IF;
  IF NOT EXISTS (
    SELECT 1
    FROM public.providers p
    JOIN public.provider_profiles pp ON pp.id = p.provider_profile_id
    WHERE p.id = p_provider_id
      AND p.provider_profile_id = auth.uid()
      AND pp.verification_status = 'approved'
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE public.provider_availability
  SET is_available = false, updated_at = now()
  WHERE provider_id = p_provider_id AND day_of_week = p_day_of_week;

  IF NOT p_is_available THEN
    SELECT * INTO v_row
    FROM public.provider_availability
    WHERE provider_id = p_provider_id AND day_of_week = p_day_of_week
    ORDER BY updated_at DESC, created_at DESC
    LIMIT 1;
    IF v_row.id IS NULL THEN
      INSERT INTO public.provider_availability(provider_id, day_of_week, start_time, end_time, is_available)
      VALUES (p_provider_id, p_day_of_week, '00:00'::time, '00:00'::time, false)
      RETURNING * INTO v_row;
    END IF;
    RETURN v_row;
  END IF;

  INSERT INTO public.provider_availability(provider_id, day_of_week, start_time, end_time, is_available)
  VALUES (p_provider_id, p_day_of_week, p_start_time, p_end_time, true)
  ON CONFLICT (provider_id, day_of_week, start_time, end_time)
  DO UPDATE SET is_available = true, updated_at = now()
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;
