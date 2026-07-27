begin;
create extension if not exists pgtap with schema extensions;
select plan(26);

select has_table('public','automation_specification_rule_catalog','rule catalog exists');
select has_table('public','automation_specifications','specifications exist');
select has_table('public','automation_specification_elements','elements exist');
select has_table('public','automation_specification_provenance','provenance exists');
select has_table('public','automation_specification_validations','validations exist');
select is((select count(*)::integer from public.automation_specification_rule_catalog where status='published'),16,'sixteen published rules');
select is((select count(*)::integer from public.automation_specification_rule_catalog where status='published' and rule_type='transformation'),9,'nine transformation decisions');
select is((select count(*)::integer from public.automation_specification_rule_catalog where status='published' and rule_type='validation'),7,'seven validation decisions');
select is((select relrowsecurity from pg_class where oid='public.automation_specification_rule_catalog'::regclass),true,'catalog RLS enabled');
select is((select relrowsecurity from pg_class where oid='public.automation_specifications'::regclass),true,'specification RLS enabled');
select is((select relrowsecurity from pg_class where oid='public.automation_specification_elements'::regclass),true,'element RLS enabled');
select is((select relrowsecurity from pg_class where oid='public.automation_specification_provenance'::regclass),true,'provenance RLS enabled');
select is((select relrowsecurity from pg_class where oid='public.automation_specification_validations'::regclass),true,'validation RLS enabled');
select has_trigger('public','automation_specifications','automation_specifications_immutable','database lifecycle trigger exists');
select has_trigger('public','automation_specification_rule_catalog','automation_specification_catalog_immutable','published catalog immutability trigger exists');
select is((select count(*)::integer from pg_constraint where conrelid='public.automation_specifications'::regclass and contype='f' and pg_get_constraintdef(oid) like 'FOREIGN KEY (solution_blueprint_id, organization_id)%'),1,'Blueprint source has composite tenant FK');
select is((select count(*)::integer from pg_constraint where conrelid='public.automation_specifications'::regclass and contype='f' and pg_get_constraintdef(oid) like 'FOREIGN KEY (previous_version_id, organization_id)%'),1,'previous version has composite tenant FK');
select is((select count(*)::integer from pg_constraint where conrelid='public.automation_specification_elements'::regclass and contype='f' and pg_get_constraintdef(oid) like 'FOREIGN KEY (automation_specification_id, organization_id)%'),1,'elements have composite tenant FK');
select is((select count(*)::integer from pg_constraint where conrelid='public.automation_specification_provenance'::regclass and contype='f' and pg_get_constraintdef(oid) like 'FOREIGN KEY (automation_specification_id, organization_id)%'),1,'provenance has composite tenant FK');
select is((select count(*)::integer from pg_constraint where conrelid='public.automation_specification_validations'::regclass and contype='f' and pg_get_constraintdef(oid) like 'FOREIGN KEY (automation_specification_id, organization_id)%'),1,'validations have composite tenant FK');
select is((select count(*)::integer from public.automation_specification_rule_catalog where jsonb_typeof(condition_json)='object' and jsonb_typeof(result_json)='object'),16,'catalog decisions are data objects');
select throws_like(
 $$insert into public.automation_specifications(organization_id,solution_blueprint_id,solution_blueprint_version_number,version_number,name,objective,scope,source_fingerprint,catalog_versions_json,created_by)
 values(gen_random_uuid(),gen_random_uuid(),1,1,'x','x','x','x','[]',gen_random_uuid())$$,
 '%application transaction%',
 'direct specification generation is rejected'
);
select throws_like(
 $$update public.automation_specification_rule_catalog set description='changed' where code='project_steps'$$,
 '%immutable%',
 'published catalog rule is immutable'
);

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','98000000-0000-0000-0000-000000000001','authenticated','authenticated','spec-viewer@test.local',crypt('password',gen_salt('bf')),now(),'{}','{}',now(),now());
insert into public.organizations(id,name) values
('98000000-0000-0000-0000-000000000011','Specification A'),
('98000000-0000-0000-0000-000000000012','Specification B');
insert into public.organization_members(organization_id,user_id,role) values
('98000000-0000-0000-0000-000000000011','98000000-0000-0000-0000-000000000001','viewer');
insert into public.automation_specification_rule_catalog
(organization_id,code,version,status,rule_type,result_json,description)
values
('98000000-0000-0000-0000-000000000011','tenant_a_rule',1,'draft','transformation','{"decision":"project_steps"}','Tenant A'),
('98000000-0000-0000-0000-000000000012','tenant_b_rule',1,'draft','transformation','{"decision":"project_steps"}','Tenant B');

set local role authenticated;
select set_config('request.jwt.claim.sub','98000000-0000-0000-0000-000000000001',true);
select is((select count(*)::integer from public.automation_specification_rule_catalog where code='tenant_a_rule'),1,'viewer reads own tenant catalog');
select is((select count(*)::integer from public.automation_specification_rule_catalog where code='tenant_b_rule'),0,'viewer cannot read another tenant catalog');
select throws_like(
 $$insert into public.automation_specification_rule_catalog(organization_id,code,version,status,rule_type,result_json,description)
 values('98000000-0000-0000-0000-000000000011','viewer_rule',1,'draft','transformation','{"decision":"project_steps"}','Forbidden')$$,
 '%row-level security%',
 'viewer cannot write tenant catalog'
);

select * from finish();
rollback;
