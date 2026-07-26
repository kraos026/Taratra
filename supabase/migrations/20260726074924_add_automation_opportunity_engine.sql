create type public.automation_opportunity_status as enum ('draft','validated','published','archived');
create type public.automation_complexity as enum ('very_low','low','medium','high','very_high');
create type public.automation_validation_severity as enum ('error','warning','information');

create table public.automation_pattern_catalog (
 id uuid primary key default gen_random_uuid(), organization_id uuid references public.organizations(id),
 code text not null, version integer not null check(version>0), title text not null, description text not null,
 supported_findings jsonb not null default '[]' check(jsonb_typeof(supported_findings)='array'),
 supported_ai_capabilities jsonb not null default '[]' check(jsonb_typeof(supported_ai_capabilities)='array'),
 required_systems jsonb not null default '[]' check(jsonb_typeof(required_systems)='array'),
 required_inputs jsonb not null default '[]' check(jsonb_typeof(required_inputs)='array'),
 trigger_types jsonb not null default '[]' check(jsonb_typeof(trigger_types)='array'),
 actions jsonb not null default '[]' check(jsonb_typeof(actions)='array'),
 outputs jsonb not null default '[]' check(jsonb_typeof(outputs)='array'),
 limitations jsonb not null default '[]' check(jsonb_typeof(limitations)='array'),
 complexity public.automation_complexity not null, published boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique nulls not distinct(code,version,organization_id)
);
create table public.automation_connector_catalog (
 id uuid primary key default gen_random_uuid(), organization_id uuid references public.organizations(id),
 code text not null, version integer not null check(version>0), title text not null,
 aliases jsonb not null default '[]' check(jsonb_typeof(aliases)='array'),
 limitations jsonb not null default '[]' check(jsonb_typeof(limitations)='array'),
 published boolean not null default false, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique nulls not distinct(code,version,organization_id)
);
create table public.automation_detection_rule_catalog (
 id uuid primary key default gen_random_uuid(), organization_id uuid references public.organizations(id),
 code text not null, version integer not null check(version>0), title text not null,
 finding_codes jsonb not null check(jsonb_typeof(finding_codes)='array'),
 ai_capability_codes jsonb not null default '[]' check(jsonb_typeof(ai_capability_codes)='array'),
 pattern_code text not null, connector_codes jsonb not null default '[]' check(jsonb_typeof(connector_codes)='array'),
 trigger_type text not null check(trigger_type in ('Manual','Scheduled','Webhook','API','Database Event','Email Received','File Uploaded','Form Submitted','Approval')),
 actions jsonb not null check(jsonb_typeof(actions)='array'), business_problem_template text not null,
 impact_template text not null, active boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique nulls not distinct(code,version,organization_id)
);
create table public.automation_score_definition_catalog (
 id uuid primary key default gen_random_uuid(), organization_id uuid references public.organizations(id),
 code text not null, version integer not null check(version>0), title text not null, direction text not null,
 formula_json jsonb not null check(jsonb_typeof(formula_json)='object'), active boolean not null default true,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique nulls not distinct(code,version,organization_id)
);
create table public.automation_opportunity_snapshots (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 company_id uuid not null, ai_opportunity_snapshot_id uuid not null, business_analysis_id uuid not null,
 process_map_id uuid not null, knowledge_snapshot_id uuid not null, previous_version_id uuid references public.automation_opportunity_snapshots(id),
 version_number integer not null check(version_number>0), status public.automation_opportunity_status not null default 'draft',
 lock_version integer not null default 1 check(lock_version>0), catalog_versions_json jsonb not null,
 provenance_json jsonb not null, created_by uuid not null, validated_at timestamptz, published_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(id,organization_id), unique(organization_id,ai_opportunity_snapshot_id,version_number),
 foreign key(company_id,organization_id) references public.companies(id,organization_id),
 foreign key(ai_opportunity_snapshot_id,organization_id) references public.ai_opportunity_snapshots(id,organization_id)
);
create table public.automation_opportunities (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 snapshot_id uuid not null, detection_rule_id uuid not null references public.automation_detection_rule_catalog(id),
 pattern_id uuid not null references public.automation_pattern_catalog(id), identifier text not null, title text not null,
 description text not null, business_problem text not null, trigger_type text not null,
 actions_json jsonb not null, outputs_json jsonb not null, business_impact numeric(5,2) not null check(business_impact between 0 and 100),
 automation_coverage numeric(5,2) not null check(automation_coverage between 0 and 100),
 technical_feasibility numeric(5,2) not null check(technical_feasibility between 0 and 100),
 connector_availability numeric(5,2) not null check(connector_availability between 0 and 100),
 automation_readiness numeric(5,2) not null check(automation_readiness between 0 and 100),
 complexity_score numeric(5,2) not null check(complexity_score between 0 and 100),
 confidence numeric(5,2) not null check(confidence between 0 and 100),
 implementation_effort public.automation_complexity not null,
 affected_process_ids uuid[] not null default '{}', affected_department_ids uuid[] not null default '{}',
 affected_system_ids uuid[] not null default '{}', created_at timestamptz not null default now(),
 unique(snapshot_id,identifier), unique(id,snapshot_id,organization_id),
 foreign key(snapshot_id,organization_id) references public.automation_opportunity_snapshots(id,organization_id) on delete cascade
);
create table public.automation_opportunity_connectors (
 opportunity_id uuid not null, snapshot_id uuid not null, organization_id uuid not null,
 connector_id uuid not null references public.automation_connector_catalog(id), available boolean not null,
 evidence_json jsonb not null default '{}', created_at timestamptz not null default now(),
 primary key(opportunity_id,connector_id),
 foreign key(opportunity_id,snapshot_id,organization_id) references public.automation_opportunities(id,snapshot_id,organization_id) on delete cascade
);
create table public.automation_opportunity_ai_links (
 opportunity_id uuid not null, snapshot_id uuid not null, organization_id uuid not null,
 ai_opportunity_snapshot_id uuid not null, ai_opportunity_id uuid not null, created_at timestamptz not null default now(),
 primary key(opportunity_id,ai_opportunity_id),
 foreign key(opportunity_id,snapshot_id,organization_id) references public.automation_opportunities(id,snapshot_id,organization_id) on delete cascade,
 foreign key(ai_opportunity_id,ai_opportunity_snapshot_id,organization_id) references public.ai_opportunities(id,snapshot_id,organization_id)
);
create table public.automation_opportunity_evidence (
 id uuid primary key default gen_random_uuid(), opportunity_id uuid not null, snapshot_id uuid not null,
 organization_id uuid not null, business_finding_id uuid not null references public.business_findings(id),
 knowledge_fact_id uuid not null references public.knowledge_facts(id), explanation text not null,
 evidence_json jsonb not null default '{}', created_at timestamptz not null default now(),
 foreign key(opportunity_id,snapshot_id,organization_id) references public.automation_opportunities(id,snapshot_id,organization_id) on delete cascade,
 unique(opportunity_id,business_finding_id,knowledge_fact_id)
);
create table public.automation_opportunity_scores (
 id uuid primary key default gen_random_uuid(), opportunity_id uuid not null, snapshot_id uuid not null,
 organization_id uuid not null, score_definition_id uuid not null references public.automation_score_definition_catalog(id),
 score numeric(5,2) not null check(score between 0 and 100), calculation_json jsonb not null,
 created_at timestamptz not null default now(),
 foreign key(opportunity_id,snapshot_id,organization_id) references public.automation_opportunities(id,snapshot_id,organization_id) on delete cascade,
 unique(opportunity_id,score_definition_id)
);
create table public.automation_opportunity_validations (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null, snapshot_id uuid not null,
 code text not null, severity public.automation_validation_severity not null, message text not null,
 created_at timestamptz not null default now(),
 foreign key(snapshot_id,organization_id) references public.automation_opportunity_snapshots(id,organization_id) on delete cascade
);

