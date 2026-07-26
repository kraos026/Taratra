begin;
create extension if not exists pgtap with schema extensions;
select plan(12);
insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','99000000-0000-0000-0000-000000000001','authenticated','authenticated','ai-consultant@test.local',crypt('password',gen_salt('bf')),now(),'{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','99000000-0000-0000-0000-000000000002','authenticated','authenticated','ai-viewer@test.local',crypt('password',gen_salt('bf')),now(),'{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','99000000-0000-0000-0000-000000000003','authenticated','authenticated','ai-owner@test.local',crypt('password',gen_salt('bf')),now(),'{}','{}',now(),now());
insert into public.organizations(id,name) values('99000000-0000-0000-0000-000000000011','AI A'),('99000000-0000-0000-0000-000000000012','AI B');
insert into public.organization_members(organization_id,user_id,role) values
('99000000-0000-0000-0000-000000000011','99000000-0000-0000-0000-000000000001','consultant'),
('99000000-0000-0000-0000-000000000011','99000000-0000-0000-0000-000000000002','viewer'),
('99000000-0000-0000-0000-000000000011','99000000-0000-0000-0000-000000000003','owner');
insert into public.companies(id,organization_id,name) values('99000000-0000-0000-0000-000000000021','99000000-0000-0000-0000-000000000011','Company AI');
insert into public.knowledge_snapshots(id,organization_id,company_id,version,status,created_by,generated_at) values('99000000-0000-0000-0000-000000000031','99000000-0000-0000-0000-000000000011','99000000-0000-0000-0000-000000000021',1,'ready','99000000-0000-0000-0000-000000000003',now());
insert into public.process_maps(id,organization_id,company_id,knowledge_snapshot_id,process_pattern_id,process_pattern_version,version_number,status,name,graph_json,provenance_json,completeness_percentage,confidence_percentage,coverage_percentage,created_by,published_at)
select '99000000-0000-0000-0000-000000000041','99000000-0000-0000-0000-000000000011','99000000-0000-0000-0000-000000000021','99000000-0000-0000-0000-000000000031',id,version,1,'published',name,'{"nodes":[],"edges":[]}','{}',100,100,100,'99000000-0000-0000-0000-000000000003',now() from public.process_patterns where code='invoice_processing';
insert into public.analysis_snapshots(id,organization_id,company_id,process_map_id,knowledge_snapshot_id,version_number,status,ruleset_json,provenance_json,created_by,published_at) values
('99000000-0000-0000-0000-000000000051','99000000-0000-0000-0000-000000000011','99000000-0000-0000-0000-000000000021','99000000-0000-0000-0000-000000000041','99000000-0000-0000-0000-000000000031',1,'published','[]','{}','99000000-0000-0000-0000-000000000003',now());
select throws_like($$update public.ai_capability_catalog set title='Changed' where code='ocr'$$,'%immutable%','published capability version is immutable');
set local role authenticated;
select set_config('request.jwt.claim.sub','99000000-0000-0000-0000-000000000001',true);
select is((select count(*)::int from public.ai_capability_catalog),19,'19 capabilities are readable');
select is((select count(*)::int from public.ai_detection_rule_catalog),14,'14 detection rules are readable');
select is((select count(*)::int from public.ai_score_definition_catalog),6,'6 score definitions are readable');
select lives_ok($$insert into public.ai_opportunity_snapshots(id,organization_id,company_id,business_analysis_id,process_map_id,knowledge_snapshot_id,version_number,catalog_versions_json,provenance_json,created_by) values('99000000-0000-0000-0000-000000000061','99000000-0000-0000-0000-000000000011','99000000-0000-0000-0000-000000000021','99000000-0000-0000-0000-000000000051','99000000-0000-0000-0000-000000000041','99000000-0000-0000-0000-000000000031',1,'{}','{}','99000000-0000-0000-0000-000000000001')$$,'consultant creates own draft');
select is((select count(*)::int from public.ai_opportunity_snapshots where organization_id='99000000-0000-0000-0000-000000000012'),0,'other tenant snapshots are invisible');
select throws_like($$insert into public.ai_opportunity_snapshots(organization_id,company_id,business_analysis_id,process_map_id,knowledge_snapshot_id,version_number,catalog_versions_json,provenance_json,created_by) values('99000000-0000-0000-0000-000000000012','99000000-0000-0000-0000-000000000021','99000000-0000-0000-0000-000000000051','99000000-0000-0000-0000-000000000041','99000000-0000-0000-0000-000000000031',1,'{}','{}','99000000-0000-0000-0000-000000000001')$$,'%published Analysis%','consultant cannot create cross tenant');
select throws_like($$update public.ai_opportunity_snapshots set status='published' where id='99000000-0000-0000-0000-000000000061'$$,'%row-level security%','consultant cannot publish');
reset role; set local role authenticated;
select set_config('request.jwt.claim.sub','99000000-0000-0000-0000-000000000002',true);
select is((select count(*)::int from public.ai_opportunity_snapshots),1,'viewer reads own snapshots');
select results_eq($$with changed as(update public.ai_opportunity_snapshots set status='validated' returning 1)select count(*)::int from changed$$,array[0],'viewer cannot modify');
reset role; set local role authenticated;
select set_config('request.jwt.claim.sub','99000000-0000-0000-0000-000000000003',true);
select lives_ok($$update public.ai_opportunity_snapshots set status='published' where id='99000000-0000-0000-0000-000000000061'$$,'owner publishes own snapshot');
select throws_like($$update public.ai_opportunity_snapshots set provenance_json='{"changed":true}' where id='99000000-0000-0000-0000-000000000061'$$,'%immutable%','published snapshot is immutable');
select * from finish();
rollback;
