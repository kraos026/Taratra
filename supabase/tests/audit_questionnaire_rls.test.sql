begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
select '00000000-0000-0000-0000-000000000000',id,'authenticated','authenticated',email,crypt('password',gen_salt('bf')),now(),'{}','{}',now(),now() from(values
('61000000-0000-0000-0000-000000000001'::uuid,'audit-owner-a@test.local'),
('61000000-0000-0000-0000-000000000002'::uuid,'audit-admin-a@test.local'),
('61000000-0000-0000-0000-000000000003'::uuid,'audit-consultant-a@test.local'),
('61000000-0000-0000-0000-000000000004'::uuid,'audit-viewer-a@test.local'),
('62000000-0000-0000-0000-000000000001'::uuid,'audit-owner-b@test.local'))v(id,email);
insert into public.organizations(id,name) values('6a000000-0000-0000-0000-000000000001','Audit Org A'),('6b000000-0000-0000-0000-000000000001','Audit Org B');
insert into public.organization_members(organization_id,user_id,role) values
('6a000000-0000-0000-0000-000000000001','61000000-0000-0000-0000-000000000001','owner'),
('6a000000-0000-0000-0000-000000000001','61000000-0000-0000-0000-000000000002','admin'),
('6a000000-0000-0000-0000-000000000001','61000000-0000-0000-0000-000000000003','consultant'),
('6a000000-0000-0000-0000-000000000001','61000000-0000-0000-0000-000000000004','viewer'),
('6b000000-0000-0000-0000-000000000001','62000000-0000-0000-0000-000000000001','owner');
insert into public.companies(id,organization_id,name) values('6a100000-0000-0000-0000-000000000001','6a000000-0000-0000-0000-000000000001','Audit Company A'),('6b100000-0000-0000-0000-000000000001','6b000000-0000-0000-0000-000000000001','Audit Company B');
insert into public.questionnaire_templates(id,organization_id,name,category) values('6a200000-0000-0000-0000-000000000001','6a000000-0000-0000-0000-000000000001','Custom A','test'),('6b200000-0000-0000-0000-000000000001','6b000000-0000-0000-0000-000000000001','Custom B','test');
insert into public.questionnaire_versions(id,questionnaire_template_id,version_number,status) values('6a300000-0000-0000-0000-000000000001','6a200000-0000-0000-0000-000000000001',1,'draft'),('6a300000-0000-0000-0000-000000000002','6a200000-0000-0000-0000-000000000001',2,'draft'),('6b300000-0000-0000-0000-000000000001','6b200000-0000-0000-0000-000000000001',1,'draft');
insert into public.questionnaire_sections(id,questionnaire_version_id,title,position) values('6a400000-0000-0000-0000-000000000001','6a300000-0000-0000-0000-000000000002','Section A',1),('6b400000-0000-0000-0000-000000000001','6b300000-0000-0000-0000-000000000001','Section B',1);
insert into public.questionnaire_questions(id,questionnaire_section_id,code,label,question_type,required,position) values('6a500000-0000-0000-0000-000000000001','6a400000-0000-0000-0000-000000000001','test.a','Question A','short_text',true,1),('6b500000-0000-0000-0000-000000000001','6b400000-0000-0000-0000-000000000001','test.b','Question B','short_text',true,1);
update public.questionnaire_versions set status='published',published_at=now() where id in('6a300000-0000-0000-0000-000000000002','6b300000-0000-0000-0000-000000000001');

set local role authenticated;select set_config('request.jwt.claim.sub','61000000-0000-0000-0000-000000000001',true);
select is((select count(*)::int from public.questionnaire_templates where is_system),1,'owner reads published system questionnaire');
select is((select count(*)::int from public.questionnaire_templates where organization_id='6a000000-0000-0000-0000-000000000001'),1,'owner reads custom questionnaire in own organization');
select is((select count(*)::int from public.questionnaire_templates where organization_id='6b000000-0000-0000-0000-000000000001'),0,'owner cannot read cross-tenant questionnaire');
select results_eq($$with x as(update public.questionnaire_versions set version_number=3 where id='6a300000-0000-0000-0000-000000000001' returning 1)select count(*)::int from x$$,array[1],'owner modifies own draft');
select throws_like($$update public.questionnaire_versions set version_number=4 where id='6a300000-0000-0000-0000-000000000002'$$,'%immutable%','published version is immutable');
select lives_ok($$insert into public.audits(id,organization_id,company_id,questionnaire_version_id)values('6a600000-0000-0000-0000-000000000001','6a000000-0000-0000-0000-000000000001','6a100000-0000-0000-0000-000000000001','6a300000-0000-0000-0000-000000000002')$$,'owner creates own audit');
select throws_like($$insert into public.audits(organization_id,company_id,questionnaire_version_id)values('6a000000-0000-0000-0000-000000000001','6b100000-0000-0000-0000-000000000001','6a300000-0000-0000-0000-000000000002')$$,'%company must belong%','audit cannot use cross-tenant company');
select lives_ok($$insert into public.audit_answers(organization_id,audit_id,question_id,value_json,answered_by)values('6a000000-0000-0000-0000-000000000001','6a600000-0000-0000-0000-000000000001','6a500000-0000-0000-0000-000000000001','"yes"','61000000-0000-0000-0000-000000000001')$$,'owner inserts answer');
select throws_like($$insert into public.audit_answers(organization_id,audit_id,question_id,value_json,answered_by)values('6a000000-0000-0000-0000-000000000001','6a600000-0000-0000-0000-000000000001','6b500000-0000-0000-0000-000000000001','"no"','61000000-0000-0000-0000-000000000001')$$,'%question must belong%','answer cannot use question from another version');

reset role;set local role authenticated;select set_config('request.jwt.claim.sub','61000000-0000-0000-0000-000000000003',true);
select results_eq($$with x as(update public.questionnaire_versions set version_number=5 where id='6a300000-0000-0000-0000-000000000001' returning 1)select count(*)::int from x$$,array[0],'consultant cannot modify draft version');
select lives_ok($$insert into public.audits(organization_id,company_id,questionnaire_version_id)values('6a000000-0000-0000-0000-000000000001','6a100000-0000-0000-0000-000000000001','6a300000-0000-0000-0000-000000000002')$$,'consultant creates audit in own organization');

reset role;set local role authenticated;select set_config('request.jwt.claim.sub','61000000-0000-0000-0000-000000000004',true);
select results_eq($$with x as(update public.questionnaire_versions set version_number=6 where id='6a300000-0000-0000-0000-000000000001' returning 1)select count(*)::int from x$$,array[0],'viewer cannot modify draft version');
select throws_like($$insert into public.audit_answers(organization_id,audit_id,question_id,value_json,answered_by)values('6a000000-0000-0000-0000-000000000001','6a600000-0000-0000-0000-000000000001','6a500000-0000-0000-0000-000000000001','"viewer"','61000000-0000-0000-0000-000000000004')$$,'%row-level security%','viewer cannot insert answers');

reset role;set local role authenticated;select set_config('request.jwt.claim.sub','61000000-0000-0000-0000-000000000003',true);
select throws_like($$update public.audits set status='validated' where id='6a600000-0000-0000-0000-000000000001'$$,'%Only owners and admins%','consultant cannot validate audit');
reset role;set local role authenticated;select set_config('request.jwt.claim.sub','61000000-0000-0000-0000-000000000002',true);
select lives_ok($$update public.audits set status='validated' where id='6a600000-0000-0000-0000-000000000001'$$,'admin validates audit');
select * from finish();rollback;
