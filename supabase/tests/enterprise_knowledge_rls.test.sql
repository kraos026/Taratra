begin;
create extension if not exists pgtap with schema extensions;
select plan(9);
insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','96000000-0000-0000-0000-000000000001','authenticated','authenticated','knowledge-editor@test.local',crypt('password',gen_salt('bf')),now(),'{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','96000000-0000-0000-0000-000000000002','authenticated','authenticated','knowledge-viewer@test.local',crypt('password',gen_salt('bf')),now(),'{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','96000000-0000-0000-0000-000000000003','authenticated','authenticated','knowledge-other@test.local',crypt('password',gen_salt('bf')),now(),'{}','{}',now(),now());
insert into public.organizations(id,name) values('96000000-0000-0000-0000-000000000011','Knowledge A'),('96000000-0000-0000-0000-000000000012','Knowledge B');
insert into public.organization_members(organization_id,user_id,role) values
('96000000-0000-0000-0000-000000000011','96000000-0000-0000-0000-000000000001','consultant'),
('96000000-0000-0000-0000-000000000011','96000000-0000-0000-0000-000000000002','viewer'),
('96000000-0000-0000-0000-000000000012','96000000-0000-0000-0000-000000000003','owner');
insert into public.companies(id,organization_id,name) values
('96000000-0000-0000-0000-000000000021','96000000-0000-0000-0000-000000000011','Company A'),
('96000000-0000-0000-0000-000000000022','96000000-0000-0000-0000-000000000012','Company B');
set local role authenticated;
select set_config('request.jwt.claim.sub','96000000-0000-0000-0000-000000000001',true);
select lives_ok($$insert into public.knowledge_snapshots(id,organization_id,company_id,version,created_by) values('96000000-0000-0000-0000-000000000031','96000000-0000-0000-0000-000000000011','96000000-0000-0000-0000-000000000021',1,'96000000-0000-0000-0000-000000000001')$$,'editor creates own building snapshot');
select lives_ok($$insert into public.knowledge_sources(id,organization_id,snapshot_id,source_type,source_id,source_version) values('96000000-0000-0000-0000-000000000041','96000000-0000-0000-0000-000000000011','96000000-0000-0000-0000-000000000031','discovery','96000000-0000-0000-0000-000000000051',1)$$,'source preserves provenance');
select lives_ok($$insert into public.knowledge_facts(id,organization_id,snapshot_id,fact_key,domain,value_json,value_type,confidence_percentage) values('96000000-0000-0000-0000-000000000061','96000000-0000-0000-0000-000000000011','96000000-0000-0000-0000-000000000031','company.industry','company','"Restaurant"','string',100)$$,'fact is normalized in building snapshot');
select lives_ok($$insert into public.knowledge_evidence(organization_id,snapshot_id,fact_id,source_id,source_record_type,source_record_id,evidence_type,confidence_percentage) values('96000000-0000-0000-0000-000000000011','96000000-0000-0000-0000-000000000031','96000000-0000-0000-0000-000000000061','96000000-0000-0000-0000-000000000041','company_profile','96000000-0000-0000-0000-000000000021','validated_entity',100)$$,'fact links to evidence and source');
select lives_ok($$update public.knowledge_snapshots set status='ready',generated_at=now() where id='96000000-0000-0000-0000-000000000031'$$,'building snapshot becomes ready');
select throws_like($$update public.knowledge_facts set value_json='"Changed"' where id='96000000-0000-0000-0000-000000000061'$$,'%immutable%','ready facts are immutable');
select is((select count(*)::int from public.knowledge_snapshots where organization_id='96000000-0000-0000-0000-000000000012'),0,'other tenant snapshots are invisible');
select throws_like($$insert into public.knowledge_snapshots(organization_id,company_id,version,created_by) values('96000000-0000-0000-0000-000000000012','96000000-0000-0000-0000-000000000022',1,'96000000-0000-0000-0000-000000000001')$$,'%row-level security%','editor cannot create cross tenant');
reset role; set local role authenticated;
select set_config('request.jwt.claim.sub','96000000-0000-0000-0000-000000000002',true);
select throws_like($$insert into public.knowledge_snapshots(organization_id,company_id,version,created_by) values('96000000-0000-0000-0000-000000000011','96000000-0000-0000-0000-000000000021',2,'96000000-0000-0000-0000-000000000002')$$,'%row-level security%','viewer cannot create snapshots');
select * from finish();
rollback;
