create type public.organization_role as enum ('owner', 'admin', 'consultant', 'viewer');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 2 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.organization_members (
  organization_id uuid not null references public.organizations(id),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.organization_role not null default 'consultant',
  created_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  name text not null check (char_length(name) between 2 and 160),
  sector_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.audits (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  company_id uuid not null references public.companies(id),
  status text not null default 'draft' check (status in ('draft','in_review','validated','archived')),
  questionnaire_version text,
  rule_set_version text,
  validated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.companies enable row level security;
alter table public.audits enable row level security;

create policy "members read organizations" on public.organizations for select to authenticated using (
  exists (select 1 from public.organization_members m where m.organization_id = id and m.user_id = (select auth.uid()))
);
create policy "members read memberships" on public.organization_members for select to authenticated using (
  user_id = (select auth.uid()) or exists (select 1 from public.organization_members m where m.organization_id = organization_id and m.user_id = (select auth.uid()) and m.role in ('owner','admin'))
);
create policy "members read companies" on public.companies for select to authenticated using (
  exists (select 1 from public.organization_members m where m.organization_id = organization_id and m.user_id = (select auth.uid())) and deleted_at is null
);
create policy "editors create companies" on public.companies for insert to authenticated with check (
  exists (select 1 from public.organization_members m where m.organization_id = organization_id and m.user_id = (select auth.uid()) and m.role in ('owner','admin','consultant'))
);
create policy "editors update companies" on public.companies for update to authenticated using (
  exists (select 1 from public.organization_members m where m.organization_id = organization_id and m.user_id = (select auth.uid()) and m.role in ('owner','admin','consultant'))
) with check (
  exists (select 1 from public.organization_members m where m.organization_id = organization_id and m.user_id = (select auth.uid()) and m.role in ('owner','admin','consultant'))
);
create policy "members read audits" on public.audits for select to authenticated using (
  exists (select 1 from public.organization_members m where m.organization_id = organization_id and m.user_id = (select auth.uid())) and deleted_at is null
);

create index companies_organization_idx on public.companies(organization_id) where deleted_at is null;
create index audits_organization_company_idx on public.audits(organization_id, company_id) where deleted_at is null;
