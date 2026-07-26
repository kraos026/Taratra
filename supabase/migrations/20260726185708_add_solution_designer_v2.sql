create type public.solution_blueprint_status as enum ('draft','validated','published','archived');
create type public.solution_validation_severity as enum ('error','warning','information');

create table public.solution_pattern_catalog(
 id uuid primary key default gen_random_uuid(), organization_id uuid references public.organizations(id),
 code text not null, version integer not null check(version>0), name text not null, description text not null,
 recommendation_categories jsonb not null check(jsonb_typeof(recommendation_categories)='array'),
 template_json jsonb not null check(jsonb_typeof(template_json)='object'), published boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique nulls not distinct(code,version,organization_id)
);
create table public.solution_capability_catalog(
 id uuid primary key default gen_random_uuid(), organization_id uuid references public.organizations(id),
 code text not null, version integer not null check(version>0), name text not null,
 cost_level text not null check(cost_level in('basic','intermediate','advanced')),
 cost_index numeric(12,2) not null check(cost_index>=0), published boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique nulls not distinct(code,version,organization_id)
);
create table public.solution_connector_requirement_catalog(
 id uuid primary key default gen_random_uuid(), organization_id uuid references public.organizations(id),
 code text not null, version integer not null check(version>0), name text not null,
 cost_level text not null check(cost_level in('simple','medium','complex')),
 cost_index numeric(12,2) not null check(cost_index>=0), capabilities jsonb not null, secrets jsonb not null,
 permissions jsonb not null, inputs jsonb not null, outputs jsonb not null, published boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique nulls not distinct(code,version,organization_id)
);
create table public.solution_constraint_catalog(
 id uuid primary key default gen_random_uuid(), organization_id uuid references public.organizations(id),
 code text not null, version integer not null check(version>0), name text not null,
 published boolean not null default false, created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(), unique nulls not distinct(code,version,organization_id)
);
create table public.solution_validation_rule_catalog(
 id uuid primary key default gen_random_uuid(), organization_id uuid references public.organizations(id),
 code text not null, version integer not null check(version>0), name text not null, description text not null,
 published boolean not null default false, created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(), unique nulls not distinct(code,version,organization_id)
);
create table public.solution_blueprints(
 id uuid primary key default gen_random_uuid(), organization_id uuid not null, company_id uuid not null,
 recommendation_id uuid not null, recommendation_snapshot_id uuid not null, roi_snapshot_id uuid not null,
 automation_opportunity_id uuid not null, automation_opportunity_snapshot_id uuid not null,
 pattern_id uuid not null references public.solution_pattern_catalog(id), previous_version_id uuid references public.solution_blueprints(id),
 version_number integer not null check(version_number>0), status public.solution_blueprint_status not null default 'draft',
 lock_version integer not null default 1, name text not null, description text not null, objective text not null,
 architecture text not null, components_json jsonb not null, capabilities_json jsonb not null,
 connectors_json jsonb not null, constraints_json jsonb not null, assumptions_json jsonb not null,
 secrets_json jsonb not null, permissions_json jsonb not null, inputs_json jsonb not null, outputs_json jsonb not null,
 topology_json jsonb not null, dependencies_json jsonb not null, risks_json jsonb not null,
 final_risk numeric(5,2) not null check(final_risk between 0 and 100),
 estimated_technical_cost_index numeric(12,2) not null check(estimated_technical_cost_index>=0),
 complexity_score numeric(5,2) not null check(complexity_score between 0 and 100),
 catalog_versions_json jsonb not null, provenance_json jsonb not null, created_by uuid not null,
 validated_at timestamptz, published_at timestamptz, created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(), unique(id,organization_id),
 unique(organization_id,recommendation_id,version_number),
 foreign key(company_id,organization_id) references public.companies(id,organization_id),
 foreign key(recommendation_id,recommendation_snapshot_id,organization_id)
  references public.transformation_recommendations(id,snapshot_id,organization_id),
 foreign key(roi_snapshot_id,organization_id) references public.roi_evaluation_snapshots(id,organization_id),
 foreign key(automation_opportunity_id,automation_opportunity_snapshot_id,organization_id)
  references public.automation_opportunities(id,snapshot_id,organization_id)
);
create table public.solution_blueprint_evidence(
 id uuid primary key default gen_random_uuid(), organization_id uuid not null, blueprint_id uuid not null,
 recommendation_evidence_id uuid not null references public.transformation_recommendation_evidence(id),
 explanation text not null, created_at timestamptz not null default now(),
 unique(blueprint_id,recommendation_evidence_id),
 foreign key(blueprint_id,organization_id) references public.solution_blueprints(id,organization_id) on delete cascade
);
create table public.solution_blueprint_validations(
 id uuid primary key default gen_random_uuid(), organization_id uuid not null, blueprint_id uuid not null,
 code text not null, severity public.solution_validation_severity not null, message text not null,
 created_at timestamptz not null default now(),
 foreign key(blueprint_id,organization_id) references public.solution_blueprints(id,organization_id) on delete cascade
);

