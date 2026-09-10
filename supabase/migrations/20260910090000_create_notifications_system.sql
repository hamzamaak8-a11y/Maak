create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  metadata jsonb null
);
create index if not exists notifications_user_created_idx on public.notifications(user_id, created_at desc);
create index if not exists notifications_user_unread_idx on public.notifications(user_id, is_read, created_at desc);
alter table public.notifications enable row level security;
revoke all on table public.notifications from anon, authenticated;
grant select on table public.notifications to authenticated;
drop policy if exists "users can read own notifications" on public.notifications;
create policy "users can read own notifications" on public.notifications for select to authenticated using ((select auth.uid()) is not null and (select auth.uid()) = user_id);

create or replace function public.notify_user(p_user_id uuid,p_type text,p_title text,p_body text,p_metadata jsonb default null)
returns public.notifications language plpgsql security definer set search_path = '' as $$
declare v_row public.notifications;
begin
 if p_user_id is null then raise exception 'invalid_notification_recipient'; end if;
 if p_type is null or btrim(p_type)='' then raise exception 'invalid_notification_type'; end if;
 if p_title is null or btrim(p_title)='' then raise exception 'invalid_notification_title'; end if;
 if p_body is null or btrim(p_body)='' then raise exception 'invalid_notification_body'; end if;
 insert into public.notifications(user_id,type,title,body,metadata) values(p_user_id,btrim(p_type),btrim(p_title),btrim(p_body),p_metadata) returning * into v_row;
 return v_row;
end;$$;
revoke execute on function public.notify_user(uuid,text,text,text,jsonb) from public,anon,authenticated;

create or replace function public.get_my_notifications(p_limit integer default 50,p_offset integer default 0)
returns setof public.notifications language plpgsql security definer set search_path = '' as $$
declare v_uid uuid:=auth.uid();v_limit integer:=least(greatest(coalesce(p_limit,50),1),100);v_offset integer:=greatest(coalesce(p_offset,0),0);
begin
 if v_uid is null then raise exception 'forbidden'; end if;
 return query select n.* from public.notifications n where n.user_id=v_uid order by n.created_at desc,n.id desc limit v_limit offset v_offset;
end;$$;
grant execute on function public.get_my_notifications(integer,integer) to authenticated;
revoke execute on function public.get_my_notifications(integer,integer) from public,anon;

create or replace function public.mark_notification_read(p_notification_id uuid)
returns public.notifications language plpgsql security definer set search_path = '' as $$
declare v_uid uuid:=auth.uid();v_row public.notifications;
begin
 if v_uid is null then raise exception 'forbidden'; end if;
 update public.notifications set is_read=true where id=p_notification_id and user_id=v_uid returning * into v_row;
 if not found then raise exception 'notification_not_found'; end if;
 return v_row;
end;$$;
grant execute on function public.mark_notification_read(uuid) to authenticated;
revoke execute on function public.mark_notification_read(uuid) from public,anon;

create or replace function public.mark_all_notifications_read()
returns integer language plpgsql security definer set search_path = '' as $$
declare v_uid uuid:=auth.uid();v_count integer;
begin
 if v_uid is null then raise exception 'forbidden'; end if;
 update public.notifications set is_read=true where user_id=v_uid and is_read=false;
 get diagnostics v_count=row_count; return v_count;
end;$$;
grant execute on function public.mark_all_notifications_read() to authenticated;
revoke execute on function public.mark_all_notifications_read() from public,anon;

do $$ begin
 if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='notifications') then
  alter publication supabase_realtime add table public.notifications;
 end if;
end $$;

