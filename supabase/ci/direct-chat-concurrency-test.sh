#!/usr/bin/env bash
# Two transactions start the same direct chat at the same moment: they must end up in ONE conversation.
# Usage (after replay.sh built the template database):
#   PSQL="psql -h /tmp -p 5544 -U postgres" bash supabase/ci/direct-chat-concurrency-test.sh maak_replay
# It copies the template into a scratch database, commits a tiny fixture there, races two sessions, then drops the scratch database.
set -euo pipefail
TEMPLATE="${1:-maak_replay}"
PSQL="${PSQL:-psql}"
SCRATCH="${TEMPLATE}_chat_race"
TMP="$(mktemp -d)"
trap '$PSQL -d postgres -qc "drop database if exists $SCRATCH" >/dev/null 2>&1 || true; rm -rf "$TMP"' EXIT
CUST=00000000-0000-0000-0000-0000000000c1
PROV=00000000-0000-0000-0000-0000000000e1

$PSQL -d postgres -qc "drop database if exists $SCRATCH" -c "create database $SCRATCH template $TEMPLATE" >/dev/null
$PSQL -d "$SCRATCH" -q >/dev/null <<SQL
select set_config('request.jwt.claim.role','service_role',false);
insert into auth.users(id,email) values ('$CUST','cust@x'),('$PROV','prov@x');
insert into public.profiles(id,role,full_name,city,account_status) values ('$CUST','customer','Cust','Fes','active'),('$PROV','provider','Prov','Fes','active')
  on conflict (id) do update set role=excluded.role, full_name=excluded.full_name, city=excluded.city;
insert into public.provider_profiles(id,profession,verification_status,service_category,bio,services) values ('$PROV','Plumber','pending','x','b',array['a']) on conflict do nothing;
insert into storage.objects(bucket_id,name,owner_id) values ('provider-documents','x/1','$PROV'),('provider-documents','x/2','$PROV');
insert into public.provider_documents(provider_id,document_type,status,storage_path) values ('$PROV','national_id','pending','x/1'),('$PROV','profile_photo','pending','x/2');
update public.provider_profiles set verification_status='approved' where id='$PROV';
SQL

session() {  # one transaction that starts the chat, then stays open for 2 seconds before committing
  $PSQL -d "$SCRATCH" -At >"$1" <<SQL
begin;
select set_config('request.jwt.claim.role','authenticated',true), set_config('request.jwt.claim.sub','$CUST',true);
select 'ID ' || public.get_or_create_provider_conversation('$PROV');
select pg_sleep(2);
commit;
SQL
}
session "$TMP/a" & PID=$!
sleep 0.6
session "$TMP/b"
wait $PID
A="$(grep '^ID ' "$TMP/a" | cut -c4-)"; B="$(grep '^ID ' "$TMP/b" | cut -c4-)"
N="$($PSQL -d "$SCRATCH" -At -c "select count(*) from public.conversations c where c.booking_id is null and exists (select 1 from public.conversation_participants p where p.conversation_id=c.id and p.user_id='$CUST')")"
echo "session A -> $A"; echo "session B -> $B"; echo "direct conversations for the pair: $N"
[ -n "$A" ] && [ "$A" = "$B" ] && [ "$N" = "1" ] && echo "PASS: one conversation" || { echo "FAIL: duplicate conversations"; exit 1; }