do $$ declare t text; begin foreach t in array array['automation_pattern_catalog','automation_connector_catalog','automation_detection_rule_catalog','automation_score_definition_catalog','automation_opportunity_snapshots'] loop execute format('create trigger %I_updated_at before update on public.%I for each row execute function private.set_updated_at()',t,t); end loop; end $$;

create function private.validate_automation_source() returns trigger language plpgsql set search_path='' as $$
begin
 if not exists(
  select 1 from public.ai_opportunity_snapshots ai
  join public.analysis_snapshots a on a.id=ai.business_analysis_id and a.organization_id=ai.organization_id
  join public.process_maps p on p.id=ai.process_map_id and p.organization_id=ai.organization_id
  join public.knowledge_snapshots k on k.id=ai.knowledge_snapshot_id and k.organization_id=ai.organization_id
  where ai.id=new.ai_opportunity_snapshot_id and ai.organization_id=new.organization_id and ai.company_id=new.company_id
  and ai.status='published' and a.id=new.business_analysis_id and a.status='published'
  and p.id=new.process_map_id and p.status='published' and k.id=new.knowledge_snapshot_id and k.status='ready'
 ) then raise exception 'Automation Opportunity requires aligned published canonical sources'; end if;
 return new;
end $$;
revoke execute on function private.validate_automation_source() from public,anon,authenticated;
create trigger automation_source_valid before insert on public.automation_opportunity_snapshots for each row execute function private.validate_automation_source();

