create type public.ai_opportunity_status as enum ('draft','validated','published','archived');
create type public.ai_complexity as enum ('very_low','low','medium','high','very_high');
create type public.ai_risk as enum ('low','medium','high','critical');
create type public.ai_validation_severity as enum ('error','warning','information');

create table public.ai_capability_catalog (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  code text not null check(code ~ '^[a-z][a-z0-9_.]{2,119}$'),
  version integer not null check(version > 0),
  title text not null,
  description text not null,
  supported_findings jsonb not null default '[]' check(jsonb_typeof(supported_findings)='array'),
  required_inputs jsonb not null default '[]' check(jsonb_typeof(required_inputs)='array'),
  required_data jsonb not null default '[]' check(jsonb_typeof(required_data)='array'),
  expected_outputs jsonb not null default '[]' check(jsonb_typeof(expected_outputs)='array'),
  limitations jsonb not null default '[]' check(jsonb_typeof(limitations)='array'),
  implementation_complexity public.ai_complexity not null,
  confidence_rules jsonb not null check(jsonb_typeof(confidence_rules)='object'),
  published boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index ai_capabilities_system_version_idx on public.ai_capability_catalog(code,version) where organization_id is null;
create unique index ai_capabilities_org_version_idx on public.ai_capability_catalog(organization_id,code,version) where organization_id is not null;

create table public.ai_detection_rule_catalog (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  code text not null,
  version integer not null check(version > 0),
  title text not null,
  finding_codes jsonb not null check(jsonb_typeof(finding_codes)='array'),
  process_terms jsonb not null default '[]' check(jsonb_typeof(process_terms)='array'),
  knowledge_terms jsonb not null default '[]' check(jsonb_typeof(knowledge_terms)='array'),
  capability_codes jsonb not null check(jsonb_typeof(capability_codes)='array'),
  business_problem_template text not null,
  impact_template text not null,
  risk public.ai_risk not null,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index ai_detection_rules_system_version_idx on public.ai_detection_rule_catalog(code,version) where organization_id is null;
create unique index ai_detection_rules_org_version_idx on public.ai_detection_rule_catalog(organization_id,code,version) where organization_id is not null;

create table public.ai_score_definition_catalog (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  code text not null,
  version integer not null check(version > 0),
  title text not null,
  direction text not null check(direction in ('higher_is_better','higher_is_complexity')),
  formula_json jsonb not null check(jsonb_typeof(formula_json)='object'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index ai_scores_system_version_idx on public.ai_score_definition_catalog(code,version) where organization_id is null;
create unique index ai_scores_org_version_idx on public.ai_score_definition_catalog(organization_id,code,version) where organization_id is not null;

create table public.ai_opportunity_snapshots (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_id uuid not null,
  business_analysis_id uuid not null,
  process_map_id uuid not null,
  knowledge_snapshot_id uuid not null,
  previous_version_id uuid,
  version_number integer not null check(version_number > 0),
  status public.ai_opportunity_status not null default 'draft',
  lock_version integer not null default 1 check(lock_version > 0),
  catalog_versions_json jsonb not null check(jsonb_typeof(catalog_versions_json)='object'),
  provenance_json jsonb not null check(jsonb_typeof(provenance_json)='object'),
  created_by uuid not null references auth.users(id),
  validated_at timestamptz,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key(organization_id,company_id) references public.companies(organization_id,id) on delete cascade,
  foreign key(business_analysis_id,organization_id) references public.analysis_snapshots(id,organization_id),
  foreign key(process_map_id,organization_id) references public.process_maps(id,organization_id),
  foreign key(knowledge_snapshot_id,organization_id) references public.knowledge_snapshots(id,organization_id),
  foreign key(previous_version_id,organization_id) references public.ai_opportunity_snapshots(id,organization_id),
  unique(id,organization_id),
  unique(organization_id,business_analysis_id,version_number)
);

create table public.ai_opportunities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  snapshot_id uuid not null,
  detection_rule_id uuid not null references public.ai_detection_rule_catalog(id),
  identifier text not null,
  title text not null,
  description text not null,
  business_problem text not null,
  confidence numeric(5,2) not null check(confidence between 0 and 100),
  feasibility numeric(5,2) not null check(feasibility between 0 and 100),
  business_impact numeric(5,2) not null check(business_impact between 0 and 100),
  technical_complexity numeric(5,2) not null check(technical_complexity between 0 and 100),
  data_readiness numeric(5,2) not null check(data_readiness between 0 and 100),
  ai_readiness numeric(5,2) not null check(ai_readiness between 0 and 100),
  implementation_effort public.ai_complexity not null,
  risk public.ai_risk not null,
  affected_process_ids uuid[] not null default '{}',
  affected_department_ids uuid[] not null default '{}',
  affected_system_ids uuid[] not null default '{}',
  created_at timestamptz not null default now(),
  foreign key(snapshot_id,organization_id) references public.ai_opportunity_snapshots(id,organization_id) on delete cascade,
  unique(snapshot_id,identifier),
  unique(id,snapshot_id,organization_id)
);

create table public.ai_opportunity_capabilities (
  opportunity_id uuid not null,
  snapshot_id uuid not null,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  capability_id uuid not null references public.ai_capability_catalog(id),
  created_at timestamptz not null default now(),
  primary key(opportunity_id,capability_id),
  foreign key(opportunity_id,snapshot_id,organization_id) references public.ai_opportunities(id,snapshot_id,organization_id) on delete cascade
);
create table public.ai_opportunity_evidence (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null,
  snapshot_id uuid not null,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  business_finding_id uuid not null,
  knowledge_fact_id uuid not null references public.knowledge_facts(id),
  explanation text not null,
  evidence_json jsonb not null default '{}',
  created_at timestamptz not null default now(),
  foreign key(opportunity_id,snapshot_id,organization_id) references public.ai_opportunities(id,snapshot_id,organization_id) on delete cascade,
  foreign key(business_finding_id) references public.business_findings(id),
  unique(opportunity_id,business_finding_id,knowledge_fact_id)
);
create table public.ai_opportunity_scores (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null,
  snapshot_id uuid not null,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  score_definition_id uuid not null references public.ai_score_definition_catalog(id),
  score numeric(5,2) not null check(score between 0 and 100),
  calculation_json jsonb not null check(jsonb_typeof(calculation_json)='object'),
  created_at timestamptz not null default now(),
  foreign key(opportunity_id,snapshot_id,organization_id) references public.ai_opportunities(id,snapshot_id,organization_id) on delete cascade,
  unique(opportunity_id,score_definition_id)
);
create table public.ai_opportunity_prerequisites (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null,
  snapshot_id uuid not null,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  code text not null,
  description text not null,
  satisfied boolean not null,
  evidence_json jsonb not null default '{}',
  created_at timestamptz not null default now(),
  foreign key(opportunity_id,snapshot_id,organization_id) references public.ai_opportunities(id,snapshot_id,organization_id) on delete cascade,
  unique(opportunity_id,code)
);
create table public.ai_opportunity_validations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  snapshot_id uuid not null,
  code text not null,
  severity public.ai_validation_severity not null,
  message text not null,
  created_at timestamptz not null default now(),
  foreign key(snapshot_id,organization_id) references public.ai_opportunity_snapshots(id,organization_id) on delete cascade
);

create index ai_snapshots_company_status_idx on public.ai_opportunity_snapshots(organization_id,company_id,status,version_number desc);
create index ai_opportunities_snapshot_impact_idx on public.ai_opportunities(snapshot_id,business_impact desc);
create index ai_evidence_finding_idx on public.ai_opportunity_evidence(business_finding_id);
create trigger ai_capabilities_updated_at before update on public.ai_capability_catalog for each row execute function private.set_updated_at();
create trigger ai_detection_rules_updated_at before update on public.ai_detection_rule_catalog for each row execute function private.set_updated_at();
create trigger ai_score_definitions_updated_at before update on public.ai_score_definition_catalog for each row execute function private.set_updated_at();
create trigger ai_snapshots_updated_at before update on public.ai_opportunity_snapshots for each row execute function private.set_updated_at();

create function private.validate_ai_opportunity_source()
returns trigger language plpgsql set search_path='' as $$
begin
 if not exists(
   select 1 from public.analysis_snapshots a join public.process_maps p on p.id=a.process_map_id and p.organization_id=a.organization_id
   where a.id=new.business_analysis_id and a.organization_id=new.organization_id and a.company_id=new.company_id
   and a.status='published' and p.status='published' and p.id=new.process_map_id
   and a.knowledge_snapshot_id=new.knowledge_snapshot_id
 ) then raise exception 'AI Opportunity requires published Analysis, published Process Map and referenced Knowledge snapshot'; end if;
 return new;
end $$;
revoke execute on function private.validate_ai_opportunity_source() from public,anon,authenticated;
create trigger ai_opportunity_source_valid before insert on public.ai_opportunity_snapshots for each row execute function private.validate_ai_opportunity_source();

create function private.prevent_frozen_ai_catalog_mutation()
returns trigger language plpgsql set search_path='' as $$
declare catalog_key text;
begin
 if tg_table_name='ai_capability_catalog' and old.published then
   raise exception 'Published AI capability versions are immutable';
 end if;
 catalog_key:=case tg_table_name
   when 'ai_capability_catalog' then 'capabilities'
   when 'ai_detection_rule_catalog' then 'detectionRules'
   else 'scoreDefinitions'
 end;
 if exists(
   select 1 from public.ai_opportunity_snapshots s
   where s.catalog_versions_json @> jsonb_build_object(catalog_key,jsonb_build_array(jsonb_build_object('id',old.id::text)))
 ) then raise exception 'AI catalog versions referenced by a snapshot are immutable'; end if;
 if tg_op='DELETE' then return old; else return new; end if;
end $$;
revoke execute on function private.prevent_frozen_ai_catalog_mutation() from public,anon,authenticated;
create trigger ai_capabilities_immutable before update or delete on public.ai_capability_catalog for each row execute function private.prevent_frozen_ai_catalog_mutation();
create trigger ai_detection_rules_immutable before update or delete on public.ai_detection_rule_catalog for each row execute function private.prevent_frozen_ai_catalog_mutation();
create trigger ai_score_definitions_immutable before update or delete on public.ai_score_definition_catalog for each row execute function private.prevent_frozen_ai_catalog_mutation();

create function private.prevent_published_ai_opportunity_mutation()
returns trigger language plpgsql security definer set search_path='' as $$
declare sid uuid; frozen boolean;
begin
 if tg_table_name='ai_opportunity_snapshots' then
   if old.status='published' then raise exception 'Published AI opportunity snapshots are immutable'; end if;
   if tg_op='DELETE' then return old; else return new; end if;
 end if;
 if tg_op='DELETE' then sid:=old.snapshot_id; else sid:=new.snapshot_id; end if;
 select exists(select 1 from public.ai_opportunity_snapshots where id=sid and status='published') into frozen;
 if frozen then raise exception 'Published AI opportunity snapshots are immutable'; end if;
 if tg_op='DELETE' then return old; else return new; end if;
end $$;
revoke execute on function private.prevent_published_ai_opportunity_mutation() from public,anon,authenticated;
create trigger ai_snapshots_immutable before update or delete on public.ai_opportunity_snapshots for each row execute function private.prevent_published_ai_opportunity_mutation();
do $$ declare t text; begin foreach t in array array['ai_opportunities','ai_opportunity_capabilities','ai_opportunity_evidence','ai_opportunity_scores','ai_opportunity_prerequisites','ai_opportunity_validations'] loop
 execute format('create trigger %I_immutable before insert or update or delete on public.%I for each row execute function private.prevent_published_ai_opportunity_mutation()',t,t);
end loop; end $$;

do $$ declare t text; begin foreach t in array array['ai_capability_catalog','ai_detection_rule_catalog','ai_score_definition_catalog','ai_opportunity_snapshots','ai_opportunities','ai_opportunity_capabilities','ai_opportunity_evidence','ai_opportunity_scores','ai_opportunity_prerequisites','ai_opportunity_validations'] loop execute format('alter table public.%I enable row level security',t); end loop; end $$;
do $$ declare t text; begin foreach t in array array['ai_capability_catalog','ai_detection_rule_catalog','ai_score_definition_catalog'] loop
 execute format('create policy "members read %1$s" on public.%1$I for select to authenticated using(%1$I.organization_id is null or (select private.has_organization_role(%1$I.organization_id,array[''owner'',''admin'',''consultant'',''viewer'']::public.organization_role[])))',t);
 execute format('create policy "admins manage %1$s" on public.%1$I for all to authenticated using(%1$I.organization_id is not null and (select private.has_organization_role(%1$I.organization_id,array[''owner'',''admin'']::public.organization_role[]))) with check(%1$I.organization_id is not null and (select private.has_organization_role(%1$I.organization_id,array[''owner'',''admin'']::public.organization_role[])))',t);
end loop; end $$;
do $$ declare t text; begin foreach t in array array['ai_opportunities','ai_opportunity_capabilities','ai_opportunity_evidence','ai_opportunity_scores','ai_opportunity_prerequisites','ai_opportunity_validations'] loop
 execute format('create policy "members read %1$s" on public.%1$I for select to authenticated using((select private.has_organization_role(%1$I.organization_id,array[''owner'',''admin'',''consultant'',''viewer'']::public.organization_role[])))',t);
 execute format('create policy "editors manage %1$s" on public.%1$I for all to authenticated using((select private.has_organization_role(%1$I.organization_id,array[''owner'',''admin'',''consultant'']::public.organization_role[]))) with check((select private.has_organization_role(%1$I.organization_id,array[''owner'',''admin'',''consultant'']::public.organization_role[])))',t);
end loop; end $$;
create policy "members read ai snapshots" on public.ai_opportunity_snapshots for select to authenticated using((select private.has_organization_role(ai_opportunity_snapshots.organization_id,array['owner','admin','consultant','viewer']::public.organization_role[])));
create policy "editors create ai snapshots" on public.ai_opportunity_snapshots for insert to authenticated with check((select private.has_organization_role(ai_opportunity_snapshots.organization_id,array['owner','admin','consultant']::public.organization_role[])));
create policy "editors update ai snapshots" on public.ai_opportunity_snapshots for update to authenticated
using((select private.has_organization_role(ai_opportunity_snapshots.organization_id,array['owner','admin','consultant']::public.organization_role[])))
with check((select private.has_organization_role(ai_opportunity_snapshots.organization_id,array['owner','admin','consultant']::public.organization_role[])) and (ai_opportunity_snapshots.status<>'published' or (select private.has_organization_role(ai_opportunity_snapshots.organization_id,array['owner','admin']::public.organization_role[]))));
create policy "editors delete ai snapshots" on public.ai_opportunity_snapshots for delete to authenticated using((select private.has_organization_role(ai_opportunity_snapshots.organization_id,array['owner','admin','consultant']::public.organization_role[])));
grant select,insert,update,delete on public.ai_capability_catalog,public.ai_detection_rule_catalog,public.ai_score_definition_catalog,public.ai_opportunity_snapshots,public.ai_opportunities,public.ai_opportunity_capabilities,public.ai_opportunity_evidence,public.ai_opportunity_scores,public.ai_opportunity_prerequisites,public.ai_opportunity_validations to authenticated;

insert into public.ai_capability_catalog(code,version,title,description,supported_findings,required_inputs,required_data,expected_outputs,limitations,implementation_complexity,confidence_rules,published) values
('ocr',1,'OCR','Extract text from scanned documents','["manual_invoice_processing","paper_document"]','["document"]','["representative_documents"]','["machine_readable_text"]','["scan quality and handwriting affect accuracy"]','medium','{"minimumEvidence":1}',true),
('document_classification',1,'Document Classification','Classify business documents','["manual_document_transfer"]','["document"]','["labeled_documents"]','["document_category"]','["requires stable categories"]','medium','{"minimumEvidence":1}',true),
('natural_language_processing',1,'Natural Language Processing','Analyze unstructured language','[]','["text"]','["representative_text"]','["structured_language_features"]','["domain vocabulary requires validation"]','medium','{"minimumEvidence":1}',true),
('speech_to_text',1,'Speech-to-Text','Transcribe speech','[]','["audio"]','["representative_audio"]','["transcript"]','["noise and accents affect accuracy"]','medium','{"minimumEvidence":1}',true),
('text_classification',1,'Text Classification','Classify text and CVs','["recruitment_process"]','["text"]','["labeled_text"]','["class"]','["requires labels"]','medium','{"minimumEvidence":1}',true),
('information_extraction',1,'Information Extraction','Extract structured fields','["manual_invoice_processing","recruitment_process"]','["text"]','["field_examples"]','["structured_fields"]','["schema changes require retraining"]','high','{"minimumEvidence":1}',true),
('image_classification',1,'Image Classification','Classify images','[]','["image"]','["labeled_images"]','["class"]','["requires representative images"]','high','{"minimumEvidence":1}',true),
('computer_vision',1,'Computer Vision','Analyze visual operations','[]','["image_or_video"]','["visual_examples"]','["visual_events"]','["privacy and environment constraints"]','very_high','{"minimumEvidence":1}',true),
('forecasting',1,'Forecasting','Forecast demand and business metrics','["excel_dependency","missing_kpi","inventory_process"]','["time_series"]','["historical_data"]','["forecast"]','["requires sufficient history"]','high','{"minimumEvidence":1}',true),
('anomaly_detection',1,'Anomaly Detection','Detect unusual financial patterns','["financial_approval"]','["transactions"]','["historical_transactions"]','["anomaly_score"]','["false positives require review"]','very_high','{"minimumEvidence":1}',true),
('recommendation_systems',1,'Recommendation Systems','Suggest relevant actions','["excel_dependency"]','["events"]','["historical_choices"]','["ranked_options"]','["feedback loops require governance"]','high','{"minimumEvidence":1}',true),
('semantic_search',1,'Semantic Search','Search by meaning','["missing_documentation"]','["documents"]','["indexed_documents"]','["ranked_results"]','["access controls must propagate"]','medium','{"minimumEvidence":1}',true),
('generative_ai',1,'Generative AI','Draft controlled business content','["missing_documentation"]','["source_content"]','["approved_knowledge"]','["draft_content"]','["human validation remains mandatory"]','high','{"minimumEvidence":1}',true),
('knowledge_assistant',1,'Knowledge Assistant','Assist people using governed knowledge','["repeated_validation","human_bottleneck","high_manual_workload"]','["question","knowledge"]','["approved_knowledge"]','["assisted_answer"]','["must cite sources and allow escalation"]','high','{"minimumEvidence":1}',true),
('email_classification',1,'Email Classification','Route and classify emails','["email_dependency"]','["email"]','["labeled_emails"]','["category_and_route"]','["privacy and retention constraints"]','medium','{"minimumEvidence":1}',true),
('chatbot',1,'Chatbot','Assist customer support','["customer_support_process"]','["customer_message"]','["support_knowledge"]','["response_or_escalation"]','["must support human handoff"]','high','{"minimumEvidence":1}',true),
('meeting_summarization',1,'Meeting Summarization','Summarize meetings','[]','["transcript"]','["meeting_examples"]','["summary"]','["decisions require human validation"]','medium','{"minimumEvidence":1}',true),
('translation',1,'Translation','Translate controlled content','[]','["text"]','["terminology"]','["translated_text"]','["legal content requires review"]','medium','{"minimumEvidence":1}',true),
('sentiment_analysis',1,'Sentiment Analysis','Classify expressed sentiment','[]','["text"]','["representative_feedback"]','["sentiment"]','["cultural context affects results"]','medium','{"minimumEvidence":1}',true);

insert into public.ai_detection_rule_catalog(code,version,title,finding_codes,process_terms,knowledge_terms,capability_codes,business_problem_template,impact_template,risk) values
('invoice_intelligence',1,'Invoice intelligence','["manual_invoice_processing"]','[]','[]','["ocr","information_extraction"]','Invoices are processed manually.','Reduce manual extraction and re-entry.','medium'),
('email_triage',1,'Email triage','["email_dependency"]','[]','[]','["email_classification"]','Operational work depends on email.','Classify and route incoming messages.','medium'),
('validation_assistant',1,'Validation assistant','["repeated_validation"]','[]','[]','["knowledge_assistant"]','Validation is repeated.','Assist reviewers with governed context.','medium'),
('documentation_drafting',1,'Documentation drafting','["missing_documentation"]','[]','[]','["generative_ai"]','Documentation is missing.','Draft procedures from approved knowledge.','high'),
('paper_digitization',1,'Paper digitization','["paper_document"]','[]','[]','["ocr"]','Paper documents block digital flow.','Create machine-readable inputs.','medium'),
('spreadsheet_intelligence',1,'Spreadsheet intelligence','["excel_dependency"]','[]','[]','["forecasting","recommendation_systems"]','Decision work depends on spreadsheets.','Forecast and suggest options from governed history.','high'),
('document_routing',1,'Document routing','["manual_document_transfer"]','[]','[]','["document_classification"]','Documents are transferred manually.','Classify documents for controlled routing.','medium'),
('bottleneck_assistant',1,'Bottleneck assistant','["human_bottleneck"]','[]','[]','["knowledge_assistant"]','Knowledge is concentrated on one person.','Assist execution while preserving escalation.','high'),
('workload_assistant',1,'Workload assistant','["high_manual_workload"]','[]','[]','["knowledge_assistant"]','Manual workload is high.','Assist repeatable knowledge work.','high'),
('predictive_kpi',1,'Predictive KPI','["missing_kpi"]','[]','[]','["forecasting"]','The process has no KPI.','Prepare forecastable measurements.','high'),
('support_chatbot',1,'Customer support chatbot','[]','["support","customer support"]','[]','["chatbot"]','Customer support contains repeatable questions.','Provide governed first-line assistance.','high'),
('cv_classification',1,'CV classification','[]','["recruitment","recruit"]','[]','["text_classification","information_extraction"]','Recruitment requires CV review.','Extract and classify candidate information.','high'),
('demand_forecasting',1,'Demand forecasting','[]','["inventory","stock"]','[]','["forecasting"]','Inventory decisions require demand anticipation.','Forecast demand from historical data.','high'),
('fraud_detection',1,'Financial approval anomaly detection','["missing_approval"]','["finance","invoice","payment"]','[]','["anomaly_detection"]','Financial approvals need anomaly controls.','Flag unusual transactions for human review.','critical');

insert into public.ai_score_definition_catalog(code,version,title,direction,formula_json) values
('business_impact',1,'Business Impact','higher_is_better','{"type":"severity_mapping","critical":100,"high":75,"medium":50,"low":25,"information":10}'),
('implementation_complexity',1,'Implementation Complexity','higher_is_complexity','{"type":"complexity_mapping","very_low":20,"low":40,"medium":60,"high":80,"very_high":100}'),
('data_readiness',1,'Data Readiness','higher_is_better','{"type":"required_data_coverage","formula":"satisfied_required_data_weight / total_required_data_weight * 100"}'),
('confidence',1,'Confidence','higher_is_better','{"type":"weighted_mean","inputs":["finding_confidence","evidence_confidence"]}'),
('feasibility',1,'Feasibility','higher_is_better','{"type":"weighted_sum","data_readiness":0.35,"confidence":0.25,"inverse_complexity":0.25,"process_confidence":0.15}'),
('ai_readiness',1,'AI Readiness','higher_is_better','{"type":"mean","inputs":["data_readiness","feasibility","knowledge_confidence"]}');
