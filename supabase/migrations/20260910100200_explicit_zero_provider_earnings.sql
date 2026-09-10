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
  v_earnings_currency text := NULL;
  v_currency_count integer := 0;
  v_reviews integer := 0;
  v_average numeric := 0;
  v_upcoming jsonb := '[]'::jsonb;
  v_activity jsonb := '[]'::jsonb;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles p JOIN public.provider_profiles pp ON pp.id=p.id WHERE p.id=v_uid AND p.role='provider' AND p.account_status='active' AND pp.verification_status='approved') THEN RAISE EXCEPTION 'forbidden'; END IF;
  SELECT count(*)::integer INTO v_completed FROM public.bookings b WHERE b.provider_id=v_uid AND b.status='completed';
  SELECT count(DISTINCT b.currency)::integer, min(b.currency), coalesce(sum(b.price),0) INTO v_currency_count, v_earnings_currency, v_earnings FROM public.bookings b WHERE b.provider_id=v_uid AND b.status='completed' AND b.payment_status='paid' AND b.price IS NOT NULL;
  IF v_currency_count=0 THEN v_earnings:=0; v_earnings_currency:=NULL; ELSIF v_currency_count>1 THEN v_earnings:=NULL; v_earnings_currency:=NULL; END IF;
  SELECT count(*)::integer, coalesce(round(avg(r.rating)::numeric,2),0) INTO v_reviews,v_average FROM public.reviews r WHERE r.provider_id=v_uid AND r.is_hidden=false;
  SELECT coalesce(jsonb_agg(x.item ORDER BY x.service_date ASC),'[]'::jsonb) INTO v_upcoming FROM (SELECT jsonb_build_object('id',b.id,'customer_name',coalesce(nullif(trim(b.customer_name),''),p.full_name,'Customer'),'service_category',b.service_category,'service_description',b.service_description,'service_date',b.service_date,'location_text',b.location_text,'status',b.status,'created_at',b.created_at,'price',b.price,'currency',b.currency,'payment_status',b.payment_status) item,b.service_date FROM public.bookings b LEFT JOIN public.profiles p ON p.id=b.customer_id WHERE b.provider_id=v_uid AND b.status IN ('pending','accepted') AND b.service_date IS NOT NULL AND b.service_date>now() ORDER BY b.service_date ASC LIMIT 5) x;
  SELECT coalesce(jsonb_agg(x.item ORDER BY x.created_at DESC),'[]'::jsonb) INTO v_activity FROM (SELECT jsonb_build_object('id',n.id,'type',n.type,'title',n.title,'body',n.body,'is_read',n.is_read,'created_at',n.created_at,'metadata',n.metadata) item,n.created_at FROM public.notifications n WHERE n.user_id=v_uid ORDER BY n.created_at DESC LIMIT 5) x;
  RETURN jsonb_build_object('total_completed_bookings',v_completed,'total_earnings',v_earnings,'total_earnings_currency',v_earnings_currency,'average_rating',v_average,'total_reviews',v_reviews,'upcoming_bookings',v_upcoming,'recent_activity',v_activity);
END;
$$;
REVOKE ALL ON FUNCTION public.get_provider_dashboard_stats() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_provider_dashboard_stats() TO authenticated;
