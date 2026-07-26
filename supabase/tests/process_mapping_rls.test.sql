begin;
create extension if not exists pgtap with schema extensions;
select plan(9);
insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','97000000-0000-0000-0000-000000000001','authenticated','authenticated','process-consultant@test.local',crypt('password',gen_salt('bf')),now(),'{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','97000000-0000-0000-0000-000000000002','authenticated','authenticated','process-viewer@test.local',crypt('password',gen_salt('bf')),now(),'{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','97000000-0000-0000-0000-000000000003','authenticated','authenticated','process-owner@test.local',crypt('password',gen_salt('bf')),now(),'{}','{}',now(),now());
insert into public.organizations(id,name) values('97000000-0000-0000-0000-000000000011','Process A'),('97000000-0000-0000-0000-000000000012','Process B');
insert into public.organization_members(organization_id,user_id,role) values
('97000000-0000-0000-0000-000000000011','97000000-0000-0000-0000-000000000001','consultant'),
('97000000-0000-0000-0000-000000000011','97000000-0000-0000-0000-000000000002','viewer'),
('97000000-0000-0000-0000-000000000012','97000000-0000-0000-0000-000000000003','owner');
insert into public.companies(id,organization_id,name) values
('97000000-0000-0000-0000-000000000021','97000000-0000-0000-0000-000000000011','Company A'),
('97000000-0000-0000-0000-000000000022','97000000-0000-0000-0000-000000000012','Company B');
insert into public.knowledge_snapshots(id,organization_id,company_id,version,status,created_by,generated_at) values
('97000000-0000-0000-0000-000000000031','97000000-0000-0000-0000-000000000011','97000000-0000-0000-0000-000000000021',1,'ready','97000000-0000-0000-0000-000000000001',now()),
('97000000-0000-0000-0000-000000000032','97000000-0000-0000-0000-000000000012','97000000-0000-0000-0000-000000000022',1,'ready','97000000-0000-0000-0000-000000000003',now());
set local role authenticated;
select set_config('request.jwt.claim.sub','97000000-0000-0000-0000-000000000001',true);
select is((select count(*)::int from public.process_patterns),5,'five published system patterns are readable');
select lives_ok($$insert into public.process_maps(id,organization_id,company_id,knowledge_snapshot_id,process_pattern_id,process_pattern_version,version_number,name,graph_json,provenance_json,completeness_percentage,confidence_percentage,coverage_percentage,created_by)
select '97000000-0000-0000-0000-000000000041','97000000-0000-0000-0000-000000000011','97000000-0000-0000-0000-000000000021','97000000-0000-0000-0000-000000000031',id,version,1,name,'{"nodes":[],"edges":[]}','{"consumed":[],"ignored":[]}',0,0,0,'97000000-0000-0000-0000-000000000001' from public.process_patterns where code='invoice_processing'$$,'consultant builds own draft');
select lives_ok($$insert into public.process_map_nodes(id,organization_id,process_map_id,node_key,node_type,name) values('97000000-0000-0000-0000-000000000051','97000000-0000-0000-0000-000000000011','97000000-0000-0000-0000-000000000041','receive','step','Receive')$$,'consultant stores normalized graph');
select is((select count(*)::int from public.process_maps where organization_id='97000000-0000-0000-0000-000000000012'),0,'other tenant maps are invisible');
select throws_like($$insert into public.process_maps(organization_id,company_id,knowledge_snapshot_id,process_pattern_id,process_pattern_version,version_number,name,graph_json,provenance_json,completeness_percentage,confidence_percentage,coverage_percentage,created_by)
select '97000000-0000-0000-0000-000000000012','97000000-0000-0000-0000-000000000022','97000000-0000-0000-0000-000000000032',id,version,1,name,'{}','{}',0,0,0,'97000000-0000-0000-0000-000000000001' from public.process_patterns where code='invoice_processing'$$,'%row-level security%','consultant cannot build cross tenant');
select lives_ok($$update public.process_maps set status='validated' where id='97000000-0000-0000-0000-000000000041'$$,'consultant validates own map');
select throws_like($$update public.process_maps set status='published' where id='97000000-0000-0000-0000-000000000041'$$,'%row-level security%','consultant cannot publish');
reset role;set local role authenticated;
select set_config('request.jwt.claim.sub','97000000-0000-0000-0000-000000000002',true);
select is((select count(*)::int from public.process_maps),1,'viewer reads own process history');
select results_eq($$with changed as(update public.process_maps set name='Changed' returning 1)select count(*)::int from changed$$,array[0],'viewer cannot modify maps');
select * from finish();rollback;
