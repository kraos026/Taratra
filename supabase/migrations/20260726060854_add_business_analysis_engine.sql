create type public.analysis_status as enum ('draft','validated','published','archived');
create type public.finding_severity as enum ('critical','high','medium','low','information');
create type public.analysis_validation_severity as enum ('error','warning','information');

create table public.analysis_rule_catalog (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  code text not null check (code ~ '^[a-z][a-z0-9_.]{2,119}$'),
  version integer not null check (version > 0),
  title text not null,
  description text not null,
  severity public.finding_severity not null,
  category text not null,
  industry_scope jsonb not null default '[]' check (jsonb_typeof(industry_scope) = 'array'),
  required_facts jsonb not null default '[]' check (jsonb_typeof(required_facts) = 'array'),
  evaluation_logic jsonb not null check (jsonb_typeof(evaluation_logic) = 'object'),
  explanation_template text not null,
  recommendation_hint text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index analysis_rules_system_version_idx
  on public.analysis_rule_catalog(code,version) where organization_id is null;
create unique index analysis_rules_org_version_idx
  on public.analysis_rule_catalog(organization_id,code,version) where organization_id is not null;

create table public.analysis_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_id uuid not null,
  process_map_id uuid not null,
  knowledge_snapshot_id uuid not null,
  previous_version_id uuid,
  version_number integer not null check (version_number > 0),
  status public.analysis_status not null default 'draft',
  lock_version integer not null default 1 check (lock_version > 0),
  ruleset_json jsonb not null check (jsonb_typeof(ruleset_json) = 'array'),
  provenance_json jsonb not null check (jsonb_typeof(provenance_json) = 'object'),
  created_by uuid not null references auth.users(id),
  validated_at timestamptz,
  published_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id,company_id) references public.companies(organization_id,id) on delete cascade,
  foreign key (process_map_id,organization_id) references public.process_maps(id,organization_id),
  foreign key (knowledge_snapshot_id,organization_id) references public.knowledge_snapshots(id,organization_id),
  foreign key (previous_version_id,organization_id) references public.analysis_snapshots(id,organization_id),
  unique (id,organization_id),
  unique (organization_id,process_map_id,version_number)
);

create table public.business_findings (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  analysis_snapshot_id uuid not null,
  rule_id uuid not null references public.analysis_rule_catalog(id),
  identifier text not null,
  title text not null,
  description text not null,
  severity public.finding_severity not null,
  category text not null,
  related_process_map_id uuid not null,
  related_step_id uuid,
  related_department_knowledge_node_id uuid,
  related_actor_knowledge_node_id uuid,
  related_system_knowledge_node_id uuid,
  confidence_percentage numeric(5,2) not null check (confidence_percentage between 0 and 100),
  business_impact text not null,
  risk_points numeric(8,2) not null default 0 check (risk_points >= 0),
  created_at timestamptz not null default now(),
  foreign key (analysis_snapshot_id,organization_id) references public.analysis_snapshots(id,organization_id) on delete cascade,
  foreign key (related_process_map_id,organization_id) references public.process_maps(id,organization_id),
  unique (analysis_snapshot_id,identifier),
  unique (id,analysis_snapshot_id,organization_id)
);

create table public.finding_evidence (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  analysis_snapshot_id uuid not null,
  finding_id uuid not null,
  knowledge_fact_id uuid not null,
  evidence_type text not null,
  explanation text not null,
  value_json jsonb not null default '{}',
  created_at timestamptz not null default now(),
  foreign key (finding_id,analysis_snapshot_id,organization_id)
    references public.business_findings(id,analysis_snapshot_id,organization_id) on delete cascade,
  foreign key (knowledge_fact_id) references public.knowledge_facts(id),
  unique (finding_id,knowledge_fact_id,evidence_type)
);

create table public.business_scores (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  analysis_snapshot_id uuid not null,
  code text not null,
  label text not null,
  score numeric(5,2) not null check (score between 0 and 100),
  direction text not null check (direction in ('higher_is_better','higher_is_exposure')),
  calculation_json jsonb not null check (jsonb_typeof(calculation_json) = 'object'),
  created_at timestamptz not null default now(),
  foreign key (analysis_snapshot_id,organization_id) references public.analysis_snapshots(id,organization_id) on delete cascade,
  unique (analysis_snapshot_id,code)
);