create function private.prevent_frozen_automation_catalog_mutation() returns trigger language plpgsql set search_path='' as $$
declare catalog_key text;
begin
 if tg_table_name in ('automation_pattern_catalog','automation_connector_catalog') and old.published then
  raise exception 'Published Automation catalog versions are immutable';
 end if;
 catalog_key:=case tg_table_name
  when 'automation_pattern_catalog' then 'patterns'
  when 'automation_connector_catalog' then 'connectors'
  when 'automation_detection_rule_catalog' then 'rules'
  else 'scoreDefinitions'
 end;
 if exists(
  select 1 from public.automation_opportunity_snapshots s
  where s.catalog_versions_json @> jsonb_build_object(catalog_key,jsonb_build_array(jsonb_build_object('id',old.id::text)))
 ) then raise exception 'Automation catalog versions referenced by a snapshot are immutable'; end if;
 if tg_op='DELETE' then return old; else return new; end if;
end $$;
revoke execute on function private.prevent_frozen_automation_catalog_mutation() from public,anon,authenticated;
do $$ declare t text; begin foreach t in array array['automation_pattern_catalog','automation_connector_catalog','automation_detection_rule_catalog','automation_score_definition_catalog'] loop
 execute format('create trigger %I_immutable before update or delete on public.%I for each row execute function private.prevent_frozen_automation_catalog_mutation()',t,t);
end loop; end $$;

create function private.prevent_published_automation_mutation() returns trigger language plpgsql security definer set search_path='' as $$
declare sid uuid; frozen boolean;
begin
 if tg_table_name='automation_opportunity_snapshots' then
  if old.status='published' then raise exception 'Published Automation Opportunity snapshots are immutable'; end if;
  if tg_op='DELETE' then return old; else return new; end if;
 end if;
 if tg_op='DELETE' then sid:=old.snapshot_id; else sid:=new.snapshot_id; end if;
 select exists(select 1 from public.automation_opportunity_snapshots where id=sid and status='published') into frozen;
 if frozen then raise exception 'Published Automation Opportunity snapshots are immutable'; end if;
 if tg_op='DELETE' then return old; else return new; end if;
end $$;
revoke execute on function private.prevent_published_automation_mutation() from public,anon,authenticated;
create trigger automation_snapshots_immutable before update or delete on public.automation_opportunity_snapshots for each row execute function private.prevent_published_automation_mutation();
do $$ declare t text; begin foreach t in array array['automation_opportunities','automation_opportunity_connectors','automation_opportunity_ai_links','automation_opportunity_evidence','automation_opportunity_scores','automation_opportunity_validations'] loop execute format('create trigger %I_immutable before insert or update or delete on public.%I for each row execute function private.prevent_published_automation_mutation()',t,t); end loop; end $$;

