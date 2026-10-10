-- Identity-document files: who may delete what, and approval evidence that actually exists in Storage.
-- Run on a replayed schema:  bash supabase/ci/replay.sh maak_replay && psql -d maak_replay -f supabase/ci/document-files-test.sql
-- Ends with a ROLLBACK. Expect no row under 'mismatches' and passed = total_checks.
begin;
select set_config('request.jwt.claim.role','service_role',false);
insert into auth.users(id,email) values ('00000000-0000-0000-0000-0000000000a1','admin@x'),('00000000-0000-0000-0000-0000000000c1','other@x'),('00000000-0000-0000-0000-0000000000e1','p1@x'),('00000000-0000-0000-0000-0000000000e2','p2@x');
insert into public.profiles(id,role,full_name,city,account_status) values ('00000000-0000-0000-0000-0000000000a1','admin','Boss','Rabat','active'),('00000000-0000-0000-0000-0000000000c1','provider','Other','Fes','active'),('00000000-0000-0000-0000-0000000000e1','provider','P1','Fes','active'),('00000000-0000-0000-0000-0000000000e2','provider','P2','Fes','active')
 on conflict (id) do update set role=excluded.role, full_name=excluded.full_name, city=excluded.city, account_status='active';
insert into public.provider_profiles(id,profession,verification_status,service_category,bio,services) values
 ('00000000-0000-0000-0000-0000000000c1','X','pending','x','b',array['a']),('00000000-0000-0000-0000-0000000000e1','X','pending','x','b',array['a']),('00000000-0000-0000-0000-0000000000e2','X','pending','x','b',array['a']) on conflict do nothing;
-- files in Storage (owner = the uploader) and their metadata
insert into storage.objects(bucket_id,name,owner_id) values
 ('provider-documents','00000000-0000-0000-0000-0000000000e1/id-approved','00000000-0000-0000-0000-0000000000e1'),
 ('provider-documents','00000000-0000-0000-0000-0000000000e1/photo-pending','00000000-0000-0000-0000-0000000000e1'),
 ('provider-documents','00000000-0000-0000-0000-0000000000e1/pro-rejected','00000000-0000-0000-0000-0000000000e1'),
 ('provider-documents','00000000-0000-0000-0000-0000000000e1/orphan','00000000-0000-0000-0000-0000000000e1'),
 ('provider-documents','00000000-0000-0000-0000-0000000000c1/id-theirs','00000000-0000-0000-0000-0000000000c1'),
 ('provider-documents','00000000-0000-0000-0000-0000000000e2/id','00000000-0000-0000-0000-0000000000e2'),
 ('provider-documents','00000000-0000-0000-0000-0000000000e2/photo','00000000-0000-0000-0000-0000000000e2'),
 ('provider-documents','00000000-0000-0000-0000-0000000000e1/photo-ok','00000000-0000-0000-0000-0000000000e1');
insert into public.provider_documents(provider_id,document_type,storage_path,status) values
 ('00000000-0000-0000-0000-0000000000e1','national_id','00000000-0000-0000-0000-0000000000e1/id-approved','pending'),
 ('00000000-0000-0000-0000-0000000000e1','profile_photo','00000000-0000-0000-0000-0000000000e1/photo-ok','pending'),
 ('00000000-0000-0000-0000-0000000000e1','profile_photo','00000000-0000-0000-0000-0000000000e1/photo-pending','pending'),
 ('00000000-0000-0000-0000-0000000000e1','professional_document','00000000-0000-0000-0000-0000000000e1/pro-rejected','pending'),
 ('00000000-0000-0000-0000-0000000000c1','national_id','00000000-0000-0000-0000-0000000000c1/id-theirs','pending'),
 ('00000000-0000-0000-0000-0000000000e2','national_id','00000000-0000-0000-0000-0000000000e2/id','pending'),
 ('00000000-0000-0000-0000-0000000000e2','profile_photo','00000000-0000-0000-0000-0000000000e2/photo','pending');
update public.provider_documents set status='approved' where storage_path='00000000-0000-0000-0000-0000000000e1/id-approved';
update public.provider_documents set status='rejected' where storage_path='00000000-0000-0000-0000-0000000000e1/pro-rejected';
create temp table res(case_name text, expect text, got text);
grant all on res to public;
create or replace function pg_temp.try(q text) returns text language plpgsql as $$ begin execute q; return 'ok'; exception when others then return sqlerrm; end $$;
create or replace function pg_temp.del(path text) returns text language plpgsql as $$ declare n int; begin delete from storage.objects where bucket_id='provider-documents' and name = path; get diagnostics n = row_count; return n::text; end $$;
create or replace function pg_temp.delrow(path text) returns text language plpgsql as $$ declare n int; begin delete from public.provider_documents where storage_path = path; get diagnostics n = row_count; return n::text; end $$;
create or replace function pg_temp.upd(path text) returns text language plpgsql as $$ declare n int; begin update storage.objects set updated_at_marker = true where bucket_id='provider-documents' and name = path; get diagnostics n = row_count; return n::text; end $$;
grant execute on function pg_temp.try(text), pg_temp.del(text), pg_temp.delrow(text), pg_temp.upd(text) to public;