create table public.business_health (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  analysis_snapshot_id uuid not null,
  dimension text not null,
  scope_type text not null check (scope_type in ('organization','department','process','system')),
  scope_reference_id uuid,
  score numeric(5,2) not null check (score between 0 and 100),
  calculation_json jsonb not null check (jsonb_typeof(calculation_json) = 'object'),
  created_at timestamptz not null default now(),
  foreign key (analysis_snapshot_id,organization_id) references public.analysis_snapshots(id,organization_id) on delete cascade,
  unique (analysis_snapshot_id,dimension,scope_type,scope_reference_id)
);

create table public.analysis_validations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  analysis_snapshot_id uuid not null,
  code text not null,
  severity public.analysis_validation_severity not null,
  message text not null,
  metadata_json jsonb not null default '{}',
  created_at timestamptz not null default now(),
  foreign key (analysis_snapshot_id,organization_id) references public.analysis_snapshots(id,organization_id) on delete cascade
);

create index analysis_snapshots_company_status_idx
  on public.analysis_snapshots(organization_id,company_id,status,version_number desc);
create index analysis_snapshots_process_idx on public.analysis_snapshots(process_map_id,version_number desc);
create index findings_analysis_severity_idx on public.business_findings(analysis_snapshot_id,severity,category);
create index evidence_fact_idx on public.finding_evidence(knowledge_fact_id);
create index scores_analysis_idx on public.business_scores(analysis_snapshot_id);
create index health_analysis_idx on public.business_health(analysis_snapshot_id);

create trigger analysis_rule_catalog_set_updated_at before update on public.analysis_rule_catalog
for each row execute function private.set_updated_at();
create trigger analysis_snapshots_set_updated_at before update on public.analysis_snapshots
for each row execute function private.set_updated_at();

create function private.validate_analysis_source()
returns trigger language plpgsql set search_path='' as $$
begin
  if not exists (
    select 1 from public.process_maps p
    where p.id=new.process_map_id
      and p.organization_id=new.organization_id
      and p.company_id=new.company_id
      and p.knowledge_snapshot_id=new.knowledge_snapshot_id
      and p.status='published'
  ) then
    raise exception 'Analysis requires a published Process Map and its referenced Knowledge snapshot';
  end if;
  return new;
end $$;
revoke execute on function private.validate_analysis_source() from public,anon,authenticated;
create trigger analysis_source_valid before insert on public.analysis_snapshots
for each row execute function private.validate_analysis_source();

create function private.prevent_published_analysis_mutation()
returns trigger language plpgsql security definer set search_path='' as $$
declare parent_id uuid; frozen boolean;
begin
  if tg_table_name = 'analysis_snapshots' then
    if old.status = 'published' then raise exception 'Published analyses are immutable'; end if;
    if tg_op = 'DELETE' then return old; else return new; end if;
  end if;
  if tg_op = 'DELETE' then parent_id := old.analysis_snapshot_id; else parent_id := new.analysis_snapshot_id; end if;
  select exists(select 1 from public.analysis_snapshots where id=parent_id and status='published') into frozen;
  if frozen then raise exception 'Published analyses are immutable'; end if;
  if tg_op = 'DELETE' then return old; else return new; end if;
end $$;
revoke execute on function private.prevent_published_analysis_mutation() from public,anon,authenticated;
create trigger analysis_snapshots_immutable before update or delete on public.analysis_snapshots
for each row execute function private.prevent_published_analysis_mutation();
do $$ declare t text; begin
  foreach t in array array['business_findings','finding_evidence','business_scores','business_health','analysis_validations'] loop
    execute format('create trigger %I_immutable before insert or update or delete on public.%I for each row execute function private.prevent_published_analysis_mutation()',t,t);
  end loop;
end $$;

create function private.prevent_analysis_rule_mutation()
returns trigger language plpgsql set search_path='' as $$
begin
  if exists(select 1 from public.analysis_snapshots s where s.ruleset_json @> jsonb_build_array(jsonb_build_object('id',old.id::text))) then
    raise exception 'Analysis rule versions referenced by a snapshot are immutable';
  end if;
  if tg_op='DELETE' then return old; else return new; end if;
