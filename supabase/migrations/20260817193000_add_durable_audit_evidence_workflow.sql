create table public.audit_discovery_loops (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_id uuid not null,
  loop_id text not null check(length(loop_id) between 3 and 200),
  initial_brain_run_id text not null,
  current_brain_run_id text not null,
  iteration_number integer not null default 0 check(iteration_number >= 0),
  material_gap_ids_json jsonb not null default '[]' check(jsonb_typeof(material_gap_ids_json) = 'array'),
  resolved_gap_ids_json jsonb not null default '[]' check(jsonb_typeof(resolved_gap_ids_json) = 'array'),
  open_gap_ids_json jsonb not null default '[]' check(jsonb_typeof(open_gap_ids_json) = 'array'),
  pending_action_ids_json jsonb not null default '[]' check(jsonb_typeof(pending_action_ids_json) = 'array'),
  approved_action_ids_json jsonb not null default '[]' check(jsonb_typeof(approved_action_ids_json) = 'array'),
  executed_action_ids_json jsonb not null default '[]' check(jsonb_typeof(executed_action_ids_json) = 'array'),
  rejected_action_ids_json jsonb not null default '[]' check(jsonb_typeof(rejected_action_ids_json) = 'array'),
  stopping_state text not null check(stopping_state in (
    'READY_FOR_ANALYSIS',
    'READY_WITH_DECLARED_UNCERTAINTY',
    'CONTINUE_DISCOVERY',
    'BLOCKED_BY_CRITICAL_GAPS',
    'QUESTION_BUDGET_EXHAUSTED',
    'HUMAN_ESCALATION_REQUIRED'
  )),
  remaining_question_budget integer not null check(remaining_question_budget >= 0),
  canonical_refs_json jsonb not null default '{}' check(jsonb_typeof(canonical_refs_json) = 'object'),
  status text not null check(status in ('ACTIVE','STOPPED')),
  lock_version integer not null default 1 check(lock_version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key(organization_id,company_id) references public.companies(organization_id,id) on delete cascade,
  unique(organization_id,company_id,loop_id),
  unique(id,organization_id)
);

create table public.audit_discovery_action_executions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_id uuid not null,
  loop_id text not null,
  execution_id text not null,
  brain_run_id text not null,
  action_id text not null,
  status text not null check(status in ('PROPOSED','APPROVED','EXECUTED','REJECTED','STALE','UNSUPPORTED')),
  original_question_intent_json jsonb not null check(jsonb_typeof(original_question_intent_json) = 'object'),
  approved_question_text text,
  production_reference text,
  executed_by uuid references auth.users(id),
  rejection_reason text,
  notes text,
  authoritative_context_json jsonb not null default '{}' check(jsonb_typeof(authoritative_context_json) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key(organization_id,company_id) references public.companies(organization_id,id) on delete cascade,
  constraint audit_discovery_action_execution_identity_key unique(organization_id,company_id,execution_id),
  constraint audit_discovery_action_brain_action_key unique(organization_id,company_id,brain_run_id,action_id)
);

create table public.audit_discovery_response_processings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_id uuid not null,
  processing_id text not null,
  production_response_id text not null,
  result_json jsonb not null check(jsonb_typeof(result_json) = 'object'),
  created_at timestamptz not null default now(),
  foreign key(organization_id,company_id) references public.companies(organization_id,id) on delete cascade,
  unique(organization_id,company_id,processing_id)
);

