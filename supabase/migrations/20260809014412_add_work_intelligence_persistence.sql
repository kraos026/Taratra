create type public.work_activity_confirmation_state as enum ('PENDING','CONFIRMED','CORRECTED','REJECTED');
create type public.work_activity_evidence_kind as enum ('DECLARED','OBSERVED');
create type public.work_activity_source as enum ('MANUAL','AUDIT','IMPORT','CONNECTOR','INFERRED');
create type public.work_intelligence_retention_mode as enum ('finite','indefinite');
create type public.work_intelligence_retention_disposition as enum ('anonymize','delete');
create type public.work_intelligence_retention_operation as enum ('retention','anonymization','deletion');

alter type public.knowledge_source_type add value if not exists 'work_intelligence';

alter table public.knowledge_evidence drop constraint if exists knowledge_evidence_evidence_type_check;
alter table public.knowledge_evidence add constraint knowledge_evidence_evidence_type_check
check(evidence_type in (
  'validated_entity',
  'validated_answer',
  'manual_validation',
  'connector_record',
  'inference',
  'confirmed_work_activity',
  'corrected_work_activity'
));

create table public.work_intelligence_retention_policies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  policy_key text not null check(policy_key ~ '^[a-z][a-z0-9_.:-]{2,119}$'),
  version integer not null check(version > 0),
  status text not null check(status in ('draft','published','archived')),
  pending_mode public.work_intelligence_retention_mode not null,
  pending_duration_days integer check(pending_duration_days is null or pending_duration_days > 0),
  pending_disposition public.work_intelligence_retention_disposition not null,
  confirmed_mode public.work_intelligence_retention_mode not null,
  confirmed_duration_days integer check(confirmed_duration_days is null or confirmed_duration_days > 0),
  confirmed_disposition public.work_intelligence_retention_disposition not null,
  superseded_mode public.work_intelligence_retention_mode not null,
  superseded_duration_days integer check(superseded_duration_days is null or superseded_duration_days > 0),
  superseded_disposition public.work_intelligence_retention_disposition not null,
  metadata_sanitization_policy_version text not null,
  created_by uuid not null references auth.users(id),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(organization_id,policy_key,version),
  unique(id,organization_id),
  check((pending_mode='finite') = (pending_duration_days is not null)),
  check((confirmed_mode='finite') = (confirmed_duration_days is not null)),
  check((superseded_mode='finite') = (superseded_duration_days is not null)),
  check((status='published') = (published_at is not null))
);

create table public.work_activities (
  id uuid primary key,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_id uuid not null,
  lineage_id uuid not null,
  version integer not null check(version > 0),
  supersedes_activity_id uuid,
  confirmation_state public.work_activity_confirmation_state not null,
  evidence_kind public.work_activity_evidence_kind not null,
  source public.work_activity_source not null,
  actor_role text not null check(length(actor_role) between 1 and 256),
  department_id uuid,
  activity_type text not null check(length(activity_type) between 1 and 128),
  original_description text,
  normalized_activity text not null check(length(normalized_activity) between 1 and 256),
  category text not null check(length(category) between 1 and 128),
  tools_json jsonb not null default '[]' check(jsonb_typeof(tools_json)='array'),
  started_at timestamptz not null,
  ended_at timestamptz not null,
  duration_minutes numeric(12,2) not null check(duration_minutes > 0),
  confidence numeric(5,2) not null check(confidence between 0 and 100),
  recurrence_hints_json jsonb not null default '[]' check(jsonb_typeof(recurrence_hints_json)='array'),
  human_judgment numeric(5,2) not null check(human_judgment between 0 and 100),
  operational_risk numeric(5,2) not null check(operational_risk between 0 and 100),
  metadata_json jsonb not null default '{}' check(jsonb_typeof(metadata_json)='object'),
  provenance_json jsonb not null check(jsonb_typeof(provenance_json)='array' and jsonb_array_length(provenance_json)>0),
  retention_policy_id uuid not null,
  retention_policy_version integer not null check(retention_policy_version > 0),
  captured_by uuid references auth.users(id),
  confirmed_by uuid references auth.users(id),
  confirmed_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key(organization_id,company_id) references public.companies(organization_id,id) on delete cascade,
  foreign key(retention_policy_id,organization_id) references public.work_intelligence_retention_policies(id,organization_id),
  foreign key(supersedes_activity_id,organization_id) references public.work_activities(id,organization_id) deferrable initially deferred,
  unique(organization_id,lineage_id,version),
  unique(id,organization_id,lineage_id,version),
  unique(id,organization_id),
  check(ended_at > started_at),
  check(version = 1 or supersedes_activity_id is not null),
  check(version > 1 or supersedes_activity_id is null),
  check(confirmation_state in ('CONFIRMED','CORRECTED') or confirmed_by is null),
  check(confirmation_state in ('CONFIRMED','CORRECTED') or confirmed_at is null),
  check(not (metadata_json ?| array['password','secret','token','authorization','cookie','api_key','apikey','employeeProductivityScore','employeeRanking','disciplinaryScore'])),
  check(original_description is null or length(original_description) <= 4000)
);

