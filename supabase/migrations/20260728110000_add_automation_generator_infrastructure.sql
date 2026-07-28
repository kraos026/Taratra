create table public.automation_generations(
 id uuid primary key,
 organization_id uuid not null references public.organizations(id) on delete cascade,
 lineage_id uuid not null,
 generation_version integer not null check(generation_version>0),
 specification_snapshot_id uuid not null,
 specification_lineage_id text not null,
 status text not null check(status in('REQUESTED','GENERATED','PUBLISHED','DEPRECATED')),
 lock_version integer not null check(lock_version>0),
 is_latest_version boolean not null,
 state_json jsonb not null check(jsonb_typeof(state_json)='object'),
 created_at timestamptz not null,
 updated_at timestamptz not null,
 unique(id,organization_id),
 unique(organization_id,lineage_id,generation_version),
 foreign key(specification_snapshot_id,organization_id)
  references public.automation_specifications(id,organization_id)
);
create index automation_generations_specification_lineage_idx
 on public.automation_generations(organization_id,specification_lineage_id,generation_version desc);
create index automation_generations_active_lineage_idx
 on public.automation_generations(organization_id,lineage_id,status,is_latest_version);

create table public.automation_generation_outbox(
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 aggregate_id uuid not null,
 event_name text not null check(event_name in('AutomationGraphPublished','AutomationGenerationDeprecated')),
 payload_json jsonb not null check(jsonb_typeof(payload_json)='object'),
 occurred_at timestamptz not null,
 published_at timestamptz,
 created_at timestamptz not null default now(),
 foreign key(aggregate_id,organization_id)
  references public.automation_generations(id,organization_id) on delete cascade
);
create index automation_generation_outbox_pending_idx
 on public.automation_generation_outbox(published_at,created_at,id);
create index automation_generation_outbox_aggregate_idx
 on public.automation_generation_outbox(organization_id,aggregate_id);

create table public.automation_generation_idempotency(
 organization_id uuid not null references public.organizations(id) on delete cascade,
 command_name text not null,
 idempotency_key uuid not null,
 fingerprint text not null check(fingerprint~'^[0-9a-f]{64}$'),
 state text not null check(state in('IN_PROGRESS','COMPLETED')),
 result_json jsonb,
 created_at timestamptz not null default now(),
 completed_at timestamptz,
 primary key(organization_id,command_name,idempotency_key),
 check((state='IN_PROGRESS' and result_json is null and completed_at is null)
    or(state='COMPLETED' and result_json is not null and completed_at is not null))
);
create index automation_generation_idempotency_created_idx
 on public.automation_generation_idempotency(created_at);

alter table public.automation_generations enable row level security;
alter table public.automation_generation_outbox enable row level security;
alter table public.automation_generation_idempotency enable row level security;

create policy "members read automation generations" on public.automation_generations
 for select to authenticated using((select private.has_organization_role(
  automation_generations.organization_id,
  array['owner','admin','consultant','viewer']::public.organization_role[]
 )));
create policy "editors manage automation generations" on public.automation_generations
 for all to authenticated using((select private.has_organization_role(
  automation_generations.organization_id,
  array['owner','admin','consultant']::public.organization_role[]
 ))) with check((select private.has_organization_role(
  automation_generations.organization_id,
  array['owner','admin','consultant']::public.organization_role[]
 )));

create policy "editors manage automation generation outbox"
 on public.automation_generation_outbox for all to authenticated
 using((select private.has_organization_role(
  automation_generation_outbox.organization_id,
  array['owner','admin','consultant']::public.organization_role[]
 ))) with check((select private.has_organization_role(
  automation_generation_outbox.organization_id,
  array['owner','admin','consultant']::public.organization_role[]
 )));

create policy "editors manage automation generation idempotency"
 on public.automation_generation_idempotency for all to authenticated
 using((select private.has_organization_role(
  automation_generation_idempotency.organization_id,
  array['owner','admin','consultant']::public.organization_role[]
 ))) with check((select private.has_organization_role(
  automation_generation_idempotency.organization_id,
  array['owner','admin','consultant']::public.organization_role[]
 )));

grant select,insert,update,delete on public.automation_generations to authenticated;
grant select,insert,update,delete on public.automation_generation_outbox to authenticated;
grant select,insert,update,delete on public.automation_generation_idempotency to authenticated;
