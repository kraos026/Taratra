begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at)
values ('00000000-0000-0000-0000-000000000000','71000000-0000-0000-0000-000000000001','authenticated','authenticated','hardening-viewer@test.local',crypt('password',gen_salt('bf')),now(),'{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','71000000-0000-0000-0000-000000000002','authenticated','authenticated','hardening-owner@test.local',crypt('password',gen_salt('bf')),now(),'{}','{}',now(),now());
insert into public.organizations(id,name) values ('7a000000-0000-0000-0000-000000000001','Hardening A'),('7b000000-0000-0000-0000-000000000001','Hardening B');
insert into public.organization_members(organization_id,user_id,role) values
('7a000000-0000-0000-0000-000000000001','71000000-0000-0000-0000-000000000001','viewer'),
('7a000000-0000-0000-0000-000000000001','71000000-0000-0000-0000-000000000002','owner');
insert into public.companies(id,organization_id,name) values ('7a100000-0000-0000-0000-000000000001','7a000000-0000-0000-0000-000000000001','Hardening company');
insert into public.questionnaire_templates(id,organization_id,name,category) values
('7a200000-0000-0000-0000-000000000001','7a000000-0000-0000-0000-000000000001','Custom A','test'),
('7b200000-0000-0000-0000-000000000001','7b000000-0000-0000-0000-000000000001','Custom B','test');
insert into public.questionnaire_templates(id,organization_id,name,category,is_system) values
('70000000-0000-0000-0000-000000000001',null,'System hardening','test',true);
insert into public.questionnaire_versions(id,questionnaire_template_id,version_number,status,published_at) values
('7a300000-0000-0000-0000-000000000001','7a200000-0000-0000-0000-000000000001',1,'draft',null),
('7a300000-0000-0000-0000-000000000002','7a200000-0000-0000-0000-000000000001',2,'draft',null),
('7a300000-0000-0000-0000-000000000003','7a200000-0000-0000-0000-000000000001',3,'archived',null),
('7b300000-0000-0000-0000-000000000001','7b200000-0000-0000-0000-000000000001',1,'draft',null),
('70000000-0000-0000-0000-000000000002','70000000-0000-0000-0000-000000000001',1,'published',now()),
('70000000-0000-0000-0000-000000000003','70000000-0000-0000-0000-000000000001',2,'draft',null);
insert into public.questionnaire_sections(id,questionnaire_version_id,title,position) values
('7a400000-0000-0000-0000-000000000001','7a300000-0000-0000-0000-000000000001','Published section',1),
('7a400000-0000-0000-0000-000000000002','7a300000-0000-0000-0000-000000000002','Draft section',1),
('7b400000-0000-0000-0000-000000000001','7b300000-0000-0000-0000-000000000001','Other section',1);
insert into public.questionnaire_questions(id,questionnaire_section_id,code,label,question_type,position) values
('7a500000-0000-0000-0000-000000000001','7a400000-0000-0000-0000-000000000001','published.q','Published question','short_text',1),
('7a500000-0000-0000-0000-000000000002','7a400000-0000-0000-0000-000000000002','draft.q','Draft question','short_text',1);
update public.questionnaire_versions
set status='published', published_at=now()
where id='7a300000-0000-0000-0000-000000000001';
insert into public.audits(id,organization_id,company_id,questionnaire_version_id) values
('7a600000-0000-0000-0000-000000000001','7a000000-0000-0000-0000-000000000001','7a100000-0000-0000-0000-000000000001','7a300000-0000-0000-0000-000000000001');

set local role authenticated;
select set_config('request.jwt.claim.sub','71000000-0000-0000-0000-000000000001',true);
select is((select count(*)::int from public.questionnaire_versions where id='7a300000-0000-0000-0000-000000000001'),1,'viewer reads published custom version');
select is((select count(*)::int from public.questionnaire_versions where id='7a300000-0000-0000-0000-000000000002'),0,'viewer cannot read same-template draft');
select is((select count(*)::int from public.questionnaire_versions where id='7a300000-0000-0000-0000-000000000003'),0,'viewer cannot read archived version');
select is((select count(*)::int from public.questionnaire_versions where id='70000000-0000-0000-0000-000000000002'),1,'member reads published system version');
select is((select count(*)::int from public.questionnaire_versions where id='70000000-0000-0000-0000-000000000003'),0,'member cannot read system draft');
select is((select count(*)::int from public.questionnaire_sections where id='7a400000-0000-0000-0000-000000000002'),0,'viewer cannot read draft section');
select is((select count(*)::int from public.questionnaire_questions where id='7a500000-0000-0000-0000-000000000002'),0,'viewer cannot read draft question');

reset role; set local role authenticated;
select set_config('request.jwt.claim.sub','71000000-0000-0000-0000-000000000002',true);
select lives_ok($$update public.audits set current_section_id='7a400000-0000-0000-0000-000000000001' where id='7a600000-0000-0000-0000-000000000001'$$,'current section from audit version is accepted');
select throws_like($$update public.audits set current_section_id='7a400000-0000-0000-0000-000000000002' where id='7a600000-0000-0000-0000-000000000001'$$,'%must belong to the audit questionnaire version%','section from another version is rejected');
select throws_like($$update public.audits set current_section_id='7b400000-0000-0000-0000-000000000001' where id='7a600000-0000-0000-0000-000000000001'$$,'%must belong to the audit questionnaire version%','section from another organization is rejected');
select is((select count(*)::int from public.questionnaire_versions where id='7b300000-0000-0000-0000-000000000001'),0,'owner cannot read cross-organization draft');

select * from finish();
rollback;