end $$;
revoke execute on function private.prevent_analysis_rule_mutation() from public,anon,authenticated;
create trigger analysis_rules_immutable before update or delete on public.analysis_rule_catalog
for each row execute function private.prevent_analysis_rule_mutation();

do $$ declare t text; begin
  foreach t in array array['analysis_rule_catalog','analysis_snapshots','business_findings','finding_evidence','business_scores','business_health','analysis_validations'] loop
    execute format('alter table public.%I enable row level security',t);
  end loop;
end $$;
create policy "members read analysis rules" on public.analysis_rule_catalog for select to authenticated
using (analysis_rule_catalog.organization_id is null or
  (select private.has_organization_role(analysis_rule_catalog.organization_id,array['owner','admin','consultant','viewer']::public.organization_role[])));
create policy "admins manage analysis rules" on public.analysis_rule_catalog for all to authenticated
using (analysis_rule_catalog.organization_id is not null and
  (select private.has_organization_role(analysis_rule_catalog.organization_id,array['owner','admin']::public.organization_role[])))
with check (analysis_rule_catalog.organization_id is not null and
  (select private.has_organization_role(analysis_rule_catalog.organization_id,array['owner','admin']::public.organization_role[])));
do $$ declare t text; begin
  foreach t in array array['business_findings','finding_evidence','business_scores','business_health','analysis_validations'] loop
    execute format('create policy "members read %1$s" on public.%1$I for select to authenticated using((select private.has_organization_role(%1$I.organization_id,array[''owner'',''admin'',''consultant'',''viewer'']::public.organization_role[])))',t);
    execute format('create policy "editors create %1$s" on public.%1$I for insert to authenticated with check((select private.has_organization_role(%1$I.organization_id,array[''owner'',''admin'',''consultant'']::public.organization_role[])))',t);
    execute format('create policy "editors update %1$s" on public.%1$I for update to authenticated using((select private.has_organization_role(%1$I.organization_id,array[''owner'',''admin'',''consultant'']::public.organization_role[]))) with check((select private.has_organization_role(%1$I.organization_id,array[''owner'',''admin'',''consultant'']::public.organization_role[])))',t);
    execute format('create policy "editors delete %1$s" on public.%1$I for delete to authenticated using((select private.has_organization_role(%1$I.organization_id,array[''owner'',''admin'',''consultant'']::public.organization_role[])))',t);
  end loop;
end $$;
create policy "members read analysis snapshots" on public.analysis_snapshots for select to authenticated
using ((select private.has_organization_role(analysis_snapshots.organization_id,array['owner','admin','consultant','viewer']::public.organization_role[])));
create policy "editors create analysis snapshots" on public.analysis_snapshots for insert to authenticated
with check ((select private.has_organization_role(analysis_snapshots.organization_id,array['owner','admin','consultant']::public.organization_role[])));
create policy "editors update analysis snapshots" on public.analysis_snapshots for update to authenticated
using ((select private.has_organization_role(analysis_snapshots.organization_id,array['owner','admin','consultant']::public.organization_role[])))
with check (
  (select private.has_organization_role(analysis_snapshots.organization_id,array['owner','admin','consultant']::public.organization_role[]))
  and (
    analysis_snapshots.status <> 'published'
    or (select private.has_organization_role(analysis_snapshots.organization_id,array['owner','admin']::public.organization_role[]))
  )
);
create policy "editors delete analysis snapshots" on public.analysis_snapshots for delete to authenticated
using ((select private.has_organization_role(analysis_snapshots.organization_id,array['owner','admin','consultant']::public.organization_role[])));
grant select,insert,update,delete on public.analysis_rule_catalog,public.analysis_snapshots,
  public.business_findings,public.finding_evidence,public.business_scores,public.business_health,
  public.analysis_validations to authenticated;

