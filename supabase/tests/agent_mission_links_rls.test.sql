begin;
create extension if not exists pgtap with schema extensions;
select plan(12);
insert into auth.users(id,email,aud,role) values
 ('18111111-1111-4111-8111-111111111111','agent-owner-a@example.test','authenticated','authenticated'),
 ('18222222-2222-4222-8222-222222222222','agent-owner-b@example.test','authenticated','authenticated'),
 ('18333333-3333-4333-8333-333333333333','agent-viewer-a@example.test','authenticated','authenticated');
insert into public.organizations(id,name) values
 ('a8111111-1111-4111-8111-111111111111','Agent registry A'),
 ('a8222222-2222-4222-8222-222222222222','Agent registry B');
insert into public.organization_members(organization_id,user_id,role) values
 ('a8111111-1111-4111-8111-111111111111','18111111-1111-4111-8111-111111111111','owner'),
 ('a8222222-2222-4222-8222-222222222222','18222222-2222-4222-8222-222222222222','owner'),
 ('a8111111-1111-4111-8111-111111111111','18333333-3333-4333-8333-333333333333','viewer');
insert into public.companies(id,organization_id,name) values
 ('c8111111-1111-4111-8111-111111111111','a8111111-1111-4111-8111-111111111111','Mission company A'),
 ('c8222222-2222-4222-8222-222222222222','a8222222-2222-4222-8222-222222222222','Mission company B');
insert into public.agent_mission_links(organization_id,company_id,run_id,title) values
 ('a8111111-1111-4111-8111-111111111111','c8111111-1111-4111-8111-111111111111','run_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','Mission A'),
 ('a8222222-2222-4222-8222-222222222222','c8222222-2222-4222-8222-222222222222','run_bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb','Mission B');
set local role authenticated;
select set_config('request.jwt.claim.sub','18111111-1111-4111-8111-111111111111',true);
select is((select count(*)::int from public.agent_mission_links),1,'Owner A reads only own links');
select is((select count(*)::int from public.agent_mission_links where title='Mission B'),0,'Owner A cannot read B');
select throws_ok($$insert into public.agent_mission_links(organization_id,company_id,run_id,title) values ('a8111111-1111-4111-8111-111111111111','c8111111-1111-4111-8111-111111111111','run_cccccccccccccccccccccccccccccccc','Claimed run')$$,'42501',null,'Client owner cannot claim arbitrary run');
select throws_ok($$update public.agent_mission_links set title='Changed'$$,'42501',null,'Client cannot update links');
select throws_ok($$delete from public.agent_mission_links$$,'42501',null,'Client cannot delete links');
select set_config('request.jwt.claim.sub','18222222-2222-4222-8222-222222222222',true);
select is((select count(*)::int from public.agent_mission_links),1,'Owner B reads only own links');
select is((select count(*)::int from public.agent_mission_links where title='Mission A'),0,'Owner B cannot read A');
select set_config('request.jwt.claim.sub','18333333-3333-4333-8333-333333333333',true);
select is((select count(*)::int from public.agent_mission_links),1,'Viewer A can consult links');
reset role;
set local role anon;
select throws_ok($$select * from public.agent_mission_links$$,'42501',null,'Anonymous cannot read registry');
reset role;
select throws_ok($$insert into public.agent_mission_links(organization_id,company_id,run_id,title) values ('a8222222-2222-4222-8222-222222222222','c8111111-1111-4111-8111-111111111111','run_dddddddddddddddddddddddddddddddd','Wrong lineage')$$,'23503',null,'Composite FK rejects foreign organization');
select throws_ok($$insert into public.agent_mission_links(organization_id,company_id,run_id,title) values ('a8222222-2222-4222-8222-222222222222','c8222222-2222-4222-8222-222222222222','run_aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa','Duplicate run')$$,'23505',null,'A run can belong to only one company');
update public.companies set status='archived' where id='c8111111-1111-4111-8111-111111111111';
set local role authenticated;
select set_config('request.jwt.claim.sub','18111111-1111-4111-8111-111111111111',true);
select is((select count(*)::int from public.agent_mission_links),0,'Archived company links are hidden');
reset role;
select * from finish();
rollback;
