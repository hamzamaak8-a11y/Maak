CREATE OR REPLACE FUNCTION public.get_my_provider_listing_id()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_provider_id integer;
BEGIN
  PERFORM public.require_auth_uid();
  SELECT p.id INTO v_provider_id
  FROM public.providers p
  JOIN public.provider_profiles pp ON pp.id = p.provider_profile_id
  WHERE p.provider_profile_id = auth.uid()
    AND pp.verification_status = 'approved'
  ORDER BY p.id
  LIMIT 1;
  RETURN v_provider_id;
END;
$$;

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
        AND p.available = true
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

REVOKE ALL ON FUNCTION public.get_my_provider_listing_id() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_provider_availability(integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_provider_availability(integer, integer, time, time, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_provider_listing_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_provider_availability(integer) TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_provider_availability(integer, integer, time, time, boolean) TO authenticated;