-- Existing lifecycle RPCs keep their current authorization and transition checks; these calls append transactional notifications.
create or replace function public.accept_booking(p_booking_id uuid) returns public.bookings language plpgsql security definer set search_path to 'public' as $$ declare v_row public.bookings; begin perform public.require_auth_uid();select * into v_row from public.bookings where id=p_booking_id for update;if not found then raise exception 'not_found';end if;perform public.assert_provider_owner(v_row.provider_id);if v_row.status<>'pending' then raise exception 'invalid_transition';end if;update public.bookings set status='accepted',accepted_at=now(),updated_at=now() where id=p_booking_id returning * into v_row;update public.booking_slots set status='confirmed',updated_at=now() where booking_id=p_booking_id and status='pending';perform public.notify_user(v_row.customer_id,'booking_accepted','notifications.bookingAcceptedTitle','notifications.bookingAcceptedBody',jsonb_build_object('booking_id',v_row.id));return v_row;end $$;
create or replace function public.reject_booking(p_booking_id uuid,p_reason text) returns public.bookings language plpgsql security definer set search_path to 'public' as $$ declare v_row public.bookings; begin perform public.require_auth_uid();if p_reason is null or btrim(p_reason)='' then raise exception 'reason_required';end if;select * into v_row from public.bookings where id=p_booking_id for update;if not found then raise exception 'not_found';end if;perform public.assert_provider_owner(v_row.provider_id);if v_row.status<>'pending' then raise exception 'invalid_transition';end if;update public.bookings set status='rejected',rejection_reason=btrim(p_reason),updated_at=now() where id=p_booking_id returning * into v_row;update public.booking_slots set status='cancelled',updated_at=now() where booking_id=p_booking_id and status='pending';perform public.notify_user(v_row.customer_id,'booking_rejected','notifications.bookingRejectedTitle','notifications.bookingRejectedBody',jsonb_build_object('booking_id',v_row.id,'reason',v_row.rejection_reason));return v_row;end $$;
create or replace function public.start_booking(p_booking_id uuid) returns public.bookings language plpgsql security definer set search_path to 'public' as $$ declare v_row public.bookings; begin perform public.require_auth_uid();select * into v_row from public.bookings where id=p_booking_id for update;if not found then raise exception 'not_found';end if;perform public.assert_provider_owner(v_row.provider_id);if v_row.status <> 'accepted' then raise exception 'invalid_transition';end if;update public.bookings set status='in_progress',started_at=now() where id=p_booking_id returning * into v_row;perform public.notify_user(v_row.customer_id,'booking_started','notifications.bookingStartedTitle','notifications.bookingStartedBody',jsonb_build_object('booking_id',v_row.id));return v_row;end $$;
create or replace function public.complete_booking(p_booking_id uuid) returns public.bookings language plpgsql security definer set search_path to 'public' as $$ declare v_row public.bookings; begin perform public.require_auth_uid();select * into v_row from public.bookings where id=p_booking_id for update;if not found then raise exception 'not_found';end if;perform public.assert_provider_owner(v_row.provider_id);if v_row.status <> 'in_progress' then raise exception 'invalid_transition';end if;update public.bookings set status='completed',completed_at=now() where id=p_booking_id returning * into v_row;perform public.notify_user(v_row.customer_id,'booking_completed','notifications.bookingCompletedTitle','notifications.bookingCompletedBody',jsonb_build_object('booking_id',v_row.id));return v_row;end $$;
create or replace function public.cancel_booking(p_booking_id uuid) returns public.bookings language plpgsql security definer set search_path to 'public' as $$ declare v_uid uuid:=public.require_auth_uid();v_row public.bookings;v_account_status text;begin select account_status into v_account_status from public.profiles where id=v_uid and role='customer';if not found or v_account_status is distinct from 'active' then raise exception 'forbidden';end if;select * into v_row from public.bookings where id=p_booking_id for update;if not found then raise exception 'not_found';end if;if v_row.customer_id is distinct from v_uid then raise exception 'forbidden';end if;if v_row.status<>'pending' then raise exception 'invalid_transition';end if;update public.bookings set status='cancelled',cancelled_at=now(),updated_at=now() where id=p_booking_id returning * into v_row;update public.booking_slots set status='cancelled',updated_at=now() where booking_id=p_booking_id and status='pending';perform public.notify_user(v_row.provider_id,'booking_cancelled','notifications.bookingCancelledTitle','notifications.bookingCancelledBody',jsonb_build_object('booking_id',v_row.id));return v_row;end $$;
create or replace function public.send_chat_message(p_conversation_id uuid,p_body text) returns public.messages language plpgsql security definer set search_path to 'public' as $$ declare v_row public.messages;v_body text:=btrim(coalesce(p_body,''));v_recipient_id uuid;begin perform public.assert_active_chat_user();if char_length(v_body)=0 then raise exception 'empty_message';end if;if char_length(v_body)>4000 then raise exception 'message_too_long';end if;if not exists(select 1 from public.conversation_participants where conversation_id=p_conversation_id and user_id=auth.uid()) then raise exception 'forbidden';end if;select cp.user_id into v_recipient_id from public.conversation_participants cp where cp.conversation_id=p_conversation_id and cp.user_id is distinct from auth.uid() order by cp.user_id limit 1;insert into public.messages(conversation_id,sender_id,body) values(p_conversation_id,auth.uid(),v_body) returning * into v_row;update public.conversations set updated_at=now() where id=p_conversation_id;if v_recipient_id is not null then perform public.notify_user(v_recipient_id,'new_message','notifications.newMessageTitle','notifications.newMessageBody',jsonb_build_object('conversation_id',p_conversation_id,'message_id',v_row.id,'sender_id',auth.uid()));end if;return v_row;end $$;
create or replace function public.submit_review(p_booking_id uuid,p_rating integer,p_comment text default null) returns public.reviews language plpgsql security definer set search_path = '' as $$ declare v_uid uuid:=auth.uid();v_customer_id uuid;v_provider_id uuid;v_status text;v_row public.reviews;v_comment text;begin if v_uid is null then raise exception 'forbidden';end if;if p_booking_id is null then raise exception 'booking_not_found';end if;if p_rating is null or p_rating<1 or p_rating>5 then raise exception 'invalid_rating';end if;v_comment:=nullif(btrim(coalesce(p_comment,'')),'');if v_comment is not null and char_length(v_comment)>1000 then raise exception 'comment_too_long';end if;select b.customer_id,b.provider_id,b.status into v_customer_id,v_provider_id,v_status from public.bookings b where b.id=p_booking_id for share;if not found then raise exception 'booking_not_found';end if;if v_customer_id is distinct from v_uid then raise exception 'forbidden';end if;if v_status is distinct from 'completed' then raise exception 'booking_not_completed';end if;if exists(select 1 from public.reviews r where r.booking_id=p_booking_id) then raise exception 'already_reviewed';end if;insert into public.reviews(booking_id,customer_id,provider_id,rating,comment) values(p_booking_id,v_uid,v_provider_id,p_rating,v_comment) returning * into v_row;perform public.notify_user(v_provider_id,'review_received','notifications.reviewReceivedTitle','notifications.reviewReceivedBody',jsonb_build_object('booking_id',p_booking_id,'review_id',v_row.id,'rating',p_rating));return v_row;exception when unique_violation then raise exception 'already_reviewed';end $$;
