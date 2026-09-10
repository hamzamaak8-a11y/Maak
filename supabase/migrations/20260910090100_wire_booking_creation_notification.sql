create or replace function public.create_booking(p_provider_listing_id integer,p_service_category text,p_service_description text,p_service_date timestamp with time zone,p_location_text text,p_customer_note text default '')
returns public.bookings language plpgsql security definer set search_path to 'public' as $$
declare v_customer uuid:=public.require_auth_uid();v_customer_status text;v_provider_profile_id uuid;v_provider_status text;v_verification text;v_customer_name text;v_row public.bookings;v_slot_end timestamptz;v_day integer;v_start time;v_has_window boolean;
begin
 select account_status,full_name into v_customer_status,v_customer_name from public.profiles where id=v_customer and role='customer';
 if not found or v_customer_status is distinct from 'active' then raise exception 'forbidden'; end if;
 if p_service_category is null or btrim(p_service_category)='' then raise exception 'invalid_service'; end if;
 if p_service_date is null or p_service_date<=now() then raise exception 'invalid_service_date'; end if;
 select provider_profile_id into v_provider_profile_id from public.providers where id=p_provider_listing_id and listing_kind='real' and published_at is not null;
 if not found or v_provider_profile_id is null then raise exception 'provider_not_found'; end if;
 select pp.verification_status,pr.account_status into v_verification,v_provider_status from public.provider_profiles pp join public.profiles pr on pr.id=pp.id where pp.id=v_provider_profile_id;
 if not found or v_verification is distinct from 'approved' or v_provider_status is distinct from 'active' then raise exception 'provider_not_bookable'; end if;
 v_slot_end:=p_service_date+interval '1 hour';
 if (p_service_date at time zone current_setting('TIMEZONE'))::date is distinct from (v_slot_end at time zone current_setting('TIMEZONE'))::date then raise exception 'invalid_service_date'; end if;
 v_day:=extract(dow from p_service_date)::integer;v_start:=p_service_date::time;
 select exists(select 1 from public.provider_availability pa where pa.provider_id=p_provider_listing_id and pa.day_of_week=v_day and pa.is_available and pa.start_time<=v_start and pa.end_time>=v_slot_end::time) into v_has_window;
 if not v_has_window then raise exception 'provider_unavailable'; end if;
 insert into public.bookings(customer_id,provider_id,provider_listing_id,service_category,service_description,service_date,location_text,customer_note,status,customer_name) values(v_customer,v_provider_profile_id,p_provider_listing_id,btrim(p_service_category),coalesce(p_service_description,''),p_service_date,p_location_text,coalesce(p_customer_note,''),'pending',v_customer_name) returning * into v_row;
 insert into public.booking_slots(booking_id,provider_id,start_time,end_time,status) values(v_row.id,p_provider_listing_id,p_service_date,v_slot_end,'pending');
 perform public.notify_user(v_provider_profile_id,'booking_new','notifications.bookingNewTitle','notifications.bookingNewBody',jsonb_build_object('booking_id',v_row.id,'provider_listing_id',p_provider_listing_id));
 return v_row;
exception when exclusion_violation then raise exception 'slot_unavailable'; end;
$$;

revoke execute on function public.create_booking(integer,text,text,timestamptz,text,text) from public,anon;
grant execute on function public.create_booking(integer,text,text,timestamptz,text,text) to authenticated;