create table public.work_intelligence_retention_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  activity_id uuid,
  operation public.work_intelligence_retention_operation not null,
  policy_id uuid not null,
  policy_version integer not null check(policy_version > 0),
  actor_id uuid not null references auth.users(id),
  reason text not null check(length(reason) between 1 and 1000),
  metadata_json jsonb not null default '{}' check(jsonb_typeof(metadata_json)='object'),
  created_at timestamptz not null default now(),
  foreign key(activity_id,organization_id) references public.work_activities(id,organization_id),
  foreign key(policy_id,organization_id) references public.work_intelligence_retention_policies(id,organization_id)
);

create index work_activities_company_idx on public.work_activities(organization_id,company_id,started_at desc);
create index work_activities_lineage_idx on public.work_activities(organization_id,lineage_id,version desc);
create index work_activities_current_idx on public.work_activities(organization_id,company_id,lineage_id,version desc)
where confirmation_state in ('CONFIRMED','CORRECTED');
create index work_activities_retention_idx on public.work_activities(organization_id,retention_policy_id,retention_policy_version);
create index work_retention_events_activity_idx on public.work_intelligence_retention_events(organization_id,activity_id,created_at desc);

create trigger work_intelligence_retention_policies_set_updated_at
before update on public.work_intelligence_retention_policies
for each row execute function private.set_updated_at();

create function private.prevent_work_activity_mutation()
returns trigger language plpgsql set search_path = '' as $$
begin
  raise exception 'Work activity versions are immutable';
end $$;
revoke execute on function private.prevent_work_activity_mutation() from public,anon,authenticated;
create trigger work_activities_immutable before update on public.work_activities
for each row execute function private.prevent_work_activity_mutation();

create function private.prevent_work_activity_delete_when_referenced()
returns trigger language plpgsql set search_path = '' as $$
begin
  if exists (
    select 1
    from public.knowledge_evidence as evidence
    join public.knowledge_snapshots as snapshot
      on snapshot.id = evidence.snapshot_id
     and snapshot.organization_id = evidence.organization_id
    where evidence.organization_id = old.organization_id
      and evidence.source_record_id = old.id
      and evidence.source_record_type = 'work_activity_version'
      and snapshot.status = 'ready'
  ) then
    raise exception 'Referenced Work Intelligence evidence cannot be deleted';
  end if;
  return old;
end $$;
revoke execute on function private.prevent_work_activity_delete_when_referenced() from public,anon,authenticated;
create trigger work_activities_delete_protection before delete on public.work_activities
for each row execute function private.prevent_work_activity_delete_when_referenced();

do $$ declare t text; begin foreach t in array array[
  'work_intelligence_retention_policies','work_activities','work_intelligence_retention_events'
] loop execute format('alter table public.%I enable row level security',t); end loop; end $$;

create policy "members read work intelligence retention policies"
on public.work_intelligence_retention_policies for select to authenticated
using((select private.has_organization_role(work_intelligence_retention_policies.organization_id,array['owner','admin','consultant','viewer']::public.organization_role[])));
create policy "admins manage work intelligence retention policies"
on public.work_intelligence_retention_policies for all to authenticated
using((select private.has_organization_role(work_intelligence_retention_policies.organization_id,array['owner','admin']::public.organization_role[])))
with check((select private.has_organization_role(work_intelligence_retention_policies.organization_id,array['owner','admin']::public.organization_role[])));

create policy "members read work activities"
on public.work_activities for select to authenticated
using((select private.has_organization_role(work_activities.organization_id,array['owner','admin','consultant','viewer']::public.organization_role[])));
create policy "editors create work activities"
on public.work_activities for insert to authenticated
with check((select private.has_organization_role(work_activities.organization_id,array['owner','admin','consultant']::public.organization_role[])));
create policy "admins verify immutable work activities"
on public.work_activities for update to authenticated
using((select private.has_organization_role(work_activities.organization_id,array['owner','admin']::public.organization_role[])))
with check((select private.has_organization_role(work_activities.organization_id,array['owner','admin']::public.organization_role[])));
create policy "admins delete unprotected work activities"
on public.work_activities for delete to authenticated
using((select private.has_organization_role(work_activities.organization_id,array['owner','admin']::public.organization_role[])));

create policy "members read work retention events"
on public.work_intelligence_retention_events for select to authenticated
using((select private.has_organization_role(work_intelligence_retention_events.organization_id,array['owner','admin','consultant','viewer']::public.organization_role[])));
create policy "admins create work retention events"
on public.work_intelligence_retention_events for insert to authenticated
with check((select private.has_organization_role(work_intelligence_retention_events.organization_id,array['owner','admin']::public.organization_role[])));

grant select,insert,update,delete on public.work_activities to authenticated;
grant select,insert,update,delete on public.work_intelligence_retention_policies to authenticated;
grant select,insert on public.work_intelligence_retention_events to authenticated;
