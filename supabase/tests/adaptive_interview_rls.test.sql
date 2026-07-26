begin;
create extension if not exists pgtap with schema extensions;
select plan(8);
insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','95000000-0000-0000-0000-000000000001','authenticated','authenticated','interview-editor@test.local',crypt('password',gen_salt('bf')),now(),'{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','95000000-0000-0000-0000-000000000002','authenticated','authenticated','interview-viewer@test.local',crypt('password',gen_salt('bf')),now(),'{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','95000000-0000-0000-0000-000000000003','authenticated','authenticated','interview-other@test.local',crypt('password',gen_salt('bf')),now(),'{}','{}',now(),now());
insert into public.organizations(id,name) values('95000000-0000-0000-0000-000000000011','Interview A'),('95000000-0000-0000-0000-000000000012','Interview B');
insert into public.organization_members(organization_id,user_id,role) values
('95000000-0000-0000-0000-000000000011','95000000-0000-0000-0000-000000000001','consultant'),
('95000000-0000-0000-0000-000000000011','95000000-0000-0000-0000-000000000002','viewer'),
('95000000-0000-0000-0000-000000000012','95000000-0000-0000-0000-000000000003','owner');
insert into public.companies(id,organization_id,name) values
('95000000-0000-0000-0000-000000000021','95000000-0000-0000-0000-000000000011','Company A'),
('95000000-0000-0000-0000-000000000022','95000000-0000-0000-0000-000000000012','Company B');
insert into public.discovery_sessions(id,organization_id,company_id,status,started_by,validated_at,validated_by) values
('95000000-0000-0000-0000-000000000031','95000000-0000-0000-0000-000000000011','95000000-0000-0000-0000-000000000021','validated','95000000-0000-0000-0000-000000000001',now(),'95000000-0000-0000-0000-000000000001'),
('95000000-0000-0000-0000-000000000032','95000000-0000-0000-0000-000000000012','95000000-0000-0000-0000-000000000022','validated','95000000-0000-0000-0000-000000000003',now(),'95000000-0000-0000-0000-000000000003');
set local role authenticated;
select set_config('request.jwt.claim.sub','95000000-0000-0000-0000-000000000001',true);
select is((select count(*)::int from public.interview_questions),20,'system interview catalogue is readable');
select lives_ok($$insert into public.interview_sessions(id,organization_id,company_id,discovery_session_id,started_by) values('95000000-0000-0000-0000-000000000041','95000000-0000-0000-0000-000000000011','95000000-0000-0000-0000-000000000021','95000000-0000-0000-0000-000000000031','95000000-0000-0000-0000-000000000001')$$,'consultant starts own interview');
select is((select count(*)::int from public.interview_sessions where organization_id='95000000-0000-0000-0000-000000000012'),0,'other tenant interview is invisible');
select throws_like($$insert into public.interview_sessions(organization_id,company_id,discovery_session_id,started_by) values('95000000-0000-0000-0000-000000000012','95000000-0000-0000-0000-000000000022','95000000-0000-0000-0000-000000000032','95000000-0000-0000-0000-000000000001')$$,'%row-level security%','consultant cannot create cross tenant');
select lives_ok($$insert into public.interview_answers(organization_id,interview_session_id,question_id,value_json,confidence,answered_by) select '95000000-0000-0000-0000-000000000011','95000000-0000-0000-0000-000000000041',id,'"answer"','confirmed','95000000-0000-0000-0000-000000000001' from public.interview_questions where code='company.value_proposition'$$,'consultant answers own interview');
reset role; set local role authenticated;
select set_config('request.jwt.claim.sub','95000000-0000-0000-0000-000000000002',true);
select is((select count(*)::int from public.interview_sessions),1,'viewer reads own interview');
select results_eq($$with changed as(update public.interview_sessions set status='completed' returning 1) select count(*)::int from changed$$,array[0],'viewer cannot update interview');
select results_eq($$with removed as(delete from public.interview_answers returning 1) select count(*)::int from removed$$,array[0],'viewer cannot delete answers');
select * from finish();
rollback;

