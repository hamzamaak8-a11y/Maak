CREATE OR REPLACE FUNCTION public.get_provider_dashboard_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  v_completed integer := 0;
  v_reviews integer := 0;
  v_average numeric := 0;
  v_upcoming jsonb := '[]'::jsonb;
  v_activity jsonb := '[]'::jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.provider_profiles pp ON pp.id = p.id
    WHERE p.id = v_uid
      AND p.role = 'provider'
      AND p.account_status = 'active'
      AND pp.verification_status = 'approved'
  ) THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  SELECT count(*)::integer
    INTO v_completed
  FROM public.bookings b
  WHERE b.provider_id = v_uid
    AND b.status = 'completed';

  SELECT count(*)::integer,
         coalesce(round(avg(r.rating)::numeric, 2), 0)
    INTO v_reviews, v_average
  FROM public.reviews r
  WHERE r.provider_id = v_uid
    AND r.is_hidden = false;

  SELECT coalesce(jsonb_agg(x.item ORDER BY x.service_date ASC), '[]'::jsonb)
    INTO v_upcoming
  FROM (
    SELECT jsonb_build_object(
      'id', b.id,
      'customer_name', coalesce(nullif(trim(b.customer_name), ''), p.full_name, 'Customer'),
      'service_category', b.service_category,
      'service_description', b.service_description,
      'service_date', b.service_date,
      'location_text', b.location_text,
      'status', b.status,
      'created_at', b.created_at
    ) AS item,
    b.service_date
    FROM public.bookings b
    LEFT JOIN public.profiles p ON p.id = b.customer_id
    WHERE b.provider_id = v_uid
      AND b.status IN ('pending', 'accepted')
      AND b.service_date IS NOT NULL
      AND b.service_date > now()
    ORDER BY b.service_date ASC
    LIMIT 5
  ) x;

  SELECT coalesce(jsonb_agg(x.item ORDER BY x.created_at DESC), '[]'::jsonb)
    INTO v_activity
  FROM (
    SELECT jsonb_build_object(
      'id', n.id,
      'type', n.type,
      'title', n.title,
      'body', n.body,
      'is_read', n.is_read,
      'created_at', n.created_at,
      'metadata', n.metadata
    ) AS item,
    n.created_at
    FROM public.notifications n
    WHERE n.user_id = v_uid
    ORDER BY n.created_at DESC
    LIMIT 5
  ) x;

  RETURN jsonb_build_object(
    'total_completed_bookings', v_completed,
    'total_earnings', NULL,
    'average_rating', v_average,
    'total_reviews', v_reviews,
    'upcoming_bookings', v_upcoming,
    'recent_activity', v_activity
  );
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.get_provider_dashboard_stats() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_provider_dashboard_stats() TO authenticated;
