-- Maak — real customer/provider messaging foundation.
-- Idempotent. Run after profiles.sql + bookings.sql + admin-verification.sql.
-- Conversations are created from real bookings or an explicit provider contact.
-- No demo conversations are inserted.

create table if not exists public.conversations (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid unique references public.bookings(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.conversation_participants (
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id uuid not null references public.profiles(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  read_at timestamptz
);

create index if not exists conversation_participants_user_idx
  on public.conversation_participants(user_id);
create index if not exists messages_conversation_created_idx
  on public.messages(conversation_id, created_at);

create or replace function public.chat_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists conversations_touch_updated_at on public.conversations;
create trigger conversations_touch_updated_at
  before update on public.conversations
  for each row execute function public.chat_touch_updated_at();

alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;

drop policy if exists "conversation_select_participant" on public.conversations;
create policy "conversation_select_participant" on public.conversations
  for select using (
    exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = conversations.id and cp.user_id = auth.uid()
    )
  );

drop policy if exists "conversation_participants_select_self" on public.conversation_participants;
create policy "conversation_participants_select_self" on public.conversation_participants
  for select using (user_id = auth.uid());

drop policy if exists "messages_select_participant" on public.messages;
create policy "messages_select_participant" on public.messages
  for select using (
    exists (
      select 1 from public.conversation_participants cp
      where cp.conversation_id = messages.conversation_id and cp.user_id = auth.uid()
    )
  );

-- All conversation/message mutations go through SECURITY DEFINER RPCs.
revoke insert, update, delete on public.conversations from anon, authenticated;
revoke insert, update, delete on public.conversation_participants from anon, authenticated;
revoke insert, update, delete on public.messages from anon, authenticated;
grant select on public.conversations, public.conversation_participants, public.messages to authenticated;

create or replace function public.get_or_create_provider_conversation(p_provider_profile_id uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_customer uuid := auth.uid();
  v_conversation uuid;
begin
  if v_customer is null then raise exception 'not_authenticated'; end if;
  if p_provider_profile_id is null then raise exception 'provider_not_found'; end if;
  if v_customer = p_provider_profile_id then raise exception 'forbidden'; end if;
  if not exists (
    select 1 from public.provider_profiles pp
    where pp.id = p_provider_profile_id and pp.verification_status = 'approved'
  ) then raise exception 'provider_not_bookable'; end if;

  select c.id into v_conversation
  from public.conversations c
  join public.conversation_participants cp1 on cp1.conversation_id = c.id and cp1.user_id = v_customer
  join public.conversation_participants cp2 on cp2.conversation_id = c.id and cp2.user_id = p_provider_profile_id
  where c.booking_id is null
  limit 1;

  if v_conversation is not null then return v_conversation; end if;

  insert into public.conversations default values returning id into v_conversation;
  insert into public.conversation_participants(conversation_id, user_id)
  values (v_conversation, v_customer), (v_conversation, p_provider_profile_id);
  return v_conversation;
end $$;

create or replace function public.get_or_create_booking_conversation(p_booking_id uuid)
returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_customer uuid;
  v_provider uuid;
  v_conversation uuid;
begin
  if v_uid is null then raise exception 'not_authenticated'; end if;
  select customer_id, provider_id into v_customer, v_provider
    from public.bookings where id = p_booking_id;
  if not found then raise exception 'not_found'; end if;
  if v_uid is distinct from v_customer and v_uid is distinct from v_provider then
    raise exception 'forbidden';
  end if;

  select id into v_conversation from public.conversations where booking_id = p_booking_id;
  if v_conversation is not null then return v_conversation; end if;

  insert into public.conversations(booking_id) values (p_booking_id)
  on conflict (booking_id) do update set booking_id = excluded.booking_id
  returning id into v_conversation;

  insert into public.conversation_participants(conversation_id, user_id)
  values (v_conversation, v_customer), (v_conversation, v_provider)
  on conflict do nothing;
  return v_conversation;
end $$;

-- Every real booking gets a conversation immediately; this is what makes the
-- Chat entry point available without inventing a provider or a conversation.
create or replace function public.create_booking_conversation_trigger()
returns trigger
language plpgsql security definer set search_path = public as $$
declare v_conversation uuid;
begin
  insert into public.conversations(booking_id) values (new.id)
  on conflict (booking_id) do update set booking_id = excluded.booking_id
  returning id into v_conversation;
  insert into public.conversation_participants(conversation_id, user_id)
  values (v_conversation, new.customer_id), (v_conversation, new.provider_id)
  on conflict do nothing;
  return new;
end $$;

drop trigger if exists bookings_create_conversation on public.bookings;
create trigger bookings_create_conversation
after insert on public.bookings
for each row execute function public.create_booking_conversation_trigger();

-- Backfill only real existing bookings; never create standalone/demo chats.
do $$
declare r record; v_conversation uuid;
begin
  for r in select id, customer_id, provider_id from public.bookings loop
    insert into public.conversations(booking_id) values (r.id)
    on conflict (booking_id) do update set booking_id = excluded.booking_id
    returning id into v_conversation;
    insert into public.conversation_participants(conversation_id, user_id)
    values (v_conversation, r.customer_id), (v_conversation, r.provider_id)
    on conflict do nothing;
  end loop;
end $$;

create or replace function public.list_my_conversations()
returns table(
  conversation_id uuid,
  booking_id uuid,
  other_user_id uuid,
  other_user_name text,
  last_message text,
  last_message_at timestamptz,
  unread_count bigint
)
language sql stable security definer set search_path = public as $$
  select
    c.id,
    c.booking_id,
    other_cp.user_id,
    coalesce(p.full_name, 'مستخدم') as other_user_name,
    lm.body,
    lm.created_at,
    coalesce(unread.cnt, 0)
  from public.conversations c
  join public.conversation_participants me
    on me.conversation_id = c.id and me.user_id = auth.uid()
  join lateral (
    select cp.user_id
    from public.conversation_participants cp
    where cp.conversation_id = c.id and cp.user_id <> auth.uid()
    limit 1
  ) other_cp on true
  left join public.profiles p on p.id = other_cp.user_id
  left join lateral (
    select m.body, m.created_at
    from public.messages m
    where m.conversation_id = c.id
    order by m.created_at desc
    limit 1
  ) lm on true
  left join lateral (
    select count(*)::bigint as cnt
    from public.messages m
    where m.conversation_id = c.id
      and m.sender_id <> auth.uid()
      and m.read_at is null
  ) unread on true
  where auth.uid() is not null
  order by coalesce(lm.created_at, c.updated_at) desc;
$$;

grant execute on function public.list_my_conversations() to authenticated;
revoke all on function public.list_my_conversations() from anon, public;

a create or replace function public.get_conversation_messages(p_conversation_id uuid)
returns table(id uuid, sender_id uuid, body text, created_at timestamptz, read_at timestamptz)
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not exists (
    select 1 from public.conversation_participants
    where conversation_id = p_conversation_id and user_id = auth.uid()
  ) then raise exception 'forbidden'; end if;
  return query
    select m.id, m.sender_id, m.body, m.created_at, m.read_at
    from public.messages m
    where m.conversation_id = p_conversation_id
    order by m.created_at asc;
end $$;

grant execute on function public.get_conversation_messages(uuid) to authenticated;
revoke all on function public.get_conversation_messages(uuid) from anon, public;

create or replace function public.send_chat_message(p_conversation_id uuid, p_body text)
returns public.messages
language plpgsql security definer set search_path = public as $$
declare v_row public.messages; v_body text := btrim(coalesce(p_body, ''));
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if char_length(v_body) = 0 then raise exception 'empty_message'; end if;
  if char_length(v_body) > 4000 then raise exception 'message_too_long'; end if;
  if not exists (
    select 1 from public.conversation_participants
    where conversation_id = p_conversation_id and user_id = auth.uid()
  ) then raise exception 'forbidden'; end if;
  insert into public.messages(conversation_id, sender_id, body)
  values (p_conversation_id, auth.uid(), v_body)
  returning * into v_row;
  update public.conversations set updated_at = now() where id = p_conversation_id;
  return v_row;
end $$;

grant execute on function public.send_chat_message(uuid, text) to authenticated;
revoke all on function public.send_chat_message(uuid, text) from anon, public;

create or replace function public.mark_chat_read(p_conversation_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'not_authenticated'; end if;
  if not exists (
    select 1 from public.conversation_participants
    where conversation_id = p_conversation_id and user_id = auth.uid()
  ) then raise exception 'forbidden'; end if;
  update public.messages
    set read_at = now()
    where conversation_id = p_conversation_id
      and sender_id <> auth.uid()
      and read_at is null;
end $$;

grant execute on function public.mark_chat_read(uuid) to authenticated;
revoke all on function public.mark_chat_read(uuid) from anon, public;

-- Realtime: add messages only once if the publication does not already contain it.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages'
  ) then
    alter publication supabase_realtime add table public.messages;
  end if;
end $$;
