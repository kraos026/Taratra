begin;
create extension if not exists pgtap with schema extensions;
select plan(13);
insert into auth.users(id,email) values
 ('8a000000-0000-4000-8000-000000000001','privacy-a@example.test'),
 ('8a000000-0000-4000-8000-000000000002','privacy-admin@example.test'),
 ('8b000000-0000-4000-8000-000000000001','privacy-b@example.test');
insert into public.organizations(id,name) values
 ('8a100000-0000-4000-8000-000000000001','Privacy A'),
 ('8b100000-0000-4000-8000-000000000001','Privacy B');
insert into public.organization_members(organization_id,user_id,role) values
 ('8a100000-0000-4000-8000-000000000001','8a000000-0000-4000-8000-000000000001','viewer'),
 ('8a100000-0000-4000-8000-000000000001','8a000000-0000-4000-8000-000000000002','owner'),
 ('8b100000-0000-4000-8000-000000000001','8b000000-0000-4000-8000-000000000001','owner');
set local role authenticated;
select set_config('request.jwt.claim.sub','8a000000-0000-4000-8000-000000000001',true);
select lives_ok($$insert into public.privacy_requests(id,requester_id,organization_id,kind,description) values
 ('8a200000-0000-4000-8000-000000000001','8a000000-0000-4000-8000-000000000001','8a100000-0000-4000-8000-000000000001','ACCESS','Synthetic request')$$,'viewer can create own request');
select is((select count(*)::int from public.privacy_requests),1,'requester reads own');
select throws_ok($$update public.privacy_requests set status='COMPLETED'$$,'42501',null,'requester cannot change status');
select throws_ok($$delete from public.privacy_requests$$,'42501',null,'requester cannot erase registry');
select throws_ok($$insert into public.privacy_requests(id,requester_id,organization_id,kind,description,status) values
 (gen_random_uuid(),'8a000000-0000-4000-8000-000000000001','8a100000-0000-4000-8000-000000000001','CORRECTION','Synthetic request','COMPLETED')$$,'42501',null,'cannot forge received status');
select throws_ok($$insert into public.privacy_requests(id,requester_id,organization_id,kind,description) values
 (gen_random_uuid(),'8a000000-0000-4000-8000-000000000002','8a100000-0000-4000-8000-000000000001','ACCESS','Synthetic request')$$,'42501',null,'cannot submit as another user');
select throws_ok($$insert into public.privacy_requests(id,requester_id,organization_id,kind,description) values
 (gen_random_uuid(),'8a000000-0000-4000-8000-000000000001','8b100000-0000-4000-8000-000000000001','CORRECTION','Synthetic request')$$,'42501',null,'cannot select foreign workspace');
select throws_ok($$insert into public.privacy_requests(id,requester_id,organization_id,kind,description) values
 (gen_random_uuid(),'8a000000-0000-4000-8000-000000000001','8a100000-0000-4000-8000-000000000001','ACCESS','Synthetic request')$$,'23505',null,'concurrent open duplicate prevented');
select set_config('request.jwt.claim.sub','8a000000-0000-4000-8000-000000000002',true);
select is((select count(*)::int from public.privacy_requests),0,'same-tenant owner cannot read another account request');
select set_config('request.jwt.claim.sub','8b000000-0000-4000-8000-000000000001',true);
select is((select count(*)::int from public.privacy_requests),0,'tenant B cannot read A request');
reset role;
delete from public.organization_members where user_id='8a000000-0000-4000-8000-000000000001';
set local role authenticated;
select set_config('request.jwt.claim.sub','8a000000-0000-4000-8000-000000000001',true);
select is((select count(*)::int from public.privacy_requests),1,'own existing request remains accessible after membership removal');
set local role anon;
select throws_ok($$select * from public.privacy_requests$$,'42501',null,'anonymous cannot read');
select throws_ok($$insert into public.privacy_requests(id,requester_id,organization_id,kind,description) values
 (gen_random_uuid(),'8a000000-0000-4000-8000-000000000001','8a100000-0000-4000-8000-000000000001','DELETION','Synthetic request')$$,'42501',null,'anonymous cannot create');
reset role;
select * from finish();
rollback;
