begin;
create extension if not exists pgtap with schema extensions;
select plan(8);

insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at) values
('00000000-0000-0000-0000-000000000000','93000000-0000-0000-0000-000000000001','authenticated','authenticated','roi-owner-a@test.local',crypt('password',gen_salt('bf')),now(),'{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','93000000-0000-0000-0000-000000000002','authenticated','authenticated','roi-viewer-a@test.local',crypt('password',gen_salt('bf')),now(),'{}','{}',now(),now()),
('00000000-0000-0000-0000-000000000000','93000000-0000-0000-0000-000000000003','authenticated','authenticated','roi-owner-b@test.local',crypt('password',gen_salt('bf')),now(),'{}','{}',now(),now());
insert into public.organizations(id,name) values('93000000-0000-0000-0000-000000000011','ROI A'),('93000000-0000-0000-0000-000000000012','ROI B');
insert into public.organization_members(organization_id,user_id,role) values
('93000000-0000-0000-0000-000000000011','93000000-0000-0000-0000-000000000001','owner'),
('93000000-0000-0000-0000-000000000011','93000000-0000-0000-0000-000000000002','viewer'),
('93000000-0000-0000-0000-000000000012','93000000-0000-0000-0000-000000000003','owner');

set local role authenticated;
select set_config('request.jwt.claim.sub','93000000-0000-0000-0000-000000000001',true);
select is((select count(*)::int from public.roi_profiles),8,'member reads system profiles');
select lives_ok($$insert into public.roi_profiles(organization_id,code,name,currency,hourly_cost,working_days_year,working_hours_day) values('93000000-0000-0000-0000-000000000011','CUSTOM_A','Custom A','EUR',25,220,8)$$,'owner creates own profile');
select is((select count(*)::int from public.roi_profiles where organization_id='93000000-0000-0000-0000-000000000011'),1,'owner reads own profile');
select is((select count(*)::int from public.roi_profiles where organization_id='93000000-0000-0000-0000-000000000012'),0,'tenant B profiles are invisible');
select throws_like($$insert into public.roi_profiles(organization_id,code,name,currency,hourly_cost,working_days_year,working_hours_day) values('93000000-0000-0000-0000-000000000012','CROSS','Cross','EUR',1,220,8)$$,'%row-level security%','owner cannot create for tenant B');

reset role; set local role authenticated;
select set_config('request.jwt.claim.sub','93000000-0000-0000-0000-000000000002',true);
select results_eq($$with changed as (update public.roi_profiles set hourly_cost=1 where code='CUSTOM_A' returning 1) select count(*)::int from changed$$,array[0],'viewer cannot update');
select is((select count(*)::int from public.recommendations where organization_id is null),30,'thirty system recommendations exist');
select is((select count(*)::int from public.rule_recommendations),30,'all recommendations are linked');
select * from finish();
rollback;
