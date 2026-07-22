create type public.company_size as enum ('micro', 'small', 'medium', 'large', 'enterprise');
create type public.company_status as enum (
  'prospect',
  'contacted',
  'audit_scheduled',
  'audit_in_progress',
  'client',
  'archived'
);

alter table public.companies
  add column employee_count integer check (employee_count >= 0),
  add column company_size public.company_size,
  add column primary_contact_name text,
  add column primary_contact_role text,
  add column phone text,
  add column email text check (
    email is null or email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$'
  ),
  add column website text check (
    website is null or website ~* '^https?://[^[:space:]]+$'
  ),
  add column address text,
  add column city text,
  add column country text,
  add column description text,
  add column internal_notes text,
  add column status public.company_status not null default 'prospect';

create index companies_status_idx
  on public.companies (organization_id, status)
  where deleted_at is null;
create index companies_size_idx
  on public.companies (organization_id, company_size)
  where deleted_at is null;
create index companies_sector_idx
  on public.companies (organization_id, sector_id)
  where deleted_at is null;
create index companies_created_at_idx
  on public.companies (organization_id, created_at desc);
create index companies_name_search_idx
  on public.companies (organization_id, lower(name));

drop policy "members read companies" on public.companies;
drop policy "editors update companies" on public.companies;

create policy "members read active companies"
on public.companies for select to authenticated
using (
  exists (
    select 1
    from public.organization_members as m
    where m.organization_id = companies.organization_id
      and m.user_id = (select auth.uid())
  )
  and companies.deleted_at is null
);

create policy "editors read archived companies"
on public.companies for select to authenticated
using (
  exists (
    select 1
    from public.organization_members as m
    where m.organization_id = companies.organization_id
      and m.user_id = (select auth.uid())
      and m.role in ('owner', 'admin', 'consultant')
  )
);

create policy "editors update companies"
on public.companies for update to authenticated
using (
  exists (
    select 1
    from public.organization_members as m
    where m.organization_id = companies.organization_id
      and m.user_id = (select auth.uid())
      and m.role in ('owner', 'admin', 'consultant')
  )
)
with check (
  exists (
    select 1
    from public.organization_members as m
    where m.organization_id = companies.organization_id
      and m.user_id = (select auth.uid())
      and m.role in ('owner', 'admin', 'consultant')
  )
);

create policy "owners and admins delete companies"
on public.companies for delete to authenticated
using (
  exists (
    select 1
    from public.organization_members as m
    where m.organization_id = companies.organization_id
      and m.user_id = (select auth.uid())
      and m.role in ('owner', 'admin')
  )
);

grant delete on public.companies to authenticated;