do $$ declare t text; begin foreach t in array array['automation_pattern_catalog','automation_connector_catalog','automation_detection_rule_catalog','automation_score_definition_catalog','automation_opportunity_snapshots','automation_opportunities','automation_opportunity_connectors','automation_opportunity_ai_links','automation_opportunity_evidence','automation_opportunity_scores','automation_opportunity_validations'] loop execute format('alter table public.%I enable row level security',t); end loop; end $$;
do $$ declare t text; begin foreach t in array array['automation_pattern_catalog','automation_connector_catalog','automation_detection_rule_catalog','automation_score_definition_catalog'] loop
 execute format('create policy "members read %1$s" on public.%1$I for select to authenticated using(%1$I.organization_id is null or (select private.has_organization_role(%1$I.organization_id,array[''owner'',''admin'',''consultant'',''viewer'']::public.organization_role[])))',t);
 execute format('create policy "admins manage %1$s" on public.%1$I for all to authenticated using(%1$I.organization_id is not null and (select private.has_organization_role(%1$I.organization_id,array[''owner'',''admin'']::public.organization_role[]))) with check(%1$I.organization_id is not null and (select private.has_organization_role(%1$I.organization_id,array[''owner'',''admin'']::public.organization_role[])))',t);
end loop; end $$;
do $$ declare t text; begin foreach t in array array['automation_opportunities','automation_opportunity_connectors','automation_opportunity_ai_links','automation_opportunity_evidence','automation_opportunity_scores','automation_opportunity_validations'] loop
 execute format('create policy "members read %1$s" on public.%1$I for select to authenticated using((select private.has_organization_role(%1$I.organization_id,array[''owner'',''admin'',''consultant'',''viewer'']::public.organization_role[])))',t);
 execute format('create policy "editors manage %1$s" on public.%1$I for all to authenticated using((select private.has_organization_role(%1$I.organization_id,array[''owner'',''admin'',''consultant'']::public.organization_role[]))) with check((select private.has_organization_role(%1$I.organization_id,array[''owner'',''admin'',''consultant'']::public.organization_role[])))',t);
end loop; end $$;
create policy "members read automation snapshots" on public.automation_opportunity_snapshots for select to authenticated
using((select private.has_organization_role(automation_opportunity_snapshots.organization_id,array['owner','admin','consultant','viewer']::public.organization_role[])));
create policy "editors create automation snapshots" on public.automation_opportunity_snapshots for insert to authenticated
with check((select private.has_organization_role(automation_opportunity_snapshots.organization_id,array['owner','admin','consultant']::public.organization_role[])));
create policy "editors update automation snapshots" on public.automation_opportunity_snapshots for update to authenticated
using((select private.has_organization_role(automation_opportunity_snapshots.organization_id,array['owner','admin','consultant']::public.organization_role[])))
with check((select private.has_organization_role(automation_opportunity_snapshots.organization_id,array['owner','admin','consultant']::public.organization_role[]))
and (automation_opportunity_snapshots.status<>'published' or (select private.has_organization_role(automation_opportunity_snapshots.organization_id,array['owner','admin']::public.organization_role[]))));
create policy "editors delete automation snapshots" on public.automation_opportunity_snapshots for delete to authenticated
using((select private.has_organization_role(automation_opportunity_snapshots.organization_id,array['owner','admin','consultant']::public.organization_role[])));
grant select,insert,update,delete on public.automation_pattern_catalog,public.automation_connector_catalog,public.automation_detection_rule_catalog,public.automation_score_definition_catalog,public.automation_opportunity_snapshots,public.automation_opportunities,public.automation_opportunity_connectors,public.automation_opportunity_ai_links,public.automation_opportunity_evidence,public.automation_opportunity_scores,public.automation_opportunity_validations to authenticated;