create table public.audit_evidence_acquisition_requests (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_id uuid not null,
  request_id text not null,
  target text not null check(target in ('SYSTEM_EVIDENCE','KNOWLEDGE_DOCUMENT','PROCESS_EVIDENCE')),
  requested_evidence_type text not null,
  reason text not null,
  gap_id text not null,
  action_id text not null,
  status text not null check(status in ('REQUESTED','RECEIVED','INGESTED','REJECTED','CANCELLED')),
  requested_by uuid not null references auth.users(id),
  received_source_id uuid,
  authoritative_context_json jsonb not null default '{}' check(jsonb_typeof(authoritative_context_json) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key(organization_id,company_id) references public.companies(organization_id,id) on delete cascade,
  unique(organization_id,company_id,request_id),
  unique(id,organization_id)
);

create table public.audit_production_evidence_sources (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_id uuid not null,
  acquisition_request_id uuid,
  source_key text not null,
  source_version integer not null check(source_version > 0),
  source_type text not null,
  origin text not null,
  author_or_system text,
  raw_content text,
  structured_json jsonb,
  metadata_json jsonb not null default '{}' check(jsonb_typeof(metadata_json) = 'object'),
  received_at timestamptz not null,
  ingested_at timestamptz,
  created_at timestamptz not null default now(),
  foreign key(organization_id,company_id) references public.companies(organization_id,id) on delete cascade,
  foreign key(acquisition_request_id,organization_id) references public.audit_evidence_acquisition_requests(id,organization_id),
  unique(organization_id,company_id,source_key,source_version),
  unique(id,organization_id)
);

alter table public.audit_evidence_acquisition_requests
  add constraint audit_evidence_acquisition_received_source_fk
  foreign key(received_source_id,organization_id)
  references public.audit_production_evidence_sources(id,organization_id);

create table public.audit_production_evidence_records (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_id uuid not null,
  source_id uuid not null,
  evidence_key text not null,
  content text not null,
  structured_json jsonb,
  provenance_json jsonb not null default '{}' check(jsonb_typeof(provenance_json) = 'object'),
  confidence numeric(5,2) not null check(confidence between 0 and 1),
  created_at timestamptz not null default now(),
  foreign key(organization_id,company_id) references public.companies(organization_id,id) on delete cascade,
  foreign key(source_id,organization_id) references public.audit_production_evidence_sources(id,organization_id) on delete cascade,
  unique(organization_id,source_id,evidence_key)
);

create index audit_discovery_loops_company_idx on public.audit_discovery_loops(organization_id,company_id,updated_at desc);
create index audit_discovery_actions_loop_idx on public.audit_discovery_action_executions(organization_id,company_id,loop_id,status);
create index audit_evidence_requests_company_idx on public.audit_evidence_acquisition_requests(organization_id,company_id,status,updated_at desc);
create index audit_production_evidence_sources_request_idx on public.audit_production_evidence_sources(organization_id,acquisition_request_id);
create index audit_production_evidence_records_source_idx on public.audit_production_evidence_records(organization_id,source_id);

create trigger audit_discovery_loops_set_updated_at before update on public.audit_discovery_loops
for each row execute function private.set_updated_at();
create trigger audit_discovery_action_executions_set_updated_at before update on public.audit_discovery_action_executions
for each row execute function private.set_updated_at();
create trigger audit_evidence_acquisition_requests_set_updated_at before update on public.audit_evidence_acquisition_requests
for each row execute function private.set_updated_at();

do $$ declare t text; begin foreach t in array array[
  'audit_discovery_loops',
  'audit_discovery_action_executions',
  'audit_discovery_response_processings',
  'audit_evidence_acquisition_requests',
  'audit_production_evidence_sources',
  'audit_production_evidence_records'
] loop execute format('alter table public.%I enable row level security',t); end loop; end $$;

do $$ declare t text; begin foreach t in array array[
  'audit_discovery_loops',
  'audit_discovery_action_executions',
  'audit_discovery_response_processings',
  'audit_evidence_acquisition_requests',
  'audit_production_evidence_sources',
  'audit_production_evidence_records'
] loop
 execute format('create policy "members read %1$s" on public.%1$I for select to authenticated using ((select private.has_organization_role(%1$I.organization_id,array[''owner'',''admin'',''consultant'',''viewer'']::public.organization_role[])))',t);
 execute format('create policy "editors write %1$s" on public.%1$I for all to authenticated using ((select private.has_organization_role(%1$I.organization_id,array[''owner'',''admin'',''consultant'']::public.organization_role[]))) with check ((select private.has_organization_role(%1$I.organization_id,array[''owner'',''admin'',''consultant'']::public.organization_role[])))',t);
end loop; end $$;

grant select,insert,update,delete on
  public.audit_discovery_loops,
  public.audit_discovery_action_executions,
  public.audit_discovery_response_processings,
  public.audit_evidence_acquisition_requests,
  public.audit_production_evidence_sources,
  public.audit_production_evidence_records
to authenticated;