do $$ declare t text; begin
 foreach t in array array['solution_pattern_catalog','solution_capability_catalog','solution_connector_requirement_catalog','solution_constraint_catalog','solution_validation_rule_catalog','solution_blueprints']
 loop execute format('create trigger %I_updated_at before update on public.%I for each row execute function private.set_updated_at()',t,t); end loop;
end $$;

create function private.validate_solution_blueprint_sources() returns trigger language plpgsql set search_path='' as $$
begin
 if not exists(
  select 1 from public.transformation_recommendations r
  join public.recommendation_portfolio_snapshots rs on rs.id=r.snapshot_id and rs.organization_id=r.organization_id
  join public.roi_evaluation_snapshots roi on roi.id=r.roi_snapshot_id and roi.organization_id=r.organization_id
  join public.automation_opportunity_snapshots au on au.id=r.automation_opportunity_snapshot_id and au.organization_id=r.organization_id
  where r.id=new.recommendation_id and r.snapshot_id=new.recommendation_snapshot_id
   and r.organization_id=new.organization_id and rs.company_id=new.company_id and rs.status='published'
   and roi.id=new.roi_snapshot_id and roi.status='published'
   and r.automation_opportunity_id=new.automation_opportunity_id
   and au.id=new.automation_opportunity_snapshot_id and au.status='published'
 ) then raise exception 'Solution Blueprint requires aligned published canonical sources'; end if;
 return new;
end $$;
revoke execute on function private.validate_solution_blueprint_sources() from public,anon,authenticated;
create trigger solution_blueprint_sources_valid before insert on public.solution_blueprints
for each row execute function private.validate_solution_blueprint_sources();

create function private.validate_solution_blueprint_evidence_scope() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if not exists(
  select 1
  from public.solution_blueprints b
  join public.transformation_recommendation_evidence e
   on e.id=new.recommendation_evidence_id
   and e.organization_id=b.organization_id
   and e.recommendation_id=b.recommendation_id
  where b.id=new.blueprint_id and b.organization_id=new.organization_id
 ) then raise exception 'Solution Blueprint evidence must belong to its canonical recommendation and tenant'; end if;
 return new;
end $$;
revoke execute on function private.validate_solution_blueprint_evidence_scope() from public,anon,authenticated;
create trigger solution_blueprint_evidence_scope before insert or update on public.solution_blueprint_evidence
for each row execute function private.validate_solution_blueprint_evidence_scope();

create function private.prevent_solution_catalog_mutation() returns trigger language plpgsql set search_path='' as $$
begin
 if old.published then raise exception 'Published Solution Designer catalog versions are immutable'; end if;
 if tg_op='DELETE' then return old; else return new; end if;
end $$;
revoke execute on function private.prevent_solution_catalog_mutation() from public,anon,authenticated;
do $$ declare t text; begin
 foreach t in array array['solution_pattern_catalog','solution_capability_catalog','solution_connector_requirement_catalog','solution_constraint_catalog','solution_validation_rule_catalog']
 loop execute format('create trigger %I_immutable before update or delete on public.%I for each row execute function private.prevent_solution_catalog_mutation()',t,t); end loop;
end $$;

create function private.prevent_published_solution_blueprint_mutation() returns trigger
language plpgsql security definer set search_path='' as $$
declare blueprint uuid;
begin
 if tg_table_name='solution_blueprints' then
  if old.status='published' then raise exception 'Published Solution Blueprints are immutable'; end if;
  if tg_op='DELETE' then return old; else return new; end if;
 end if;
 blueprint:=case when tg_op='DELETE' then old.blueprint_id else new.blueprint_id end;
 if exists(select 1 from public.solution_blueprints b where b.id=blueprint and b.status='published')
 then raise exception 'Published Solution Blueprints are immutable'; end if;
 if tg_op='DELETE' then return old; else return new; end if;
end $$;
revoke execute on function private.prevent_published_solution_blueprint_mutation() from public,anon,authenticated;
create trigger solution_blueprints_immutable before update or delete on public.solution_blueprints
for each row execute function private.prevent_published_solution_blueprint_mutation();
create trigger solution_blueprint_evidence_immutable before insert or update or delete on public.solution_blueprint_evidence
for each row execute function private.prevent_published_solution_blueprint_mutation();
create trigger solution_blueprint_validations_immutable before insert or update or delete on public.solution_blueprint_validations
for each row execute function private.prevent_published_solution_blueprint_mutation();

do $$ declare t text; begin
 foreach t in array array['solution_pattern_catalog','solution_capability_catalog','solution_connector_requirement_catalog','solution_constraint_catalog','solution_validation_rule_catalog','solution_blueprints','solution_blueprint_evidence','solution_blueprint_validations']
 loop execute format('alter table public.%I enable row level security',t); end loop;