insert into public.automation_pattern_catalog(code,version,title,description,supported_findings,supported_ai_capabilities,required_systems,required_inputs,trigger_types,actions,outputs,limitations,complexity,published)
select code,1,title,title||' deterministic automation pattern','[]','[]','[]','[]',triggers,actions,outputs,'["MVP assumptions are configurable"]',complexity::public.automation_complexity,true from (values
('invoice_processing','Invoice Processing','["File Uploaded"]'::jsonb,'["Read","Extract","Validate","Create","Archive"]'::jsonb,'["validated invoice"]'::jsonb,'medium'),
('approval_workflow','Approval Workflow','["Approval"]','["Read","Validate","Approve","Notify"]','["approval decision"]','medium'),
('email_processing','Email Processing','["Email Received"]','["Read","Transform","Create","Send","Archive"]','["routed email"]','low'),
('document_routing','Document Routing','["File Uploaded"]','["Read","Extract","Transform","Archive"]','["routed document"]','medium'),
('crm_synchronization','CRM Synchronization','["Scheduled","Webhook"]','["Read","Transform","Update"]','["synchronized CRM"]','medium'),
('erp_synchronization','ERP Synchronization','["Scheduled","API"]','["Read","Transform","Update"]','["synchronized ERP"]','high'),
('inventory_synchronization','Inventory Synchronization','["Database Event","Scheduled"]','["Read","Validate","Update","Notify"]','["synchronized inventory"]','high'),
('customer_onboarding','Customer Onboarding','["Form Submitted"]','["Read","Validate","Create","Notify"]','["onboarded customer"]','medium'),
('employee_onboarding','Employee Onboarding','["Approval"]','["Read","Validate","Create","Notify"]','["onboarded employee"]','medium'),
('notification_workflow','Notification Workflow','["Webhook","Database Event"]','["Read","Notify","Send"]','["notification"]','low'),
('scheduled_reporting','Scheduled Reporting','["Scheduled"]','["Read","Transform","Create","Send"]','["business report"]','low'),
('file_processing','File Processing','["File Uploaded"]','["Read","Transform","Write","Archive"]','["processed file"]','medium'),
('webhook_integration','Webhook Integration','["Webhook"]','["Read","Validate","Create","Update"]','["integration event"]','medium'),
('database_synchronization','Database Synchronization','["Database Event","Scheduled"]','["Read","Transform","Write","Update"]','["synchronized data"]','high'),
('purchase_approval','Purchase Approval','["Approval"]','["Read","Validate","Approve","Notify"]','["purchase decision"]','medium'),
('support_ticket_routing','Support Ticket Routing','["Email Received","API"]','["Read","Create","Update","Notify"]','["routed ticket"]','medium'),
('lead_qualification','Lead Qualification','["Form Submitted","API"]','["Read","Validate","Update","Notify"]','["qualified lead"]','medium'),
('contract_lifecycle','Contract Lifecycle','["File Uploaded","Approval"]','["Read","Validate","Approve","Archive"]','["managed contract"]','high'),
('payment_reminder','Payment Reminder','["Scheduled"]','["Read","Validate","Send","Update"]','["payment reminder"]','low'),
('backup_automation','Backup Automation','["Scheduled"]','["Read","Write","Archive","Validate"]','["validated backup"]','medium')
) v(code,title,triggers,actions,outputs,complexity);

insert into public.automation_connector_catalog(code,version,title,aliases,limitations,published) values
('gmail',1,'Gmail','["gmail","google mail"]','[]',true),('outlook',1,'Outlook','["outlook"]','[]',true),
('microsoft_365',1,'Microsoft 365','["microsoft 365","office 365"]','[]',true),('google_drive',1,'Google Drive','["google drive"]','[]',true),
('dropbox',1,'Dropbox','["dropbox"]','[]',true),('slack',1,'Slack','["slack"]','[]',true),('teams',1,'Teams','["teams"]','[]',true),
('whatsapp',1,'WhatsApp','["whatsapp"]','[]',true),('erp',1,'ERP','["erp","sap","odoo"]','[]',true),('crm',1,'CRM','["crm","hubspot","salesforce"]','[]',true),
('postgresql',1,'PostgreSQL','["postgresql","postgres"]','[]',true),('mysql',1,'MySQL','["mysql"]','[]',true),('supabase',1,'Supabase','["supabase"]','[]',true),
('rest_api',1,'REST API','["rest api"]','["availability requires explicit evidence"]',true),('graphql',1,'GraphQL','["graphql"]','[]',true),
('ftp',1,'FTP','["ftp"]','[]',true),('sftp',1,'SFTP','["sftp"]','[]',true),('webhook',1,'Webhook','["webhook"]','["availability requires explicit evidence"]',true),
('csv',1,'CSV','["csv"]','[]',true),('excel',1,'Excel','["excel","spreadsheet"]','[]',true);

