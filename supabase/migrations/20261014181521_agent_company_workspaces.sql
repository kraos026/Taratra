-- SHADOW configuration only; no agent execution, activation or secrets.
create function private.valid_agent_company_profiles(value jsonb)
returns boolean language sql immutable strict set search_path='' as $$
  select case when jsonb_typeof(value)<>'array' then false else
    jsonb_array_length(value) between 1 and 3
    and not exists(select 1 from jsonb_array_elements(value) a where
      jsonb_typeof(a)<>'object' or coalesce(jsonb_typeof(a->'name'),'null')<>'string'
      or coalesce(jsonb_typeof(a->'role'),'null')<>'string'
      or char_length(btrim(a->>'name')) not between 2 and 80
      or char_length(btrim(a->>'role')) not between 2 and 160
      or a-'name'-'role'<>'{}'::jsonb)
    and (select count(distinct lower(btrim(a->>'name'))) from jsonb_array_elements(value) a)=jsonb_array_length(value)
  end
$$;
revoke all on function private.valid_agent_company_profiles(jsonb) from public;
grant execute on function private.valid_agent_company_profiles(jsonb) to authenticated;
create table public.agent_company_workspaces (
  id uuid primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  company_id uuid,
  name varchar(120) not null check(char_length(btrim(name)) between 2 and 120),
  objective varchar(2000) not null check(char_length(btrim(objective)) between 10 and 2000),
  mode text not null check(mode in ('guided','template','manual')),
  autonomy text not null default 'approval' check(autonomy in ('approval','scoped','bounded')),
  agents jsonb not null check(private.valid_agent_company_profiles(agents) and octet_length(agents::text)<=8192),
  status text not null default 'preparation' check(status='preparation'),
  api_budget_euro integer not null default 0 check(api_budget_euro=0),
  concurrency_limit integer not null default 1 check(concurrency_limit=1),
  created_at timestamptz not null default now(),
  foreign key(organization_id,company_id) references public.companies(organization_id,id)
);
create index agent_company_workspaces_org_created_idx on public.agent_company_workspaces(organization_id,created_at desc,id);
alter table public.agent_company_workspaces enable row level security;
revoke all on public.agent_company_workspaces from public,anon,authenticated,service_role;
grant select,insert on public.agent_company_workspaces to authenticated;
grant update(company_id) on public.agent_company_workspaces to authenticated;
create policy agent_company_read on public.agent_company_workspaces for select to authenticated
using ((select private.has_organization_role(organization_id,array['owner','admin','consultant','viewer']::public.organization_role[])));
create policy agent_company_create on public.agent_company_workspaces for insert to authenticated
with check (
  created_by=(select auth.uid()) and
  (select private.has_organization_role(organization_id,array['owner','admin','consultant']::public.organization_role[])) and
  (company_id is null or exists(select 1 from public.companies c where c.id=company_id and c.organization_id=agent_company_workspaces.organization_id and c.deleted_at is null and c.status<>'archived'))
);
create policy agent_company_link on public.agent_company_workspaces for update to authenticated
using ((select private.has_organization_role(organization_id,array['owner','admin','consultant']::public.organization_role[])))
with check (
  (select private.has_organization_role(organization_id,array['owner','admin','consultant']::public.organization_role[])) and
  (company_id is null or exists(select 1 from public.companies c where c.id=company_id and c.organization_id=agent_company_workspaces.organization_id and c.deleted_at is null and c.status<>'archived'))
);