end $$;
do $$ declare t text; begin
 foreach t in array array['solution_pattern_catalog','solution_capability_catalog','solution_connector_requirement_catalog','solution_constraint_catalog','solution_validation_rule_catalog']
 loop
  execute format('create policy "members read %1$s" on public.%1$I for select to authenticated using(%1$I.organization_id is null or (select private.has_organization_role(%1$I.organization_id,array[''owner'',''admin'',''consultant'',''viewer'']::public.organization_role[])))',t);
  execute format('create policy "admins manage %1$s" on public.%1$I for all to authenticated using(%1$I.organization_id is not null and (select private.has_organization_role(%1$I.organization_id,array[''owner'',''admin'']::public.organization_role[]))) with check(%1$I.organization_id is not null and (select private.has_organization_role(%1$I.organization_id,array[''owner'',''admin'']::public.organization_role[])))',t);
 end loop;
end $$;
create policy "members read solution_blueprints" on public.solution_blueprints
for select to authenticated
using((select private.has_organization_role(solution_blueprints.organization_id,array['owner','admin','consultant','viewer']::public.organization_role[])));
create policy "editors insert solution_blueprints" on public.solution_blueprints
for insert to authenticated
with check((select private.has_organization_role(solution_blueprints.organization_id,array['owner','admin','consultant']::public.organization_role[])));
create policy "editors update solution_blueprints" on public.solution_blueprints
for update to authenticated
using((select private.has_organization_role(solution_blueprints.organization_id,array['owner','admin','consultant']::public.organization_role[])))
with check(
 (select private.has_organization_role(solution_blueprints.organization_id,array['owner','admin','consultant']::public.organization_role[]))
 and (
  solution_blueprints.status <> 'published'
  or (select private.has_organization_role(solution_blueprints.organization_id,array['owner','admin']::public.organization_role[]))
 )
);
create policy "editors delete solution_blueprints" on public.solution_blueprints
for delete to authenticated
using((select private.has_organization_role(solution_blueprints.organization_id,array['owner','admin','consultant']::public.organization_role[])));

do $$ declare t text; begin
 foreach t in array array['solution_blueprint_evidence','solution_blueprint_validations']
 loop
  execute format('create policy "members read %1$s" on public.%1$I for select to authenticated using((select private.has_organization_role(%1$I.organization_id,array[''owner'',''admin'',''consultant'',''viewer'']::public.organization_role[])))',t);
  execute format('create policy "editors manage %1$s" on public.%1$I for all to authenticated using((select private.has_organization_role(%1$I.organization_id,array[''owner'',''admin'',''consultant'']::public.organization_role[]))) with check((select private.has_organization_role(%1$I.organization_id,array[''owner'',''admin'',''consultant'']::public.organization_role[])))',t);
 end loop;
end $$;
grant select,insert,update,delete on public.solution_pattern_catalog,public.solution_capability_catalog,
 public.solution_connector_requirement_catalog,public.solution_constraint_catalog,public.solution_validation_rule_catalog,
 public.solution_blueprints,public.solution_blueprint_evidence,public.solution_blueprint_validations to authenticated;

insert into public.solution_capability_catalog(code,version,name,cost_level,cost_index,published) values
('api_client',1,'API Client','intermediate',15,true),('webhook',1,'Webhook','basic',5,true),
('scheduler',1,'Scheduler','basic',5,true),('queue',1,'Queue','intermediate',15,true),
('email_receiver',1,'Email Receiver','intermediate',15,true),('email_sender',1,'Email Sender','intermediate',15,true),
('document_parser',1,'Document Parser','intermediate',15,true),('ocr',1,'OCR','advanced',30,true),
('information_extraction',1,'Information Extraction','advanced',30,true),('text_classification',1,'Text Classification','advanced',30,true),
('llm_gateway',1,'LLM Gateway','advanced',30,true),('knowledge_search',1,'Knowledge Search','advanced',30,true),
('human_approval',1,'Human Approval','intermediate',15,true),('notification',1,'Notification','basic',5,true),
('relational_database',1,'Relational Database','intermediate',15,true),('object_storage',1,'Object Storage','intermediate',15,true),
('cache',1,'Cache','intermediate',15,true),('identity_provider',1,'Identity Provider','advanced',30,true),
('secrets_manager',1,'Secrets Manager','advanced',30,true),('logging',1,'Logging','basic',5,true),
('monitoring',1,'Monitoring','intermediate',15,true),('analytics',1,'Analytics','advanced',30,true),
('search_engine',1,'Search Engine','advanced',30,true),('message_broker',1,'Message Broker','advanced',30,true),
('file_storage',1,'File Storage','basic',5,true);

insert into public.solution_constraint_catalog(code,version,name,published) values
('authentication_required',1,'Authentication Required',true),('authorization_required',1,'Authorization Required',true),
('secret_required',1,'Secret Required',true),('external_api',1,'External API',true),('rate_limit',1,'Rate Limit',true),
('gdpr',1,'GDPR',true),('audit_trail',1,'Audit Trail',true),('encryption',1,'Encryption',true),
('pii_handling',1,'PII Handling',true),('high_availability',1,'High Availability',true),
('backup_required',1,'Backup Required',true),('disaster_recovery',1,'Disaster Recovery',true),
('multi_tenant',1,'Multi Tenant',true),('idempotency',1,'Idempotency',true),
('retry_policy',1,'Retry Policy',true),('observability',1,'Observability',true);

