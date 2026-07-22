begin;

create extension if not exists pgtap with schema extensions;

select plan(11);

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
select
  '00000000-0000-0000-0000-000000000000', fixture.id, 'authenticated',
  'authenticated', fixture.email, crypt('test-password', gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
from (
  values
    ('51000000-0000-0000-0000-000000000001'::uuid, 'owner-a-companies@example.test'),
    ('51000000-0000-0000-0000-000000000002'::uuid, 'admin-a-companies@example.test'),
    ('51000000-0000-0000-0000-000000000003'::uuid, 'consultant-a-companies@example.test'),
    ('51000000-0000-0000-0000-000000000004'::uuid, 'viewer-a-companies@example.test'),
    ('52000000-0000-0000-0000-000000000001'::uuid, 'owner-b-companies@example.test')
) as fixture(id, email);

insert into public.organizations (id, name)
values
  ('ca000000-0000-0000-0000-000000000001', 'Companies Organization A'),
  ('cb000000-0000-0000-0000-000000000001', 'Companies Organization B');

insert into public.organization_members (organization_id, user_id, role)
values
  ('ca000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000001', 'owner'),
  ('ca000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000002', 'admin'),
  ('ca000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000003', 'consultant'),
  ('ca000000-0000-0000-0000-000000000001', '51000000-0000-0000-0000-000000000004', 'viewer'),
  ('cb000000-0000-0000-0000-000000000001', '52000000-0000-0000-0000-000000000001', 'owner');

insert into public.companies (
  id, organization_id, name, employee_count, company_size, primary_contact_name,
  email, website, city, country, status
)
values
  ('ca100000-0000-0000-0000-000000000001', 'ca000000-0000-0000-0000-000000000001', 'Active A', 20, 'small', 'Alice', 'alice@example.test', 'https://example.test', 'Paris', 'France', 'prospect'),
  ('ca100000-0000-0000-0000-000000000002', 'ca000000-0000-0000-0000-000000000001', 'Archived A', 200, 'large', 'Anne', null, null, null, null, 'client'),
  ('cb100000-0000-0000-0000-000000000001', 'cb000000-0000-0000-0000-000000000001', 'Active B', null, null, null, null, null, null, null, 'prospect');

update public.companies
set deleted_at = now()
where companies.id = 'ca100000-0000-0000-0000-000000000002';

set local role authenticated;
select set_config('request.jwt.claim.sub', '51000000-0000-0000-0000-000000000004', true);

select results_eq(
  $$select companies.name from public.companies order by companies.name$$,
  array['Active A'::text],
  'viewer reads active companies in their organization but not archived companies'
);

select is(
  (select count(*)::integer from public.companies where companies.organization_id = 'cb000000-0000-0000-0000-000000000001'),
  0,
  'viewer cannot read another organization companies'
);

select results_eq(
  $$with changed as (
    update public.companies set city = 'Lyon'
    where companies.id = 'ca100000-0000-0000-0000-000000000001' returning 1
  ) select count(*)::integer from changed$$,
  array[0],
  'viewer cannot update a company'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '51000000-0000-0000-0000-000000000003', true);

select results_eq(
  $$select companies.name from public.companies order by companies.name$$,
  array['Active A'::text, 'Archived A'::text],
  'consultant reads active and archived companies in their organization'
);

select lives_ok(
  $$insert into public.companies (organization_id, name, status)
    values ('ca000000-0000-0000-0000-000000000001', 'Created by consultant', 'contacted')$$,
  'consultant creates a company in their organization'
);

select throws_like(
  $$insert into public.companies (organization_id, name)
    values ('cb000000-0000-0000-0000-000000000001', 'Cross tenant create')$$,
  '%row-level security policy%companies%',
  'consultant cannot create a company in another organization'
);

select results_eq(
  $$with changed as (
    update public.companies set deleted_at = now()
    where companies.id = 'ca100000-0000-0000-0000-000000000001' returning 1
  ) select count(*)::integer from changed$$,
  array[1],
  'consultant archives a company in their organization'
);

select results_eq(
  $$with changed as (
    update public.companies set deleted_at = null
    where companies.id = 'ca100000-0000-0000-0000-000000000001' returning 1
  ) select count(*)::integer from changed$$,
  array[1],
  'consultant restores a company in their organization'
);

select results_eq(
  $$with changed as (
    update public.companies set name = 'Forbidden B update'
    where companies.id = 'cb100000-0000-0000-0000-000000000001' returning 1
  ) select count(*)::integer from changed$$,
  array[0],
  'consultant cannot update another organization company'
);

select results_eq(
  $$with removed as (
    delete from public.companies
    where companies.id = 'ca100000-0000-0000-0000-000000000001' returning 1
  ) select count(*)::integer from removed$$,
  array[0],
  'consultant cannot permanently delete a company'
);

reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub', '51000000-0000-0000-0000-000000000002', true);

select results_eq(
  $$with removed as (
    delete from public.companies
    where companies.id = 'ca100000-0000-0000-0000-000000000001' returning 1
  ) select count(*)::integer from removed$$,
  array[1],
  'admin permanently deletes a company in their organization'
);

select * from finish();
rollback;
