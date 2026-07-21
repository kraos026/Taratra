create schema if not exists private;

revoke all on schema private from public, anon, authenticated;

create type public.organization_role as enum ('owner', 'admin', 'consultant', 'viewer');

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

create table public.organization_members (
  organization_id uuid not null references public.organizations(id),
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.organization_role not null default 'consultant',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  name text not null check (char_length(btrim(name)) between 2 and 160),
  sector_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  unique (organization_id, id)
);

create table public.audits (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  company_id uuid not null,
  status text not null default 'draft' check (status in ('draft', 'in_review', 'validated', 'archived')),
  questionnaire_version text,
  rule_set_version text,
  validated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  foreign key (organization_id, company_id)
    references public.companies(organization_id, id)
);

create index organization_members_user_idx on public.organization_members(user_id);
create index organization_members_role_idx on public.organization_members(organization_id, role);
create index companies_organization_idx on public.companies(organization_id) where deleted_at is null;
create index audits_organization_company_idx on public.audits(organization_id, company_id) where deleted_at is null;

create function private.has_organization_role(
  requested_organization_id uuid,
  allowed_roles public.organization_role[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.organization_members
    where organization_members.organization_id = requested_organization_id
      and organization_members.user_id = (select auth.uid())
      and organization_members.role = any(allowed_roles)
  );
$$;

revoke execute on function private.has_organization_role(uuid, public.organization_role[]) from public, anon;
grant usage on schema private to authenticated;
grant execute on function private.has_organization_role(uuid, public.organization_role[]) to authenticated;

create function private.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = statement_timestamp();
  return new;
end;
$$;

create trigger organizations_set_updated_at
before update on public.organizations
for each row execute function private.set_updated_at();

create trigger organization_members_set_updated_at
before update on public.organization_members
for each row execute function private.set_updated_at();

create trigger companies_set_updated_at
before update on public.companies
for each row execute function private.set_updated_at();

create trigger audits_set_updated_at
before update on public.audits
for each row execute function private.set_updated_at();

create function private.prevent_ownerless_organization()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role = 'owner'
    and (
      tg_op = 'DELETE'
      or new.role <> 'owner'
      or new.organization_id <> old.organization_id
    )
    and not exists (
      select 1
      from public.organization_members
      where organization_members.organization_id = old.organization_id
        and organization_members.user_id <> old.user_id
        and organization_members.role = 'owner'
    )
  then
    raise exception 'An organization must retain at least one owner'
      using errcode = '23514';
  end if;

  if tg_op = 'DELETE' then
    return old;
  end if;

  return new;
end;
$$;

create trigger organization_members_retain_owner
before update of role, organization_id or delete on public.organization_members
for each row execute function private.prevent_ownerless_organization();

alter table public.organizations enable row level security;
alter table public.organization_members enable row level security;
alter table public.companies enable row level security;
alter table public.audits enable row level security;

create policy "members read organizations"
on public.organizations for select to authenticated
using (
  exists (
    select 1
    from public.organization_members as m
    where m.organization_id = organizations.id
      and m.user_id = (select auth.uid())
  )
  and organizations.deleted_at is null
);

create policy "owners and admins update organizations"
on public.organizations for update to authenticated
using (
  (select private.has_organization_role(organizations.id, array['owner', 'admin']::public.organization_role[]))
  and organizations.deleted_at is null
)
with check (
  (select private.has_organization_role(organizations.id, array['owner', 'admin']::public.organization_role[]))
);

create policy "members read memberships"
on public.organization_members for select to authenticated
using (
  organization_members.user_id = (select auth.uid())
  or (select private.has_organization_role(
    organization_members.organization_id,
    array['owner', 'admin']::public.organization_role[]
  ))
);

create policy "owners and admins create memberships"
on public.organization_members for insert to authenticated
with check (
  (select private.has_organization_role(
    organization_members.organization_id,
    array['owner', 'admin']::public.organization_role[]
  ))
);

create policy "owners and admins update memberships"
on public.organization_members for update to authenticated
using (
  (select private.has_organization_role(
    organization_members.organization_id,
    array['owner', 'admin']::public.organization_role[]
  ))
)
with check (
  (select private.has_organization_role(
    organization_members.organization_id,
    array['owner', 'admin']::public.organization_role[]
  ))
);

create policy "owners and admins delete memberships"
on public.organization_members for delete to authenticated
using (
  (select private.has_organization_role(
    organization_members.organization_id,
    array['owner', 'admin']::public.organization_role[]
  ))
);

create policy "members read companies"
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

create policy "editors create companies"
on public.companies for insert to authenticated
with check (
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
  and companies.deleted_at is null
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

create policy "members read audits"
on public.audits for select to authenticated
using (
  exists (
    select 1
    from public.organization_members as m
    where m.organization_id = audits.organization_id
      and m.user_id = (select auth.uid())
  )
  and audits.deleted_at is null
);

create function public.create_first_organization(organization_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  authenticated_user_id uuid := (select auth.uid());
  created_organization_id uuid;
begin
  if authenticated_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if char_length(btrim(organization_name)) not between 2 and 120 then
    raise exception 'Organization name must contain between 2 and 120 characters'
      using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(authenticated_user_id::text, 0));

  if exists (
    select 1
    from public.organization_members
    where organization_members.user_id = authenticated_user_id
  ) then
    raise exception 'The user already belongs to an organization'
      using errcode = '23505';
  end if;

  insert into public.organizations (name)
  values (btrim(organization_name))
  returning organizations.id into created_organization_id;

  insert into public.organization_members (organization_id, user_id, role)
  values (created_organization_id, authenticated_user_id, 'owner');

  return created_organization_id;
end;
$$;

revoke execute on function public.create_first_organization(text) from public, anon;
grant execute on function public.create_first_organization(text) to authenticated;

grant select, update on public.organizations to authenticated;
grant select, insert, update, delete on public.organization_members to authenticated;
grant select, insert, update on public.companies to authenticated;
grant select on public.audits to authenticated;

comment on function public.create_first_organization(text) is
  'Atomically creates the first organization for the authenticated user and assigns owner membership.';