insert into public.solution_validation_rule_catalog(code,version,name,description,published)
select lower(replace(name,' ','_')),1,name,name,true from unnest(array[
'Known Pattern','Known Capability','Known Constraint','No Orphan Component','No Cycle',
'All Inputs Connected','All Outputs Connected','Required Secret Present','Required Permission Present',
'Evidence Present','Published Recommendation','Published ROI','Published Automation Opportunity']) name;

insert into public.solution_connector_requirement_catalog
(code,version,name,cost_level,cost_index,capabilities,secrets,permissions,inputs,outputs,published) values
('generic_rest_api',1,'Generic REST API','medium',25,'["api_client"]','["API credential"]','["api.read","api.write"]','["API request"]','["API response"]',true),
('generic_webhook',1,'Generic Webhook','simple',10,'["webhook"]','["Webhook signing secret"]','["webhook.receive"]','["Webhook event"]','["Acknowledgement"]',true),
('generic_email_inbox',1,'Generic Email Inbox','medium',25,'["email_receiver"]','["Mailbox credentials"]','["email.read"]','["Mailbox"]','["Email message"]',true),
('generic_email_outbox',1,'Generic Email Outbox','medium',25,'["email_sender"]','["Mailbox credentials"]','["email.send"]','["Email message"]','["Delivery status"]',true),
('generic_relational_database',1,'Generic Relational Database','complex',50,'["relational_database"]','["Database connection secret"]','["database.read","database.write"]','["Query or record"]','["Dataset or persisted record"]',true),
('generic_object_storage',1,'Generic Object Storage','medium',25,'["object_storage"]','["Storage credential"]','["object.read","object.write"]','["File or object"]','["Stored object reference"]',true),
('generic_file_storage',1,'Generic File Storage','simple',10,'["file_storage"]','["Storage credential"]','["file.read","file.write"]','["File"]','["File reference"]',true),
('generic_identity_provider',1,'Generic Identity Provider','complex',50,'["identity_provider"]','["OAuth client secret"]','["identity.authenticate","identity.authorize"]','["Authentication request"]','["Identity token"]',true),
('generic_secrets_provider',1,'Generic Secrets Provider','complex',50,'["secrets_manager"]','["Bootstrap credential"]','["secret.read"]','["Secret identifier"]','["Secret value"]',true),
('generic_llm_provider',1,'Generic LLM Provider','complex',50,'["llm_gateway"]','["LLM provider API key"]','["llm.invoke"]','["Prompt or structured request"]','["Completion or structured response"]',true),
('generic_ocr_provider',1,'Generic OCR Provider','complex',50,'["ocr"]','["OCR provider API key"]','["ocr.invoke"]','["Document or image"]','["Extracted text"]',true),
('generic_search_provider',1,'Generic Search Provider','complex',50,'["knowledge_search","search_engine"]','["Search credential"]','["search.read","search.write"]','["Query or indexed document"]','["Search results or index status"]',true),
('generic_queue_provider',1,'Generic Queue Provider','medium',25,'["queue"]','["Queue credential"]','["queue.publish","queue.consume"]','["Message"]','["Delivery acknowledgement"]',true),
('generic_message_broker',1,'Generic Message Broker','complex',50,'["message_broker"]','["Broker credential"]','["broker.publish","broker.subscribe"]','["Event"]','["Delivery acknowledgement"]',true),
('generic_monitoring_provider',1,'Generic Monitoring Provider','medium',25,'["monitoring"]','["Monitoring credential"]','["metrics.write","metrics.read"]','["Metrics"]','["Health or alert status"]',true),
('generic_logging_provider',1,'Generic Logging Provider','simple',10,'["logging"]','["Logging credential"]','["logs.write","logs.read"]','["Log event"]','["Log reference"]',true),
('generic_analytics_provider',1,'Generic Analytics Provider','complex',50,'["analytics"]','["Analytics credential"]','["analytics.read","analytics.write"]','["Dataset"]','["Analysis result"]',true),
('generic_notification_provider',1,'Generic Notification Provider','simple',10,'["notification"]','["Notification credential"]','["notification.send"]','["Notification message"]','["Delivery status"]',true),
('generic_scheduler_provider',1,'Generic Scheduler Provider','simple',10,'["scheduler"]','[]','["schedule.create"]','["Schedule definition"]','["Trigger event"]',true),
('generic_human_approval_channel',1,'Generic Human Approval Channel','medium',25,'["human_approval"]','[]','["approval.request","approval.respond"]','["Approval request"]','["Approval decision"]',true);

