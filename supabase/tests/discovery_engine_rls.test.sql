begin;create extension if not exists pgtap with schema extensions;select plan(9);
insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','94000000-0000-0000-0000-000000000001','authenticated','authenticated','discovery-editor@test.local',crypt('password',gen_salt('bf')),now(),'{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','94000000-0000-0000-0000-000000000002','authenticated','authenticated','discovery-viewer@test.local',crypt('password',gen_salt('bf')),now(),'{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','94000000-0000-0000-0000-000000000003','authenticated','authenticated','discovery-other@test.local',crypt('password',gen_salt('bf')),now(),'{}','{}',now(),now());
insert into public.organizations(id,name)values('94000000-0000-0000-0000-000000000011','Discovery A'),('94000000-0000-0000-0000-000000000012','Discovery B');
insert into public.organization_members(organization_id,user_id,role)values('94000000-0000-0000-0000-000000000011','94000000-0000-0000-0000-000000000001','consultant'),('94000000-0000-0000-0000-000000000011','94000000-0000-0000-0000-000000000002','viewer'),('94000000-0000-0000-0000-000000000012','94000000-0000-0000-0000-000000000003','owner');
insert into public.companies(id,organization_id,name)values('94000000-0000-0000-0000-000000000021','94000000-0000-0000-0000-000000000011','Company A'),('94000000-0000-0000-0000-000000000022','94000000-0000-0000-0000-000000000012','Company B');
set local role authenticated;select set_config('request.jwt.claim.sub','94000000-0000-0000-0000-000000000001',true);
select lives_ok($$insert into public.discovery_sessions(id,organization_id,company_id,started_by)values('94000000-0000-0000-0000-000000000031','94000000-0000-0000-0000-000000000011','94000000-0000-0000-0000-000000000021','94000000-0000-0000-0000-000000000001')$$,'editor creates own session');
select lives_ok($$insert into public.discovery_answers(organization_id,discovery_session_id,step,field_key,value_json,answered_by)values('94000000-0000-0000-0000-000000000011','94000000-0000-0000-0000-000000000031','company','discovery.company','{"industry":"services"}','94000000-0000-0000-0000-000000000001')$$,'editor autosaves own answer');
select is((select count(*)::int from public.discovery_sessions where organization_id='94000000-0000-0000-0000-000000000012'),0,'other tenant sessions are invisible');
select throws_like($$insert into public.discovery_sessions(organization_id,company_id,started_by)values('94000000-0000-0000-0000-000000000012','94000000-0000-0000-0000-000000000022','94000000-0000-0000-0000-000000000001')$$,'%row-level security%','editor cannot create cross tenant');
select is((select count(*)::int from public.software_categories where organization_id is null),8,'system software categories are readable');
select is((select count(*)::int from public.process_categories where organization_id is null),8,'system process categories are readable');
reset role;set local role authenticated;select set_config('request.jwt.claim.sub','94000000-0000-0000-0000-000000000002',true);
select is((select count(*)::int from public.discovery_sessions),1,'viewer reads own discovery');
select results_eq($$with changed as(update public.discovery_sessions set current_step='business' returning 1)select count(*)::int from changed$$,array[0],'viewer cannot update discovery');
select results_eq($$with removed as(delete from public.discovery_answers returning 1)select count(*)::int from removed$$,array[0],'viewer cannot delete answers');
select * from finish();rollback;
