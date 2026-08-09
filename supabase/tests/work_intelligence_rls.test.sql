begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','97000000-0000-4000-8000-000000000001','authenticated','authenticated','wi-editor@test.local',crypt('password',gen_salt('bf')),now(),'{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','97000000-0000-4000-8000-000000000002','authenticated','authenticated','wi-viewer@test.local',crypt('password',gen_salt('bf')),now(),'{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','97000000-0000-4000-8000-000000000003','authenticated','authenticated','wi-other@test.local',crypt('password',gen_salt('bf')),now(),'{}','{}',now(),now());

insert into public.organizations(id,name) values
('97000000-0000-4000-8000-000000000011','WI A'),
('97000000-0000-4000-8000-000000000012','WI B');
insert into public.organization_members(organization_id,user_id,role) values
('97000000-0000-4000-8000-000000000011','97000000-0000-4000-8000-000000000001','admin'),
('97000000-0000-4000-8000-000000000011','97000000-0000-4000-8000-000000000002','viewer'),
('97000000-0000-4000-8000-000000000012','97000000-0000-4000-8000-000000000003','owner');
insert into public.companies(id,organization_id,name) values
('97000000-0000-4000-8000-000000000021','97000000-0000-4000-8000-000000000011','Company A'),
('97000000-0000-4000-8000-000000000022','97000000-0000-4000-8000-000000000012','Company B');

set local role authenticated;
select set_config('request.jwt.claim.sub','97000000-0000-4000-8000-000000000001',true);

select lives_ok($$insert into public.work_intelligence_retention_policies(
id,organization_id,policy_key,version,status,pending_mode,pending_duration_days,pending_disposition,
confirmed_mode,confirmed_duration_days,confirmed_disposition,superseded_mode,superseded_duration_days,
superseded_disposition,metadata_sanitization_policy_version,created_by,published_at
) values(
'97000000-0000-4000-8000-000000000031','97000000-0000-4000-8000-000000000011','default',1,'published',
'finite',30,'anonymize','indefinite',null,'anonymize','finite',365,'anonymize','metadata-v1',
'97000000-0000-4000-8000-000000000001',now()
)$$,'admin creates configurable retention policy');

select lives_ok($$insert into public.work_activities(
id,organization_id,company_id,lineage_id,version,confirmation_state,evidence_kind,source,actor_role,activity_type,
original_description,normalized_activity,category,tools_json,started_at,ended_at,duration_minutes,confidence,
recurrence_hints_json,human_judgment,operational_risk,metadata_json,provenance_json,retention_policy_id,retention_policy_version
) values(
'97000000-0000-4000-8000-000000000041','97000000-0000-4000-8000-000000000011','97000000-0000-4000-8000-000000000021',
'97000000-0000-4000-8000-000000000051',1,'CONFIRMED','OBSERVED','MANUAL','operations','WORK',
'Prepare report','PREPARE_REPORT','Reporting','["spreadsheet"]',now(),now()+interval '30 minutes',30,100,
'[]',20,30,'{"source":"fixture"}','["capture"]','97000000-0000-4000-8000-000000000031',1
)$$,'editor creates same tenant work activity');

select is((select count(*)::int from public.work_activities),1,'same tenant can read work activity');

select throws_like($$insert into public.work_activities(
id,organization_id,company_id,lineage_id,version,confirmation_state,evidence_kind,source,actor_role,activity_type,
original_description,normalized_activity,category,tools_json,started_at,ended_at,duration_minutes,confidence,
recurrence_hints_json,human_judgment,operational_risk,metadata_json,provenance_json,retention_policy_id,retention_policy_version
) values(
'97000000-0000-4000-8000-000000000042','97000000-0000-4000-8000-000000000012','97000000-0000-4000-8000-000000000022',
'97000000-0000-4000-8000-000000000052',1,'CONFIRMED','OBSERVED','MANUAL','operations','WORK',
'Prepare report','PREPARE_REPORT','Reporting','[]',now(),now()+interval '30 minutes',30,100,
'[]',20,30,'{}','["capture"]','97000000-0000-4000-8000-000000000031',1
)$$,'%row-level security%','cross tenant write is blocked');

select throws_like($$update public.work_activities set category='Changed' where id='97000000-0000-4000-8000-000000000041'$$,'%immutable%','activity version is immutable');

reset role; set local role anon;
select set_config('request.jwt.claim.sub','',true);
select throws_like($$select count(*)::int from public.work_activities$$,'%permission denied%','anonymous cannot read work activities');

reset role; set local role authenticated;
select set_config('request.jwt.claim.sub','97000000-0000-4000-8000-000000000002',true);
select throws_like($$insert into public.work_activities(
id,organization_id,company_id,lineage_id,version,confirmation_state,evidence_kind,source,actor_role,activity_type,
original_description,normalized_activity,category,tools_json,started_at,ended_at,duration_minutes,confidence,
recurrence_hints_json,human_judgment,operational_risk,metadata_json,provenance_json,retention_policy_id,retention_policy_version
) values(
'97000000-0000-4000-8000-000000000043','97000000-0000-4000-8000-000000000011','97000000-0000-4000-8000-000000000021',
'97000000-0000-4000-8000-000000000053',1,'CONFIRMED','OBSERVED','MANUAL','operations','WORK',
'Prepare report','PREPARE_REPORT','Reporting','[]',now(),now()+interval '30 minutes',30,100,
'[]',20,30,'{}','["capture"]','97000000-0000-4000-8000-000000000031',1
)$$,'%row-level security%','viewer cannot create work activity');

reset role; set local role authenticated;
select set_config('request.jwt.claim.sub','97000000-0000-4000-8000-000000000001',true);
insert into public.knowledge_snapshots(id,organization_id,company_id,version,created_by,status,generated_at)
values('97000000-0000-4000-8000-000000000061','97000000-0000-4000-8000-000000000011','97000000-0000-4000-8000-000000000021',1,'97000000-0000-4000-8000-000000000001','building',now());
insert into public.knowledge_sources(id,organization_id,snapshot_id,source_type,source_id,source_version)
values('97000000-0000-4000-8000-000000000062','97000000-0000-4000-8000-000000000011','97000000-0000-4000-8000-000000000061','work_intelligence','97000000-0000-4000-8000-000000000051',1);
insert into public.knowledge_facts(id,organization_id,snapshot_id,fact_key,domain,value_json,value_type,confidence_percentage)
values('97000000-0000-4000-8000-000000000063','97000000-0000-4000-8000-000000000011','97000000-0000-4000-8000-000000000061','work_activity.test','operations','"PREPARE_REPORT"','string',100);
insert into public.knowledge_evidence(organization_id,snapshot_id,fact_id,source_id,source_record_type,source_record_id,evidence_type,confidence_percentage)
values('97000000-0000-4000-8000-000000000011','97000000-0000-4000-8000-000000000061','97000000-0000-4000-8000-000000000063','97000000-0000-4000-8000-000000000062','work_activity_version','97000000-0000-4000-8000-000000000041','confirmed_work_activity',100);
update public.knowledge_snapshots set status='ready' where id='97000000-0000-4000-8000-000000000061';

select throws_like($$delete from public.work_activities where id='97000000-0000-4000-8000-000000000041'$$,'%cannot be deleted%','referenced ready knowledge evidence cannot be deleted');
select ok(exists(select 1 from pg_policies where tablename='work_activities' and policyname='members read work activities'),'work activities RLS policy exists');
select ok(exists(select 1 from pg_policies where tablename='work_intelligence_retention_policies' and policyname='admins manage work intelligence retention policies'),'retention policy RLS exists');

select * from finish();
rollback;