with patterns(code,name,categories,components,capabilities,connectors,constraints,secrets,permissions,edges,risks) as (values
('simple_automation','Simple Automation','["quick_wins","low_investment"]'::jsonb,
'[{"code":"trigger","name":"Trigger"},{"code":"action","name":"Action"}]'::jsonb,
'["scheduler","api_client","notification"]'::jsonb,
'[{"code":"generic_scheduler_provider"},{"code":"generic_rest_api"},{"code":"generic_notification_provider"}]'::jsonb,
'["authentication_required","authorization_required","idempotency","retry_policy","observability"]'::jsonb,
'["API credential","Notification credential"]'::jsonb,
'["schedule.create","api.read","api.write","notification.send"]'::jsonb,
'[{"from":"trigger","to":"action","type":"schedules","label":"Trigger schedules Action"},{"from":"action","to":"trigger","type":"notifies","label":"Action notifies completion"}]'::jsonb,
'[{"name":"External service dependency","severity":25,"costIndex":10},{"name":"Duplicate execution","severity":50,"costIndex":20},{"name":"Notification delivery failure","severity":25,"costIndex":10}]'::jsonb),
('workflow_automation','Workflow Automation','["automation_first","high_roi","operational_excellence"]',
'[{"code":"trigger","name":"Trigger"},{"code":"processor","name":"Processor"},{"code":"decision","name":"Decision"},{"code":"action","name":"Action"}]',
'["scheduler","queue","human_approval","api_client","notification","logging"]',
'[{"code":"generic_scheduler_provider"},{"code":"generic_queue_provider"},{"code":"generic_human_approval_channel"},{"code":"generic_rest_api"},{"code":"generic_notification_provider"},{"code":"generic_logging_provider"}]',
'["authentication_required","authorization_required","audit_trail","idempotency","retry_policy","observability"]',
'["API credential","Queue credential","Logging credential","Notification credential"]',
'["schedule.create","queue.publish","queue.consume","approval.request","approval.respond","api.read","api.write","notification.send","logs.write"]',
'[{"from":"trigger","to":"processor","type":"schedules","label":"Trigger schedules Processor"},{"from":"processor","to":"decision","type":"produces","label":"Processor produces Decision"},{"from":"decision","to":"action","type":"approves","label":"Decision approves Action"},{"from":"action","to":"decision","type":"notifies","label":"Action notifies completion"}]',
'[{"name":"Workflow interruption","severity":50,"costIndex":20},{"name":"Approval bottleneck","severity":50,"costIndex":20},{"name":"Duplicate execution","severity":50,"costIndex":20},{"name":"External service dependency","severity":50,"costIndex":20}]'),
('document_processing','Document Processing','[]',
'[{"code":"input","name":"Input"},{"code":"parser","name":"Parser"},{"code":"storage","name":"Storage"}]',
'["ocr","document_parser","information_extraction","object_storage","logging"]',
'[{"code":"generic_ocr_provider"},{"code":"generic_object_storage"},{"code":"generic_logging_provider"}]',
'["authentication_required","authorization_required","secret_required","encryption","pii_handling","audit_trail","retry_policy","observability"]',
'["OCR provider API key","Storage credential","Logging credential"]',
'["ocr.invoke","object.read","object.write","logs.write"]',
'[{"from":"input","to":"parser","type":"produces","label":"Input produces document for Parser"},{"from":"parser","to":"storage","type":"stores","label":"Parser stores structured document in Storage"}]',
'[{"name":"Sensitive document exposure","severity":75,"costIndex":40},{"name":"Extraction error","severity":50,"costIndex":20},{"name":"Data loss","severity":75,"costIndex":40},{"name":"Provider dependency","severity":50,"costIndex":20}]'),
('approval_workflow','Approval Workflow','[]',
'[{"code":"trigger","name":"Trigger"},{"code":"approval","name":"Approval"},{"code":"action","name":"Action"}]',
'["human_approval","notification","logging","api_client"]',
'[{"code":"generic_human_approval_channel"},{"code":"generic_rest_api"},{"code":"generic_notification_provider"},{"code":"generic_logging_provider"}]',
'["authentication_required","authorization_required","audit_trail","idempotency","observability"]',
'["API credential","Notification credential","Logging credential"]',
'["approval.request","approval.respond","api.read","api.write","notification.send","logs.write"]',
'[{"from":"trigger","to":"approval","type":"produces","label":"Trigger produces approval request"},{"from":"approval","to":"action","type":"approves","label":"Approval approves Action"},{"from":"action","to":"trigger","type":"notifies","label":"Action notifies result"}]',
'[{"name":"Unauthorized approval","severity":75,"costIndex":40},{"name":"Approval delay","severity":50,"costIndex":20},{"name":"Audit evidence missing","severity":75,"costIndex":40}]'),
('knowledge_assistant','Knowledge Assistant','["ai_first"]',
'[{"code":"interface","name":"Interface"},{"code":"retrieval","name":"Retrieval"},{"code":"llm","name":"LLM"},{"code":"response","name":"Response"},{"code":"identity","name":"Identity Provider"}]',
'["knowledge_search","search_engine","llm_gateway","identity_provider","logging","monitoring"]',
'[{"code":"generic_identity_provider"},{"code":"generic_search_provider"},{"code":"generic_llm_provider"},{"code":"generic_logging_provider"},{"code":"generic_monitoring_provider"}]',
'["authentication_required","authorization_required","secret_required","pii_handling","encryption","audit_trail","rate_limit","observability"]',
'["Search credential","LLM provider API key","OAuth client secret","Logging credential","Monitoring credential"]',
'["identity.authenticate","identity.authorize","search.read","llm.invoke","logs.write","metrics.write"]',
'[{"from":"interface","to":"identity","type":"authenticates","label":"Interface authenticates through Identity Provider"},{"from":"interface","to":"retrieval","type":"calls","label":"Interface calls Retrieval"},{"from":"retrieval","to":"llm","type":"calls","label":"Retrieval calls LLM"},{"from":"llm","to":"response","type":"produces","label":"LLM produces Response"}]',
'[{"name":"Unauthorized knowledge disclosure","severity":100,"costIndex":80},{"name":"Incorrect generated response","severity":75,"costIndex":40},{"name":"PII exposure","severity":100,"costIndex":80},{"name":"Provider dependency","severity":50,"costIndex":20},{"name":"Excessive usage cost","severity":50,"costIndex":20}]'),
('crm_synchronization','CRM Synchronization','[]',
'[{"code":"source","name":"Source"},{"code":"mapping","name":"Mapping"},{"code":"destination","name":"Destination"}]',
'["api_client","queue","logging","monitoring"]',
'[{"code":"generic_rest_api","role":"source"},{"code":"generic_rest_api","role":"destination"},{"code":"generic_queue_provider"},{"code":"generic_logging_provider"},{"code":"generic_monitoring_provider"}]',
'["authentication_required","authorization_required","secret_required","idempotency","retry_policy","rate_limit","audit_trail","observability"]',
'["API credential","Queue credential","Logging credential","Monitoring credential"]',
'["api.read","api.write","queue.publish","queue.consume","logs.write","metrics.write"]',
'[{"from":"source","to":"mapping","type":"produces","label":"Source produces records for Mapping"},{"from":"mapping","to":"destination","type":"calls","label":"Mapping transfers records to Destination"}]',
'[{"name":"Data inconsistency","severity":75,"costIndex":40},{"name":"Duplicate records","severity":50,"costIndex":20},{"name":"API rate-limit interruption","severity":50,"costIndex":20},{"name":"Unauthorized data access","severity":75,"costIndex":40}]'),
('erp_integration','ERP Integration','[]',
'[{"code":"source","name":"Source"},{"code":"validation","name":"Validation"},{"code":"destination","name":"Destination"}]',
'["api_client","queue","human_approval","logging","monitoring"]',
'[{"code":"generic_rest_api","role":"source"},{"code":"generic_rest_api","role":"destination"},{"code":"generic_queue_provider"},{"code":"generic_human_approval_channel"},{"code":"generic_logging_provider"},{"code":"generic_monitoring_provider"}]',
'["authentication_required","authorization_required","secret_required","audit_trail","idempotency","retry_policy","high_availability","observability"]',
'["API credential","Queue credential","Logging credential","Monitoring credential"]',
'["api.read","api.write","queue.publish","queue.consume","approval.request","approval.respond","logs.write","metrics.write"]',
'[{"from":"source","to":"validation","type":"produces","label":"Source produces transaction for Validation"},{"from":"validation","to":"destination","type":"approves","label":"Validation approves transfer to Destination"}]',
'[{"name":"Financial or operational data corruption","severity":100,"costIndex":80},{"name":"Integration outage","severity":75,"costIndex":40},{"name":"Unauthorized transaction","severity":100,"costIndex":80},{"name":"Approval bottleneck","severity":50,"costIndex":20}]'),
('inventory_synchronization','Inventory Synchronization','[]',
'[{"code":"source","name":"Source"},{"code":"sync","name":"Sync"},{"code":"storage","name":"Storage"}]',
'["api_client","queue","relational_database","logging","monitoring"]',
'[{"code":"generic_rest_api"},{"code":"generic_queue_provider"},{"code":"generic_relational_database"},{"code":"generic_logging_provider"},{"code":"generic_monitoring_provider"}]',
'["authentication_required","authorization_required","secret_required","idempotency","retry_policy","audit_trail","backup_required","observability"]',
'["API credential","Queue credential","Database connection secret","Logging credential","Monitoring credential"]',
'["api.read","queue.publish","queue.consume","database.read","database.write","logs.write","metrics.write"]',
'[{"from":"source","to":"sync","type":"produces","label":"Source produces inventory event for Sync"},{"from":"sync","to":"storage","type":"stores","label":"Sync transfers state to Storage"}]',
'[{"name":"Inventory inconsistency","severity":75,"costIndex":40},{"name":"Duplicate stock movement","severity":75,"costIndex":40},{"name":"Data loss","severity":75,"costIndex":40},{"name":"Synchronization delay","severity":50,"costIndex":20}]'),
('reporting_pipeline','Reporting Pipeline','[]',
'[{"code":"collector","name":"Collector"},{"code":"aggregator","name":"Aggregator"},{"code":"dashboard","name":"Dashboard"}]',
'["analytics","relational_database","notification","logging","monitoring"]',
'[{"code":"generic_relational_database"},{"code":"generic_analytics_provider"},{"code":"generic_notification_provider"},{"code":"generic_logging_provider"},{"code":"generic_monitoring_provider"}]',
'["authentication_required","authorization_required","audit_trail","backup_required","observability"]',
'["Database connection secret","Analytics credential","Notification credential","Logging credential","Monitoring credential"]',
'["database.read","database.write","analytics.read","analytics.write","notification.send","logs.write","metrics.write"]',
'[{"from":"collector","to":"aggregator","type":"stores","label":"Collector stores data"},{"from":"aggregator","to":"dashboard","type":"produces","label":"Aggregator produces report"},{"from":"dashboard","to":"collector","type":"notifies","label":"Dashboard notifies stakeholders"}]',
'[{"name":"Incorrect reporting","severity":75,"costIndex":40},{"name":"Stale data","severity":50,"costIndex":20},{"name":"Unauthorized report access","severity":75,"costIndex":40}]'),
('compliance_monitoring','Compliance Monitoring','["compliance","risk_reduction"]',
'[{"code":"collector","name":"Collector"},{"code":"validator","name":"Validator"},{"code":"report","name":"Report"}]',
'["logging","analytics","notification","relational_database","monitoring"]',
'[{"code":"generic_relational_database"},{"code":"generic_analytics_provider"},{"code":"generic_notification_provider"},{"code":"generic_logging_provider"},{"code":"generic_monitoring_provider"}]',
'["authentication_required","authorization_required","audit_trail","encryption","pii_handling","backup_required","disaster_recovery","observability"]',
'["Database connection secret","Analytics credential","Notification credential","Logging credential","Monitoring credential"]',
'["database.read","database.write","analytics.read","analytics.write","notification.send","logs.read","logs.write","metrics.write"]',
'[{"from":"collector","to":"validator","type":"stores","label":"Collector stores evidence"},{"from":"validator","to":"report","type":"produces","label":"Validator produces compliance result"},{"from":"report","to":"collector","type":"notifies","label":"Report notifies stakeholders"}]',
'[{"name":"Compliance breach undetected","severity":100,"costIndex":80},{"name":"Audit evidence loss","severity":100,"costIndex":80},{"name":"False compliance result","severity":75,"costIndex":40},{"name":"Unauthorized evidence access","severity":100,"costIndex":80}]'),
('forecasting','Forecasting','[]',
'[{"code":"data","name":"Data"},{"code":"model","name":"Model"},{"code":"output","name":"Output"}]',
'["analytics","relational_database","notification","monitoring"]',
'[{"code":"generic_relational_database"},{"code":"generic_analytics_provider"},{"code":"generic_notification_provider"},{"code":"generic_monitoring_provider"}]',
'["authentication_required","authorization_required","secret_required","audit_trail","backup_required","observability"]',
'["Database connection secret","Analytics credential","Notification credential","Monitoring credential"]',
'["database.read","analytics.read","analytics.write","notification.send","metrics.write"]',
'[{"from":"data","to":"model","type":"stores","label":"Data stores dataset"},{"from":"model","to":"output","type":"produces","label":"Model produces forecast"}]',
'[{"name":"Incorrect forecast","severity":75,"costIndex":40},{"name":"Insufficient data quality","severity":75,"costIndex":40},{"name":"Model drift","severity":50,"costIndex":20},{"name":"Unauthorized dataset access","severity":75,"costIndex":40}]'),
('customer_support','Customer Support','[]',
'[{"code":"intake","name":"Intake"},{"code":"assistant","name":"Assistant"},{"code":"escalation","name":"Escalation"}]',
'["llm_gateway","knowledge_search","human_approval","notification","logging","monitoring"]',
'[{"code":"generic_llm_provider"},{"code":"generic_search_provider"},{"code":"generic_human_approval_channel"},{"code":"generic_notification_provider"},{"code":"generic_logging_provider"},{"code":"generic_monitoring_provider"}]',
'["authentication_required","authorization_required","secret_required","pii_handling","rate_limit","audit_trail","observability"]',
'["LLM provider API key","Search credential","Notification credential","Logging credential","Monitoring credential"]',
'["llm.invoke","search.read","approval.request","approval.respond","notification.send","logs.write","metrics.write"]',
'[{"from":"intake","to":"assistant","type":"calls","label":"Intake calls Assistant"},{"from":"assistant","to":"escalation","type":"calls","label":"Assistant transfers unresolved request"},{"from":"escalation","to":"assistant","type":"approves","label":"Escalation approves response"}]',
'[{"name":"Incorrect customer response","severity":75,"costIndex":40},{"name":"PII disclosure","severity":100,"costIndex":80},{"name":"Escalation failure","severity":75,"costIndex":40},{"name":"Provider outage","severity":50,"costIndex":20}]'),
('notification_hub','Notification Hub','[]',
'[{"code":"event","name":"Event"},{"code":"dispatcher","name":"Dispatcher"}]',
'["queue","notification","logging","monitoring"]',
'[{"code":"generic_queue_provider"},{"code":"generic_notification_provider"},{"code":"generic_logging_provider"},{"code":"generic_monitoring_provider"}]',
'["authentication_required","authorization_required","retry_policy","rate_limit","observability"]',
'["Queue credential","Notification credential","Logging credential","Monitoring credential"]',
'["queue.publish","queue.consume","notification.send","logs.write","metrics.write"]',
'[{"from":"event","to":"dispatcher","type":"produces","label":"Event uses Queue"},{"from":"dispatcher","to":"event","type":"notifies","label":"Dispatcher notifies recipient"}]',
'[{"name":"Notification loss","severity":50,"costIndex":20},{"name":"Duplicate notification","severity":25,"costIndex":10},{"name":"Delivery delay","severity":50,"costIndex":20}]'),
('master_data_synchronization','Master Data Synchronization','[]',
'[{"code":"source","name":"Source"},{"code":"validation","name":"Validation"},{"code":"repository","name":"Repository"}]',
'["api_client","relational_database","logging","monitoring","human_approval"]',
'[{"code":"generic_rest_api"},{"code":"generic_relational_database"},{"code":"generic_human_approval_channel"},{"code":"generic_logging_provider"},{"code":"generic_monitoring_provider"}]',
'["authentication_required","authorization_required","secret_required","audit_trail","idempotency","backup_required","high_availability","observability"]',
'["API credential","Database connection secret","Logging credential","Monitoring credential"]',
'["api.read","database.read","database.write","approval.request","approval.respond","logs.write","metrics.write"]',
'[{"from":"source","to":"validation","type":"produces","label":"Source produces master record"},{"from":"validation","to":"repository","type":"approves","label":"Validation approves Repository update"}]',
'[{"name":"Master data corruption","severity":100,"costIndex":80},{"name":"Duplicate master record","severity":75,"costIndex":40},{"name":"Unauthorized modification","severity":100,"costIndex":80},{"name":"Repository outage","severity":75,"costIndex":40}]'),
('enterprise_transformation','Enterprise Transformation','["strategic_projects","long_term"]',
'[{"code":"intake","name":"Intake"},{"code":"orchestrator","name":"Orchestrator"},{"code":"integration","name":"Integration"},{"code":"monitoring","name":"Monitoring"},{"code":"identity","name":"Identity Provider"}]',
'["queue","api_client","human_approval","logging","monitoring","analytics","identity_provider","secrets_manager"]',
'[{"code":"generic_identity_provider"},{"code":"generic_secrets_provider"},{"code":"generic_queue_provider"},{"code":"generic_human_approval_channel"},{"code":"generic_rest_api"},{"code":"generic_logging_provider"},{"code":"generic_monitoring_provider"},{"code":"generic_analytics_provider"}]',
'["authentication_required","authorization_required","secret_required","audit_trail","encryption","pii_handling","high_availability","backup_required","disaster_recovery","multi_tenant","idempotency","retry_policy","observability"]',
'["OAuth client secret","Bootstrap credential","Queue credential","API credential","Logging credential","Monitoring credential","Analytics credential"]',
'["identity.authenticate","identity.authorize","secret.read","queue.publish","queue.consume","approval.request","approval.respond","api.read","api.write","logs.write","metrics.read","metrics.write","analytics.read","analytics.write"]',
'[{"from":"intake","to":"identity","type":"authenticates","label":"Intake authenticates"},{"from":"intake","to":"orchestrator","type":"calls","label":"Intake triggers Orchestrator"},{"from":"orchestrator","to":"integration","type":"approves","label":"Orchestrator approves Integration"},{"from":"integration","to":"monitoring","type":"calls","label":"Integration calls external systems"}]',
'[{"name":"Cross-system outage","severity":100,"costIndex":80},{"name":"Unauthorized privileged action","severity":100,"costIndex":80},{"name":"Data leakage","severity":100,"costIndex":80},{"name":"Partial deployment or inconsistent state","severity":100,"costIndex":80},{"name":"Vendor or provider dependency","severity":75,"costIndex":40}]')
)
insert into public.solution_pattern_catalog(code,version,name,description,recommendation_categories,template_json,published)
select code,1,name,name,categories,jsonb_build_object(
 'components',components,'capabilities',capabilities,'connectors',connectors,'constraints',constraints,
 'secrets',secrets,'permissions',permissions,'edges',edges,'risks',risks,
 'normalization',jsonb_build_object(
  'componentFactor',10,'connectorFactor',15,'dependencyFactor',10,'constraintFactor',20,
  'weights',jsonb_build_object('components',0.40,'connectors',0.30,'dependencies',0.20,'constraints',0.10),
  'complexityCostFactor',0.5,
  'dependencyEdgeTypes',jsonb_build_array('produces','consumes','calls','stores','approves','schedules')
 )
),true from patterns;
