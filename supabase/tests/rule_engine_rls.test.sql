begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','91000000-0000-0000-0000-000000000001','authenticated','authenticated','rule-admin-a@test.local',crypt('password',gen_salt('bf')),now(),'{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','91000000-0000-0000-0000-000000000002','authenticated','authenticated','rule-viewer-a@test.local',crypt('password',gen_salt('bf')),now(),'{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','92000000-0000-0000-0000-000000000001','authenticated','authenticated','rule-admin-b@test.local',crypt('password',gen_salt('bf')),now(),'{}','{}',now(),now());
insert into public.organizations(id,name) values ('9a000000-0000-0000-0000-000000000001','Rule Org A'),('9b000000-0000-0000-0000-000000000001','Rule Org B');
insert into public.organization_members(organization_id,user_id,role) values
('9a000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000001','admin'),
('9a000000-0000-0000-0000-000000000001','91000000-0000-0000-0000-000000000002','viewer'),
('9b000000-0000-0000-0000-000000000001','92000000-0000-0000-0000-000000000001','admin');
insert into public.companies(id,organization_id,name) values ('9a100000-0000-0000-0000-000000000001','9a000000-0000-0000-0000-000000000001','Rule Company A'),('9b100000-0000-0000-0000-000000000001','9b000000-0000-0000-0000-000000000001','Rule Company B');
insert into public.audits(id,organization_id,company_id) values ('9a200000-0000-0000-0000-000000000001','9a000000-0000-0000-0000-000000000001','9a100000-0000-0000-0000-000000000001'),('9b200000-0000-0000-0000-000000000001','9b000000-0000-0000-0000-000000000001','9b100000-0000-0000-0000-000000000001');
insert into public.rule_categories(id,organization_id,code,name) values ('9a300000-0000-0000-0000-000000000001','9a000000-0000-0000-0000-000000000001','custom_a','Custom A'),('9b300000-0000-0000-0000-000000000001','9b000000-0000-0000-0000-000000000001','custom_b','Custom B');
insert into public.rules(id,organization_id,category_id,code,name,condition_json) values ('9a400000-0000-0000-0000-000000000001','9a000000-0000-0000-0000-000000000001','9a300000-0000-0000-0000-000000000001','CUSTOM_A','Custom A','{"fact":"a","operator":"equal","value":true}'),('9b400000-0000-0000-0000-000000000001','9b000000-0000-0000-0000-000000000001','9b300000-0000-0000-0000-000000000001','CUSTOM_B','Custom B','{"fact":"b","operator":"equal","value":true}');

set local role authenticated; select set_config('request.jwt.claim.sub','91000000-0000-0000-0000-000000000001',true);
select is((select count(*)::int from public.rules where organization_id is null),20,'admin reads twenty system rules');
select is((select count(*)::int from public.rules where id='9a400000-0000-0000-0000-000000000001'),1,'admin reads own custom rule');
select is((select count(*)::int from public.rules where id='9b400000-0000-0000-0000-000000000001'),0,'admin cannot read cross-tenant custom rule');
select lives_ok($$insert into public.audit_rule_matches(organization_id,audit_id,rule_id,matched,score) values ('9a000000-0000-0000-0000-000000000001','9a200000-0000-0000-0000-000000000001','9a400000-0000-0000-0000-000000000001',true,1)$$,'admin stores own audit match');
select throws_like($$insert into public.audit_rule_matches(organization_id,audit_id,rule_id,matched,score) values ('9a000000-0000-0000-0000-000000000001','9b200000-0000-0000-0000-000000000001','9a400000-0000-0000-0000-000000000001',true,1)$$,'%audit must belong%','admin cannot store a cross-tenant audit match');
select lives_ok($$insert into public.audit_scores(organization_id,audit_id,category_id,score,total,percentage) values ('9a000000-0000-0000-0000-000000000001','9a200000-0000-0000-0000-000000000001','9a300000-0000-0000-0000-000000000001',1,2,50)$$,'admin stores own audit score');
select throws_like($$update public.rules set condition_json='{"fact":"changed","operator":"isEmpty"}' where id='9a400000-0000-0000-0000-000000000001'$$,'%decision fields are immutable%','condition cannot be rewritten');
select throws_like($$update public.rules set weight=9 where id='9a400000-0000-0000-0000-000000000001'$$,'%decision fields are immutable%','weight cannot be rewritten');
select lives_ok($$insert into public.rules(organization_id,category_id,code,name,condition_json,version) values ('9a000000-0000-0000-0000-000000000001','9a300000-0000-0000-0000-000000000001','CUSTOM_A','Custom A v2','{"fact":"a","operator":"equal","value":false}',2)$$,'a second immutable version coexists');
select results_eq($$with changed as (update public.rules set active=false where organization_id is null returning 1) select count(*)::int from changed$$,array[0],'system rules cannot be modified');

reset role; set local role authenticated; select set_config('request.jwt.claim.sub','91000000-0000-0000-0000-000000000002',true);
select is((select count(*)::int from public.audit_rule_matches where audit_id='9a200000-0000-0000-0000-000000000001'),1,'viewer reads own organization results');
select throws_like($$insert into public.audit_rule_matches(organization_id,audit_id,rule_id,matched,score) values ('9a000000-0000-0000-0000-000000000001','9a200000-0000-0000-0000-000000000001','9a400000-0000-0000-0000-000000000001',false,0)$$,'%row-level security%','viewer cannot write audit matches');

select * from finish();
rollback;