insert into public.analysis_rule_catalog
(code,version,title,description,severity,category,required_facts,evaluation_logic,explanation_template,recommendation_hint)
values
('duplicate_manual_entry',1,'Duplicate manual entry','Detects repeated manual activities.','high','efficiency','[]','{"operator":"duplicateManualStep","minimum":2}','{count} manual steps share the same normalized name.','Remove duplicate entry points.'),
('single_point_of_failure',1,'Single point of failure','Detects concentration of manual work on one actor.','critical','risk','[]','{"operator":"actorManualShare","minimumSteps":3,"threshold":50}','{actor} performs {share}% of manual steps.','Add coverage and delegation.'),
('missing_process_owner',1,'Missing process owner','Detects a process without an owner.','high','ownership','[]','{"operator":"missingOwner"}','No owner is assigned to the process.','Assign an accountable owner.'),
('missing_approval',1,'Missing approval','Detects financial or payment processes without approval.','critical','governance','[]','{"operator":"missingApproval","processTerms":["invoice","payment","facture","paiement"]}','A financial process has no approval step or edge.','Define an approval control.'),
('long_approval_chain',1,'Long approval chain','Detects at least three approvals.','medium','efficiency','[]','{"operator":"approvalCount","minimum":3}','The process contains {count} approval steps.','Simplify the approval chain.'),
('manual_document_transfer',1,'Manual document transfer','Detects documents moved by manual steps.','medium','digitalization','[]','{"operator":"manualDocumentTransfer"}','A document is transferred manually.','Digitize document transfers.'),
('manual_invoice_processing',1,'Manual invoice processing','Detects manual invoice activities.','high','efficiency','[]','{"operator":"manualInvoice"}','Invoice processing contains manual work.','Automate invoice processing.'),
('excel_dependency',1,'Excel dependency','Detects Microsoft Excel dependencies.','medium','systems','[]','{"operator":"systemContains","terms":["excel"]}','The process depends on Excel.','Assess a governed business system.'),
('email_dependency',1,'Email dependency','Detects email dependencies.','medium','systems','[]','{"operator":"systemContains","terms":["email","outlook","gmail"]}','The process depends on email.','Centralize workflow communication.'),
('paper_document',1,'Paper document','Detects paper or physical documents.','medium','digitalization','[]','{"operator":"textContains","terms":["paper","papier","physical","physique"]}','The process uses paper documents.','Digitize documents.'),
('missing_business_system',1,'Missing business system','Detects a process without a supporting system.','high','systems','[]','{"operator":"missingSystem"}','No supporting business system is linked.','Select a supporting system.'),
('missing_documentation',1,'Missing documentation','Detects more than 30% undocumented steps.','medium','documentation','[]','{"operator":"undocumentedShare","threshold":30}','{share}% of steps lack documentation.','Document operating procedures.'),
('disconnected_process',1,'Disconnected process','Detects graph validation connectivity errors.','high','quality','[]','{"operator":"validationCode","codes":["orphan_activity","missing_start","missing_end"]}','The process graph is disconnected or incomplete.','Repair process connectivity.'),
('high_manual_workload',1,'High manual workload','Detects at least 40 manual hours per month.','high','efficiency','[]','{"operator":"manualHoursMonthly","threshold":40}','Estimated manual workload is {hours} hours per month.','Reduce high-volume manual work.'),
('low_confidence_process',1,'Low confidence process','Detects confidence below 70%.','medium','data_quality','[]','{"operator":"processMetricBelow","metric":"confidence","threshold":70}','Process confidence is {value}%.','Collect stronger evidence.'),
('incomplete_process',1,'Incomplete process','Detects completeness below 80%.','high','quality','[]','{"operator":"processMetricBelow","metric":"completeness","threshold":80}','Process completeness is {value}%.','Complete the process model.'),
('missing_kpi',1,'Missing KPI','Detects absence of KPI facts.','medium','measurement','["kpi","metric","indicator","target"]','{"operator":"missingKnowledgeTerm","terms":["kpi","metric","indicator","target"]}','No KPI evidence is attached to the process.','Define a measurable KPI.'),
('repeated_validation',1,'Repeated validation','Detects at least three validation activities.','medium','efficiency','[]','{"operator":"validationStepCount","minimum":3}','The process repeats {count} validations.','Consolidate validation controls.'),
('human_bottleneck',1,'Human bottleneck','Detects one actor with at least 60% of manual duration.','critical','risk','[]','{"operator":"actorManualDurationShare","threshold":60}','{actor} carries {share}% of manual duration.','Redistribute or automate the bottleneck.');