insert into public.automation_detection_rule_catalog(code,version,title,finding_codes,ai_capability_codes,pattern_code,connector_codes,trigger_type,actions,business_problem_template,impact_template) values
('automate_invoices',1,'Automate invoice processing','["manual_invoice_processing"]','["ocr","information_extraction"]','invoice_processing','["erp","csv","excel"]','File Uploaded','["Read","Extract","Validate","Create","Archive"]','Invoices are processed manually.','Reduce repeatable invoice handling.'),
('automate_email',1,'Automate email processing','["email_dependency"]','["email_classification"]','email_processing','["gmail","outlook","microsoft_365"]','Email Received','["Read","Transform","Create","Send","Archive"]','Operations depend on manual email handling.','Route and process governed emails.'),
('automate_approval',1,'Automate approval workflow','["missing_approval","repeated_validation"]','[]','approval_workflow','["erp","crm"]','Approval','["Read","Validate","Approve","Notify"]','Approvals are missing or repeatedly manual.','Create a traceable approval flow.'),
('automate_documents',1,'Automate document routing','["manual_document_transfer","paper_document"]','["ocr","document_classification"]','document_routing','["google_drive","dropbox","ftp","sftp"]','File Uploaded','["Read","Extract","Transform","Archive"]','Documents are transferred manually.','Route governed documents.'),
('automate_spreadsheets',1,'Automate spreadsheet synchronization','["excel_dependency"]','[]','database_synchronization','["excel","csv","postgresql"]','Scheduled','["Read","Transform","Write","Update"]','Data depends on spreadsheets.','Synchronize governed operational data.'),
('automate_support',1,'Automate support ticket routing','["customer_support_process","email_dependency"]','["chatbot","email_classification"]','support_ticket_routing','["crm","gmail","outlook","whatsapp"]','Email Received','["Read","Create","Update","Notify"]','Support requests require manual routing.','Route requests to the correct team.'),
('automate_inventory',1,'Automate inventory synchronization','["inventory_process"]','["forecasting"]','inventory_synchronization','["erp","postgresql","mysql"]','Database Event','["Read","Validate","Update","Notify"]','Inventory changes are not synchronized.','Synchronize inventory state.'),
('automate_reporting',1,'Automate scheduled reporting','["missing_kpi"]','["forecasting"]','scheduled_reporting','["postgresql","mysql","csv","excel"]','Scheduled','["Read","Transform","Create","Send"]','Reporting is missing or manual.','Generate consistent scheduled reports.');

insert into public.automation_score_definition_catalog(code,version,title,direction,formula_json) values
('automation_coverage',1,'Automation Coverage','higher_is_better','{"formula":"matched relevant findings / total relevant findings * 100","empty":0}'),
('business_impact',1,'Business Impact','higher_is_better','{"severity":{"critical":100,"high":75,"medium":50,"low":25,"information":10}}'),
('technical_feasibility',1,'Technical Feasibility','higher_is_better','{"connectorAvailability":0.35,"inputReadiness":0.25,"inverseComplexity":0.25,"confidence":0.15}'),
('connector_availability',1,'Connector Availability','higher_is_better','{"formula":"available required connectors / required connectors * 100","empty":100}'),
('automation_readiness',1,'Automation Readiness','higher_is_better','{"formula":"mean(coverage,technicalFeasibility,connectorAvailability,confidence)"}'),
('complexity',1,'Complexity','higher_is_complexity','{"very_low":20,"low":40,"medium":60,"high":80,"very_high":100}'),
('confidence',1,'Confidence','higher_is_better','{"withAi":{"finding":0.5,"ai":0.25,"evidence":0.25},"withoutAi":{"finding":0.6666667,"evidence":0.3333333}}');