set role authenticated;
select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000e1',false);
insert into res select 'owner cannot delete the file of an APPROVED document', '0', pg_temp.del('00000000-0000-0000-0000-0000000000e1/id-approved');
insert into res select 'owner cannot delete the file of a REJECTED document', '0', pg_temp.del('00000000-0000-0000-0000-0000000000e1/pro-rejected');
insert into res select 'metadata of an approved document cannot be deleted either (unchanged rule)', '0', pg_temp.delrow('00000000-0000-0000-0000-0000000000e1/id-approved');
insert into res select 'nobody can delete someone else''s file', '0', pg_temp.del('00000000-0000-0000-0000-0000000000c1/id-theirs');
insert into res select 'owner cannot overwrite (upsert) the file of an APPROVED document', '0', pg_temp.upd('00000000-0000-0000-0000-0000000000e1/id-approved');
insert into res select 'owner cannot overwrite the file of a REJECTED document', '0', pg_temp.upd('00000000-0000-0000-0000-0000000000e1/pro-rejected');
insert into res select 'owner can still replace a PENDING document file', '1', pg_temp.upd('00000000-0000-0000-0000-0000000000e1/photo-ok');
insert into res select 'owner can delete a PENDING document file (replace flow)', '1', pg_temp.del('00000000-0000-0000-0000-0000000000e1/photo-pending');
insert into res select 'owner can clean up an upload that has no metadata row', '1', pg_temp.del('00000000-0000-0000-0000-0000000000e1/orphan');
insert into res select 'the approved evidence is still there', '1', (select count(*)::text from storage.objects where name = '00000000-0000-0000-0000-0000000000e1/id-approved');
insert into res select 'anon cannot start an account deletion', 'permission denied', (select case when pg_temp.try($$set local role anon; select public.begin_account_deletion()$$) like 'permission denied%' then 'permission denied' else 'other' end);
reset role; set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000e1',false);
-- account deletion: the client first asks the server to unlock this user's files
insert into res select 'begin_account_deletion works for the signed-in user', 'ok', pg_temp.try($$select public.begin_account_deletion()$$);
insert into res select 'after unlocking, the approved file can be removed (account deletion)', '1', pg_temp.del('00000000-0000-0000-0000-0000000000e1/id-approved');
insert into res select 'after unlocking, the rejected file can be removed', '1', pg_temp.del('00000000-0000-0000-0000-0000000000e1/pro-rejected');
insert into res select 'the unlock is personal: another user''s files stay locked', '0', (select pg_temp.del('00000000-0000-0000-0000-0000000000c1/id-theirs'));
reset role;
update private.document_unlock set until = now() - interval '1 minute';
insert into storage.objects(bucket_id,name,owner_id) values ('provider-documents','00000000-0000-0000-0000-0000000000e1/late','00000000-0000-0000-0000-0000000000e1');
insert into public.provider_documents(provider_id,document_type,storage_path,status) values ('00000000-0000-0000-0000-0000000000e1','professional_document','00000000-0000-0000-0000-0000000000e1/late','rejected');
set role authenticated; select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000e1',false);
insert into res select 'an expired unlock locks the files again', '0', pg_temp.del('00000000-0000-0000-0000-0000000000e1/late');
reset role;

-- approval needs the files to exist in Storage
select set_config('request.jwt.claim.role','authenticated',false), set_config('request.jwt.claim.sub','00000000-0000-0000-0000-0000000000a1',false);
set role authenticated;
insert into res select 'approval works when both files exist', 'ok', pg_temp.try($$select public.admin_approve_provider('00000000-0000-0000-0000-0000000000e2')$$);
reset role;
select set_config('request.jwt.claim.role','service_role',false);
update public.provider_profiles set verification_status='pending' where id='00000000-0000-0000-0000-0000000000e2';
delete from storage.objects where name = '00000000-0000-0000-0000-0000000000e2/id';   -- the file vanished from Storage, the metadata still says pending
select set_config('request.jwt.claim.role','authenticated',false);
set role authenticated;
insert into res select 'approval is refused when a required file is missing from Storage', 'documents_required', pg_temp.try($$select public.admin_approve_provider('00000000-0000-0000-0000-0000000000e2')$$);
reset role;
select set_config('request.jwt.claim.role','service_role',false);
insert into res select 'the database trigger refuses it as well (service-role path)', 'documents_required', pg_temp.try($$update public.provider_profiles set verification_status='approved' where id='00000000-0000-0000-0000-0000000000e2'$$);

\echo ===== mismatches (must be empty) =====
select case_name, expect, got from res where expect <> got;
select count(*) as total_checks, count(*) filter (where expect = got) as passed from res;
rollback;
