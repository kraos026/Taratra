-- SHADOW registry: trusted server/operator registration, client-side consultation only.
create table public.agent_mission_links (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_id uuid not null,
  run_id text not null unique check (run_id ~ '^run_[0-9a-f]{32}$'),
  title varchar(120) not null check (char_length(btrim(title)) between 1 and 120),
  registration_source text not null default 'operator_verified'
    check (registration_source in ('operator_verified', 'server_dispatch')),
  created_at timestamptz not null default now(),
  foreign key (organization_id, company_id)
    references public.companies(organization_id, id) on delete cascade
);
create index agent_mission_links_company_created_idx
  on public.agent_mission_links(company_id, created_at desc, id);
alter table public.agent_mission_links enable row level security;
revoke all on public.agent_mission_links from public, anon, authenticated, service_role;
grant select on public.agent_mission_links to authenticated;
-- Privileged server registration is intentionally not exposed to authenticated users.
grant select, insert on public.agent_mission_links to service_role;
create policy agent_mission_links_company_read
  on public.agent_mission_links for select to authenticated
  using (
    (select private.has_organization_role(organization_id,
      array['owner','admin','consultant','viewer']::public.organization_role[]))
    and exists (select 1 from public.companies c
      where c.id = company_id and c.organization_id = agent_mission_links.organization_id
        and c.deleted_at is null and c.status <> 'archived')
  );
