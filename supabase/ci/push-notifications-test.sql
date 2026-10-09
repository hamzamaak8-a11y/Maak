-- Push tokens: RLS, RPC rules, the dormant trigger and the dispatch payload (pg_net is replaced by a recorder).
begin;
select set_config('request.jwt.claim.role','service_role',false);
insert into auth.users(id,email) values ('00000000-0000-0000-0000-0000000000c1','a@x'),('00000000-0000-0000-0000-0000000000c2','b@x');
insert into public.profiles(id,role,full_name,city,account_status) values ('00000000-0000-0000-0000-0000000000c1','customer','A','Fes','active'),('00000000-0000-0000-0000-0000000000c2','customer','B','Fes','suspended')
 on conflict (id) do update set account_status=excluded.account_status;
create temp table res(case_name text, expect text, got text);
grant all on res to public;
create or replace function pg_temp.try(q text) returns text language plpgsql as $$ begin execute q; return 'ok'; exception when others then return sqlerrm; end $$;
set role authenticated;
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c1',false);
insert into res select 'register: valid token', 'ok', pg_temp.try($$select public.register_push_token('ExponentPushToken[abcdefghij123456]','android','ar')$$);
insert into res select 'register: same token twice is idempotent', 'ok', pg_temp.try($$select public.register_push_token('ExponentPushToken[abcdefghij123456]','android','fr')$$);
insert into res select 'register: garbage token', 'invalid_push_token', pg_temp.try($$select public.register_push_token('hello','android','en')$$);
insert into res select 'register: bad platform', 'invalid_push_token', pg_temp.try($$select public.register_push_token('ExponentPushToken[abcdefghij123456]','web','en')$$);
insert into res select 'rls: owner sees own token once', '1', (select count(*)::text from public.push_tokens);
insert into res select 'rls: no direct insert', 'permission denied for table push_tokens', pg_temp.try($$insert into public.push_tokens(user_id,token,platform) values ('00000000-0000-0000-0000-0000000000c1','ExponentPushToken[zzzzzzzzzz9999]','android')$$);
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c2',false);
insert into res select 'register: suspended account refused', 'forbidden', pg_temp.try($$select public.register_push_token('ExponentPushToken[suspendedtoken01]','android','en')$$);
insert into res select 'rls: other user sees nothing', '0', (select count(*)::text from public.push_tokens);
insert into res select 'unregister: cannot delete someone else''s token', 'ok', pg_temp.try($$select public.unregister_push_token('ExponentPushToken[abcdefghij123456]')$$);
reset role;
insert into res select 'unregister: foreign token still there', '1', (select count(*)::text from public.push_tokens);
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c1',false);
select public.unregister_push_token('ExponentPushToken[abcdefghij123456]');
reset role;
insert into res select 'unregister: own token removed', '0', (select count(*)::text from public.push_tokens);
select public.register_push_token('x','android','en') where false;
-- device switches account: token moves
update public.profiles set account_status='active' where id='00000000-0000-0000-0000-0000000000c2';
set role authenticated; select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c1',false);
select public.register_push_token('ExponentPushToken[sharedevice0001]','ios','en');
select set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000c2',false);
select public.register_push_token('ExponentPushToken[sharedevice0001]','ios','fr');
reset role;
insert into res select 'register: token moves with the device', '00000000-0000-0000-0000-0000000000c2', (select user_id::text from public.push_tokens where token='ExponentPushToken[sharedevice0001]');
-- trigger: dormant without config, never breaks the insert, dispatches with config
insert into res select 'trigger: no config -> notification still inserted', 'ok', pg_temp.try($$select public.notify_user('00000000-0000-0000-0000-0000000000c2','booking_new','notifications.bookingNewTitle','notifications.bookingNewBody','{"booking_id":"b1"}')$$);
create schema if not exists net;
create table if not exists net.calls(url text, body jsonb, headers jsonb);
create or replace function net.http_post(url text, body jsonb default '{}', params jsonb default '{}', headers jsonb default '{}', timeout_milliseconds integer default 5000) returns bigint language sql as $$ insert into net.calls values (url, body, headers) returning 1::bigint $$;
insert into private.push_config(worker_url, secret) values ('https://worker.example/push/notify', 'a-very-long-shared-secret-123456');
select public.notify_user('00000000-0000-0000-0000-0000000000c2','booking_new','notifications.bookingNewTitle','notifications.bookingNewBody','{"booking_id":"b2"}');
insert into res select 'trigger: with config -> one dispatch', '1', (select count(*)::text from net.calls);
insert into res select 'trigger: payload has user and secret header', 'true', (select (body->>'user_id' = '00000000-0000-0000-0000-0000000000c2' and headers->>'X-Maak-Push-Secret' = 'a-very-long-shared-secret-123456')::text from net.calls limit 1);
select public.notify_user('00000000-0000-0000-0000-0000000000c1','booking_new','notifications.bookingNewTitle','notifications.bookingNewBody',null);
insert into res select 'trigger: user without device -> no dispatch', '1', (select count(*)::text from net.calls);
create or replace function net.http_post(url text, body jsonb default '{}', params jsonb default '{}', headers jsonb default '{}', timeout_milliseconds integer default 5000) returns bigint language plpgsql as $$ begin raise exception 'network down'; end $$;
insert into res select 'trigger: failing http never breaks the notification', 'ok', pg_temp.try($$select public.notify_user('00000000-0000-0000-0000-0000000000c2','booking_new','notifications.bookingNewTitle','notifications.bookingNewBody',null)$$);
-- revoke without a session (offline sign-out): only makes the server stop sending to that exact token
reset role;
insert into public.push_tokens(user_id, token, platform) values ('00000000-0000-0000-0000-0000000000c2','ExponentPushToken[revokeme000001]','android'),('00000000-0000-0000-0000-0000000000c2','ExponentPushToken[keepme00000002]','android');
set role anon;
insert into res select 'revoke: anon cannot read tokens', 'permission denied for table push_tokens', pg_temp.try($$select * from public.push_tokens$$);
insert into res select 'revoke: anon cannot register', 'permission denied for function register_push_token', pg_temp.try($$select public.register_push_token('ExponentPushToken[anonattempt001]','android','en')$$);
insert into res select 'revoke: anon revokes by token', 'ok', pg_temp.try($$select public.revoke_push_token('ExponentPushToken[revokeme000001]')$$);
insert into res select 'revoke: garbage is a silent no-op', 'ok', pg_temp.try($$select public.revoke_push_token('%')$$);
insert into res select 'revoke: wildcard does not delete everything', 'ok', pg_temp.try($$select public.revoke_push_token('ExponentPushToken[%]')$$);
reset role;
insert into res select 'revoke: exactly the named token is gone', 'true,true', (select (not exists(select 1 from public.push_tokens where token='ExponentPushToken[revokeme000001]'))::text from (select 1) x)::text || ',' || (exists(select 1 from public.push_tokens where token='ExponentPushToken[keepme00000002]'))::text;
\echo ===== mismatches (must be empty) =====
select case_name, expect, got from res where expect <> got;
select count(*) as total_checks, count(*) filter (where expect = got) as passed from res;
rollback;
