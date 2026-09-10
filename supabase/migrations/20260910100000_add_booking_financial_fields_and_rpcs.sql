ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS price numeric,
  ADD COLUMN IF NOT EXISTS currency text NOT NULL DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS payment_status text NOT NULL DEFAULT 'unpaid',
  ADD COLUMN IF NOT EXISTS payment_method text,
  ADD COLUMN IF NOT EXISTS paid_at timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'bookings_price_nonnegative'
      AND conrelid = 'public.bookings'::regclass
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_price_nonnegative CHECK (price IS NULL OR price >= 0);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'bookings_payment_status_check'
      AND conrelid = 'public.bookings'::regclass
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_payment_status_check CHECK (payment_status IN ('unpaid','pending','paid','refunded'));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.set_booking_price(p_booking_id uuid, p_price numeric, p_currency text DEFAULT 'USD')
RETURNS public.bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_row public.bookings;
  v_currency text := upper(trim(coalesce(p_currency, 'USD')));
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_price IS NULL OR p_price < 0 OR p_price <> p_price THEN RAISE EXCEPTION 'invalid_price'; END IF;
  IF v_currency !~ '^[A-Z]{3}$' THEN RAISE EXCEPTION 'invalid_currency'; END IF;

  UPDATE public.bookings b
  SET price = round(p_price, 2),
      currency = v_currency,
      payment_status = CASE WHEN payment_status = 'paid' OR payment_status = 'refunded' THEN payment_status ELSE 'pending' END,
      updated_at = now()
  WHERE b.id = p_booking_id
    AND b.provider_id = auth.uid()
    AND b.status = 'pending'
  RETURNING b.* INTO v_row;

  IF NOT FOUND THEN
    IF EXISTS (SELECT 1 FROM public.bookings WHERE id = p_booking_id) THEN
      RAISE EXCEPTION 'forbidden_or_invalid_booking';
    END IF;
    RAISE EXCEPTION 'booking_not_found';
  END IF;
  RETURN v_row;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_booking_paid(p_booking_id uuid, p_payment_method text)
RETURNS public.bookings
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_row public.bookings;
  v_role text := coalesce(auth.jwt() ->> 'role', '');
BEGIN
  IF auth.uid() IS NULL AND v_role <> 'service_role' THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  IF v_role = 'service_role' THEN
    UPDATE public.bookings
    SET payment_status = 'paid', payment_method = nullif(trim(coalesce(p_payment_method, '')), ''), paid_at = now(), updated_at = now()
    WHERE id = p_booking_id
    RETURNING * INTO v_row;
  ELSE
    IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'admin' AND p.account_status = 'active') THEN
      RAISE EXCEPTION 'forbidden';
    END IF;
    UPDATE public.bookings
    SET payment_status = 'paid', payment_method = nullif(trim(coalesce(p_payment_method, '')), ''), paid_at = now(), updated_at = now()
    WHERE id = p_booking_id
    RETURNING * INTO v_row;
  END IF;

  IF NOT FOUND THEN RAISE EXCEPTION 'booking_not_found'; END IF;
  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.set_booking_price(uuid,numeric,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_booking_price(uuid,numeric,text) TO authenticated;
REVOKE ALL ON FUNCTION public.mark_booking_paid(uuid,text) FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mark_booking_paid(uuid,text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_provider_dashboard_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO ''
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_completed integer := 0;
  v_earnings numeric := 0;
  v_reviews integer := 0;
  v_average numeric := 0;
  v_upcoming jsonb := '[]'::jsonb;
  v_activity jsonb := '[]'::jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles p JOIN public.provider_profiles pp ON pp.id = p.id WHERE p.id = v_uid AND p.role='provider' AND p.account_status='active' AND pp.verification_status='approved') THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT count(*)::integer, coalesce(sum(CASE WHEN b.payment_status='paid' AND b.price IS NOT NULL THEN b.price ELSE 0 END),0)
    INTO v_completed, v_earnings
  FROM public.bookings b WHERE b.provider_id=v_uid AND b.status='completed';

  SELECT count(*)::integer, coalesce(round(avg(r.rating)::numeric,2),0) INTO v_reviews, v_average
  FROM public.reviews r WHERE r.provider_id=v_uid AND r.is_hidden=false;

  SELECT coalesce(jsonb_agg(x.item ORDER BY x.service_date ASC),'[]'::jsonb) INTO v_upcoming
  FROM (SELECT jsonb_build_object('id',b.id,'customer_name',coalesce(nullif(trim(b.customer_name),''),p.full_name,'Customer'),'service_category',b.service_category,'service_description',b.service_description,'service_date',b.service_date,'location_text',b.location_text,'status',b.status,'created_at',b.created_at,'price',b.price,'currency',b.currency,'payment_status',b.payment_status) item,b.service_date
        FROM public.bookings b LEFT JOIN public.profiles p ON p.id=b.customer_id
        WHERE b.provider_id=v_uid AND b.status IN ('pending','accepted') AND b.service_date IS NOT NULL AND b.service_date>now()
        ORDER BY b.service_date ASC LIMIT 5) x;

  SELECT coalesce(jsonb_agg(x.item ORDER BY x.created_at DESC),'[]'::jsonb) INTO v_activity
  FROM (SELECT jsonb_build_object('id',n.id,'type',n.type,'title',n.title,'body',n.body,'is_read',n.is_read,'created_at',n.created_at,'metadata',n.metadata) item,n.created_at
        FROM public.notifications n WHERE n.user_id=v_uid ORDER BY n.created_at DESC LIMIT 5) x;

  RETURN jsonb_build_object('total_completed_bookings',v_completed,'total_earnings',v_earnings,'average_rating',v_average,'total_reviews',v_reviews,'upcoming_bookings',v_upcoming,'recent_activity',v_activity);
END;
$$;

REVOKE ALL ON FUNCTION public.get_provider_dashboard_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_provider_dashboard_stats() TO authenticated;
