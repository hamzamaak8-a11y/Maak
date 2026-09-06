# Maak — Production Manual Runbook

These are the only remaining manual database steps currently required for the work already committed. Do not mark them as applied until they are executed in the real Supabase project and verified.

## 1. Booking security hardening

Open the Supabase SQL Editor for the production project and run, in order if not already applied:

1. `worker/db/profiles.sql`
2. `worker/db/provider-onboarding.sql`
3. `worker/db/bookings.sql`
4. `worker/db/admin-verification.sql`
5. `worker/db/phase-a-listing-foundation.sql`
6. `worker/db/security-hardening.sql`

For an already initialized database, the migrations are designed to be re-runnable; still inspect the SQL and execute them as a controlled production migration.

### Verify booking RPC privileges

```sql
select routine_name, grantee, privilege_type
from information_schema.routine_privileges
where routine_schema = 'public'
  and routine_name in ('create_booking','cancel_booking','accept_booking','reject_booking','start_booking','complete_booking')
order by routine_name, grantee;
```

Expected: authenticated can execute; anon/PUBLIC must not have execute privileges.

## 2. Real-time chat

Run:

`worker/db/chat.sql`

This creates conversations, participants and messages, enables participant-only RLS, creates booking-linked conversations, supports direct provider contact, installs secure RPCs, backfills conversations only for existing real bookings, and adds `messages` to the Supabase realtime publication.

### Verify chat tables

```sql
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('conversations','conversation_participants','messages')
order by table_name;
```

Expected: all three tables.

### Verify chat RPC privileges

```sql
select routine_name, grantee, privilege_type
from information_schema.routine_privileges
where routine_schema = 'public'
  and routine_name in (
    'get_or_create_provider_conversation',
    'get_or_create_booking_conversation',
    'list_my_conversations',
    'get_conversation_messages',
    'send_chat_message',
    'mark_chat_read'
  )
order by routine_name, grantee;
```

Expected: authenticated can execute; anon/PUBLIC must not have execute privileges.

### Verify realtime publication

```sql
select schemaname, tablename
from pg_publication_tables
where pubname = 'supabase_realtime'
  and schemaname = 'public'
  and tablename = 'messages';
```

Expected: one row for `public.messages`.

## 3. Final live verification

After manual SQL succeeds:

- Open the production Maak URL.
- Sign in as a real customer.
- Open a real published provider.
- Use Contact to open the real conversation.
- Send a message.
- Sign in as the provider and confirm the message appears in realtime.
- Reply as provider and confirm the customer receives it.
- Create a real booking and verify a booking-linked conversation exists.
- Confirm no demo/fake conversation appears for a new account.

The assistant must not mark these manual items as complete until the owner has executed and verified them.
