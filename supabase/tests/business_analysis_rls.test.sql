begin;
create extension if not exists pgtap with schema extensions;
select plan(9);
insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','98000000-0000-0000-0000-000000000001','authenticated','authenticated','analysis-consultant@test.local',crypt('password',gen_salt('bf')),now(),'{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','98000000-0000-0000-0000-000000000002','authenticated','authenticated','analysis-viewer@test.local',crypt('password',gen_salt('bf')),now(),'{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','98000000-0000-0000-0000-000000000003','authenticated','authenticated','analysis-owner-a@test.local',crypt('password',gen_salt('bf')),now(),'{}','{}',now(),now());
insert into public.organizations(id,name) values('98000000-0000-0000-0000-000000000011','Analysis A'),('98000000-0000-0000-0000-000000000012','Analysis B');
insert into public.organization_members(organization_id,user_id,role) values
('98000000-0000-0000-0000-000000000011','98000000-0000-0000-0000-000000000001','consultant'),
('98000000-0000-0000-0000-000000000011','98000000-0000-0000-0000-000000000002','viewer'),
('98000000-0000-0000-0000-000000000011','98000000-0000-0000-0000-000000000003','owner');
insert into public.companies(id,organization_id,name) values('98000000-0000-0000-0000-000000000021','98000000-0000-0000-0000-000000000011','Company A'),('98000000-0000-0000-0000-000000000022','98000000-0000-0000-0000-000000000012','Company B');
insert into public.knowledge_snapshots(id,organization_id,company_id,version,status,created_by,generated_at) values('98000000-0000-0000-0000-000000000031','98000000-0000-0000-0000-000000000011','98000000-0000-0000-0000-000000000021',1,'ready','98000000-0000-0000-0000-000000000003',now());
insert into public.process_maps(id,organization_id,company_id,knowledge_snapshot_id,process_pattern_id,process_pattern_version,version_number,status,name,graph_json,provenance_json,completeness_percentage,confidence_percentage,coverage_percentage,created_by,published_at)
select '98000000-0000-0000-0000-000000000041','98000000-0000-0000-0000-000000000011','98000000-0000-0000-0000-000000000021','98000000-0000-0000-0000-000000000031',id,version,1,'published',name,'{"nodes":[],"edges":[]}','{}',100,100,100,'98000000-0000-0000-0000-000000000003',now() from public.process_patterns where code='invoice_processing';
set local role authenticated;
select set_config('request.jwt.claim.sub','98000000-0000-0000-0000-000000000001',true);
select is((select count(*)::int from public.analysis_rule_catalog),19,'19 system rules are readable');
select lives_ok($$insert into public.analysis_snapshots(id,organization_id,company_id,process_map_id,knowledge_snapshot_id,version_number,ruleset_json,provenance_json,created_by) values('98000000-0000-0000-0000-000000000051','98000000-0000-0000-0000-000000000011','98000000-0000-0000-0000-000000000021','98000000-0000-0000-0000-000000000041','98000000-0000-0000-0000-000000000031',1,'[]','{}','98000000-0000-0000-0000-000000000001')$$,'consultant creates own draft');
select is((select count(*)::int from public.analysis_snapshots where organization_id='98000000-0000-0000-0000-000000000012'),0,'other tenant analyses are invisible');
select throws_like($$insert into public.analysis_snapshots(organization_id,company_id,process_map_id,knowledge_snapshot_id,version_number,ruleset_json,provenance_json,created_by) values('98000000-0000-0000-0000-000000000012','98000000-0000-0000-0000-000000000022','98000000-0000-0000-0000-000000000041','98000000-0000-0000-0000-000000000031',1,'[]','{}','98000000-0000-0000-0000-000000000001')$$,'%published Process Map%','consultant cannot create cross tenant');
select throws_like($$update public.analysis_snapshots set status='published' where id='98000000-0000-0000-0000-000000000051'$$,'%row-level security%','consultant cannot publish');
reset role; set local role authenticated;
select set_config('request.jwt.claim.sub','98000000-0000-0000-0000-000000000002',true);
select is((select count(*)::int from public.analysis_snapshots),1,'viewer reads own analysis');
select results_eq($$with changed as(update public.analysis_snapshots set status='validated' returning 1)select count(*)::int from changed$$,array[0],'viewer cannot modify');
reset role; set local role authenticated;
select set_config('request.jwt.claim.sub','98000000-0000-0000-0000-000000000003',true);
select lives_ok($$update public.analysis_snapshots set status='published' where id='98000000-0000-0000-0000-000000000051'$$,'owner publishes own analysis');
select throws_like($$update public.analysis_snapshots set provenance_json='{"changed":true}' where id='98000000-0000-0000-0000-000000000051'$$,'%immutable%','published analysis is immutable');
select * from finish();
rollback;
