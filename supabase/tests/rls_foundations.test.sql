begin;

create extension if not exists pgtap with schema extensions;

select plan(18);

insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
select
  '00000000-0000-0000-0000-000000000000',
  fixture.id,
  'authenticated',
  'authenticated',
  fixture.email,
  crypt('test-password', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
from (
  values
    ('10000000-0000-0000-0000-000000000001'::uuid, 'owner-a@example.test'),
    ('10000000-0000-0000-0000-000000000002'::uuid, 'admin-a@example.test'),
    ('10000000-0000-0000-0000-000000000003'::uuid, 'consultant-a@example.test'),
    ('10000000-0000-0000-0000-000000000004'::uuid, 'viewer-a@example.test'),
    ('20000000-0000-0000-0000-000000000001'::uuid, 'owner-b@example.test'),
    ('30000000-0000-0000-0000-000000000001'::uuid, 'onboarding@example.test'),
    ('40000000-0000-0000-0000-000000000001'::uuid, 'new-member-a@example.test'),
    ('40000000-0000-0000-0000-000000000002'::uuid, 'new-member-b@example.test')
) as fixture(id, email);

insert into public.organizations (id, name)
values
  ('a0000000-0000-0000-0000-000000000001', 'Organization A'),
  ('b0000000-0000-0000-0000-000000000001', 'Organization B');

insert into public.organization_members (organization_id, user_id, role)
values
  ('a0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000001', 'owner'),
  ('a0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000002', 'admin'),
  ('a0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000003', 'consultant'),
  ('a0000000-0000-0000-0000-000000000001', '10000000-0000-0000-0000-000000000004', 'viewer'),
  ('b0000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'owner');

insert into public.companies (id, organization_id, name)
values
  ('a1000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Company A'),
  ('b1000000-0000-0000-0000-000000000001', 'b0000000-0000-0000-0000-000000000001', 'Company B');

set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000003', true);

select is(
  (select count(*)::integer from public.companies where companies.organization_id = 'a0000000-0000-0000-0000-000000000001'),
  1,
  'a consultant can read companies in organization A'
);

select is(
  (select count(*)::integer from public.companies where companies.organization_id = 'b0000000-0000-0000-0000-000000000001'),
  0,
  'a consultant cannot read companies in organization B'
);

select is(
  (with changed as (
    update public.companies set name = 'Company A updated'
    where companies.id = 'a1000000-0000-0000-0000-000000000001'
    returning 1
  ) select count(*)::integer from changed),
  1,
  'a consultant can update a company in the same organization'
);

select is(
  (with changed as (
    update public.companies set name = 'Forbidden update'
    where companies.id = 'b1000000-0000-0000-0000-000000000001'
    returning 1
  ) select count(*)::integer from changed),
  0,
  'a consultant cannot update a company in another organization'
);

select throws_like(
  $$delete from public.companies where companies.id = 'b1000000-0000-0000-0000-000000000001'$$,
  '%permission denied%companies%',
  'a consultant cannot delete a company in another organization'
);

select lives_ok(
  $$insert into public.companies (organization_id, name) values ('a0000000-0000-0000-0000-000000000001', 'Consultant Company')$$,
  'a consultant can create a company in the same organization'
);

select throws_like(
  $$insert into public.companies (organization_id, name) values ('b0000000-0000-0000-0000-000000000001', 'Cross Tenant Company')$$,
  '%row-level security policy%companies%',
  'a consultant cannot create a company in another organization'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000004', true);

select is(
  (with changed as (
    update public.companies set name = 'Viewer update'
    where companies.id = 'a1000000-0000-0000-0000-000000000001'
    returning 1
  ) select count(*)::integer from changed),
  0,
  'a viewer cannot update a company'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000002', true);

select lives_ok(
  $$insert into public.organization_members (organization_id, user_id, role) values ('a0000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', 'viewer')$$,
  'an admin can add a member to the same organization'
);

select throws_like(
  $$insert into public.organization_members (organization_id, user_id, role) values ('b0000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000002', 'viewer')$$,
  '%row-level security policy%organization_members%',
  'an admin cannot add a member to another organization'
);

select is(
  (select count(*)::integer from public.organization_members),
  5,
  'an admin sees members of the same organization only'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '10000000-0000-0000-0000-000000000001', true);

select is(
  (with changed as (
    update public.organization_members set role = 'consultant'
    where organization_members.organization_id = 'a0000000-0000-0000-0000-000000000001'
      and organization_members.user_id = '40000000-0000-0000-0000-000000000001'
    returning 1
  ) select count(*)::integer from changed),
  1,
  'an owner can update a member in the same organization'
);

select is(
  (with changed as (
    update public.organization_members set role = 'viewer'
    where organization_members.organization_id = 'b0000000-0000-0000-0000-000000000001'
    returning 1
  ) select count(*)::integer from changed),
  0,
  'an owner cannot update members of another organization'
);

select throws_like(
  $$delete from public.organization_members where organization_members.organization_id = 'a0000000-0000-0000-0000-000000000001' and organization_members.user_id = '10000000-0000-0000-0000-000000000001'$$,
  '%must retain at least one owner%',
  'the last owner cannot be removed'
);

select is(
  (select count(*)::integer from public.organizations),
  1,
  'a user can read its own organization only'
);

select ok(
  (select companies.updated_at > companies.created_at from public.companies where companies.id = 'a1000000-0000-0000-0000-000000000001'),
  'updated_at changes automatically after an update'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '30000000-0000-0000-0000-000000000001', true);

select ok(
  public.create_first_organization('Onboarded Organization') is not null,
  'onboarding creates an organization transactionally'
);

select is(
  (select count(*)::integer from public.organization_members where organization_members.role = 'owner'),
  1,
  'onboarding assigns the authenticated user as owner'
);

select * from finish();
rollback;
