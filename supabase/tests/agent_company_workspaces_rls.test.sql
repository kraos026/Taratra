begin;
create extension if not exists pgtap with schema extensions;
select plan(20);
insert into auth.users(id,email,aud,role) values
 ('19111111-1111-4111-8111-111111111111','agent-business-owner-a@example.test','authenticated','authenticated'),
 ('19222222-2222-4222-8222-222222222222','agent-business-owner-b@example.test','authenticated','authenticated'),
 ('19333333-3333-4333-8333-333333333333','agent-business-viewer-a@example.test','authenticated','authenticated');
insert into public.organizations(id,name) values
 ('a9111111-1111-4111-8111-111111111111','Agent business A'),
 ('a9222222-2222-4222-8222-222222222222','Agent business B');
insert into public.organization_members(organization_id,user_id,role) values
 ('a9111111-1111-4111-8111-111111111111','19111111-1111-4111-8111-111111111111','owner'),
 ('a9222222-2222-4222-8222-222222222222','19222222-2222-4222-8222-222222222222','owner'),
 ('a9111111-1111-4111-8111-111111111111','19333333-3333-4333-8333-333333333333','viewer');
insert into public.companies(id,organization_id,name,status) values
 ('c9111111-1111-4111-8111-111111111111','a9111111-1111-4111-8111-111111111111','Audit A','prospect'),
 ('c9222222-2222-4222-8222-222222222222','a9222222-2222-4222-8222-222222222222','Audit B','prospect'),
 ('c9333333-3333-4333-8333-333333333333','a9111111-1111-4111-8111-111111111111','Archived A','archived');
insert into public.agent_company_workspaces(id,organization_id,created_by,name,objective,mode,agents) values
 ('d9111111-1111-4111-8111-111111111111','a9111111-1111-4111-8111-111111111111','19111111-1111-4111-8111-111111111111','Workspace A','Produce a verified report','guided','[{"name":"Coordinator","role":"Review work"}]'),
 ('d9222222-2222-4222-8222-222222222222','a9222222-2222-4222-8222-222222222222','19222222-2222-4222-8222-222222222222','Workspace B','Produce a verified report','guided','[{"name":"Coordinator","role":"Review work"}]');
set local role authenticated;
select set_config('request.jwt.claim.sub','19111111-1111-4111-8111-111111111111',true);
select is((select count(*)::int from public.agent_company_workspaces),1,'Owner sees only own organization');
select is((select count(*)::int from public.agent_company_workspaces where name='Workspace B'),0,'Other organization is hidden');
select lives_ok($$insert into public.agent_company_workspaces(id,organization_id,created_by,name,objective,mode,agents) values('d9333333-3333-4333-8333-333333333333','a9111111-1111-4111-8111-111111111111','19111111-1111-4111-8111-111111111111','Independent team','Produce a verified report','manual','[{"name":"Worker","role":"Research"}]')$$,'Owner creates an independent team');
select is((select count(*)::int from public.agent_company_workspaces),2,'Independent team persists');
select throws_ok($$insert into public.agent_company_workspaces(id,organization_id,created_by,name,objective,mode,agents) values(gen_random_uuid(),'a9222222-2222-4222-8222-222222222222','19111111-1111-4111-8111-111111111111','Wrong tenant','Produce a verified report','manual','[{"name":"Worker","role":"Research"}]')$$,'42501',null,'Cannot create in foreign tenant');
select throws_ok($$insert into public.agent_company_workspaces(id,organization_id,created_by,name,objective,mode,agents) values(gen_random_uuid(),'a9111111-1111-4111-8111-111111111111','19222222-2222-4222-8222-222222222222','Forged owner','Produce a verified report','manual','[{"name":"Worker","role":"Research"}]')$$,'42501',null,'Creator cannot be forged');
select throws_ok($$insert into public.agent_company_workspaces(id,organization_id,created_by,name,objective,mode,agents,status) values(gen_random_uuid(),'a9111111-1111-4111-8111-111111111111','19111111-1111-4111-8111-111111111111','Activated team','Produce a verified report','manual','[{"name":"Worker","role":"Research"}]','active')$$,'23514',null,'Creation cannot activate agents');
select throws_ok($$insert into public.agent_company_workspaces(id,organization_id,created_by,name,objective,mode,agents,api_budget_euro) values(gen_random_uuid(),'a9111111-1111-4111-8111-111111111111','19111111-1111-4111-8111-111111111111','Paid team','Produce a verified report','manual','[{"name":"Worker","role":"Research"}]',1)$$,'23514',null,'Nonzero API budget rejected');
select throws_ok($$insert into public.agent_company_workspaces(id,organization_id,created_by,name,objective,mode,agents) values(gen_random_uuid(),'a9111111-1111-4111-8111-111111111111','19111111-1111-4111-8111-111111111111','Too many agents','Produce a verified report','manual','[{}, {}, {}, {}]')$$,'23514',null,'Small team cap enforced');
select lives_ok($$update public.agent_company_workspaces set company_id='c9111111-1111-4111-8111-111111111111' where id='d9333333-3333-4333-8333-333333333333'$$,'Owner links own active company');
select throws_ok($$update public.agent_company_workspaces set company_id='c9222222-2222-4222-8222-222222222222' where id='d9333333-3333-4333-8333-333333333333'$$,'42501',null,'Cannot link foreign company');
select throws_ok($$update public.agent_company_workspaces set organization_id='a9222222-2222-4222-8222-222222222222'$$,'42501',null,'Tenant identity is immutable');
select throws_ok($$update public.agent_company_workspaces set agents='[]'$$,'42501',null,'No hidden agent-edit privilege');
select throws_ok($$update public.agent_company_workspaces set company_id='c9333333-3333-4333-8333-333333333333' where id='d9333333-3333-4333-8333-333333333333'$$,'42501',null,'Cannot link archived company');
select throws_ok($$delete from public.agent_company_workspaces$$,'42501',null,'No delete privilege');
select set_config('request.jwt.claim.sub','19333333-3333-4333-8333-333333333333',true);
select is((select count(*)::int from public.agent_company_workspaces),2,'Viewer can consult own workspace');
select throws_ok($$insert into public.agent_company_workspaces(id,organization_id,created_by,name,objective,mode,agents) values(gen_random_uuid(),'a9111111-1111-4111-8111-111111111111','19333333-3333-4333-8333-333333333333','Viewer team','Produce a verified report','manual','[{"name":"Worker","role":"Research"}]')$$,'42501',null,'Viewer cannot create');
update public.agent_company_workspaces set company_id=null;
select is((select count(*)::int from public.agent_company_workspaces where company_id is not null),1,'Viewer update changes no rows');
reset role;
set local role anon;
select throws_ok($$select * from public.agent_company_workspaces$$,'42501',null,'Anonymous cannot read');
reset role;
select throws_ok($$insert into public.agent_company_workspaces(id,organization_id,created_by,company_id,name,objective,mode,agents) values(gen_random_uuid(),'a9111111-1111-4111-8111-111111111111','19111111-1111-4111-8111-111111111111','c9222222-2222-4222-8222-222222222222','Wrong lineage','Produce a verified report','manual','[{"name":"Worker","role":"Research"}]')$$,'23503',null,'Composite FK defends lineage even outside RLS');
select * from finish();
rollback;
