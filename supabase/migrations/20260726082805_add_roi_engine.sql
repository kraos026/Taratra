create type public.roi_evaluation_status as enum ('draft','validated','published','archived');
create type public.roi_scenario_type as enum ('conservative','expected','optimistic');
create type public.roi_validation_severity as enum ('error','warning','information');

create table public.roi_model_catalog(
 id uuid primary key default gen_random_uuid(), organization_id uuid references public.organizations(id),
 code text not null, version integer not null check(version>0), title text not null, description text not null,
 formula_json jsonb not null check(jsonb_typeof(formula_json)='object'),
 required_inputs jsonb not null check(jsonb_typeof(required_inputs)='array'),
 outputs jsonb not null check(jsonb_typeof(outputs)='array'), published boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique nulls not distinct(code,version,organization_id)
);
create table public.roi_assumption_catalog(
 id uuid primary key default gen_random_uuid(), organization_id uuid references public.organizations(id),
 code text not null, version integer not null check(version>0), title text not null, description text not null,
 default_value numeric(18,4) check(default_value>=0), unit text not null,
 industry_scope jsonb not null default '[]' check(jsonb_typeof(industry_scope)='array'),
 required boolean not null default true, published boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique nulls not distinct(code,version,organization_id)
);
create table public.roi_evaluation_snapshots(
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
 company_id uuid not null, automation_opportunity_snapshot_id uuid not null, ai_opportunity_snapshot_id uuid not null,
 business_analysis_id uuid not null, process_map_id uuid not null, knowledge_snapshot_id uuid not null,
 previous_version_id uuid references public.roi_evaluation_snapshots(id), version_number integer not null check(version_number>0),
 status public.roi_evaluation_status not null default 'draft', lock_version integer not null default 1 check(lock_version>0),
 currency text not null check(currency ~ '^[A-Z]{3}$'), catalog_versions_json jsonb not null,
 provenance_json jsonb not null, created_by uuid not null, validated_at timestamptz, published_at timestamptz,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(id,organization_id), unique(organization_id,automation_opportunity_snapshot_id,version_number),
 foreign key(company_id,organization_id) references public.companies(id,organization_id),
 foreign key(automation_opportunity_snapshot_id,organization_id) references public.automation_opportunity_snapshots(id,organization_id)
);
create table public.roi_scenarios(
 id uuid primary key default gen_random_uuid(), organization_id uuid not null, snapshot_id uuid not null,
 type public.roi_scenario_type not null, model_id uuid not null references public.roi_model_catalog(id),
 volume_factor numeric(8,4) not null check(volume_factor>0), cost_factor numeric(8,4) not null check(cost_factor>0),
 created_at timestamptz not null default now(), unique(snapshot_id,type), unique(id,snapshot_id,organization_id),
 foreign key(snapshot_id,organization_id) references public.roi_evaluation_snapshots(id,organization_id) on delete cascade
);
create table public.roi_scenario_assumptions(
 scenario_id uuid not null, snapshot_id uuid not null, organization_id uuid not null,
 assumption_id uuid not null references public.roi_assumption_catalog(id), value numeric(18,4) not null check(value>=0),
 unit text not null, source text not null check(source in ('provided','catalog_default')), created_at timestamptz not null default now(),
 primary key(scenario_id,assumption_id),
 foreign key(scenario_id,snapshot_id,organization_id) references public.roi_scenarios(id,snapshot_id,organization_id) on delete cascade
);
create table public.roi_evaluations(
 id uuid primary key default gen_random_uuid(), organization_id uuid not null, snapshot_id uuid not null,
 scenario_id uuid not null, automation_opportunity_id uuid not null, identifier text not null, title text not null,
 description text not null, confidence numeric(5,2) not null check(confidence between 0 and 100),
 created_at timestamptz not null default now(), unique(scenario_id,automation_opportunity_id),
 unique(id,scenario_id,snapshot_id,organization_id),
 foreign key(scenario_id,snapshot_id,organization_id) references public.roi_scenarios(id,snapshot_id,organization_id) on delete cascade
);
create table public.roi_contributions(
 id uuid primary key default gen_random_uuid(), organization_id uuid not null, snapshot_id uuid not null,
 scenario_id uuid not null, evaluation_id uuid not null, assumption_id uuid not null references public.roi_assumption_catalog(id),
 code text not null, input_value numeric(18,4) not null, contribution numeric(18,4) not null,
 calculation_json jsonb not null, created_at timestamptz not null default now(),
 foreign key(evaluation_id,scenario_id,snapshot_id,organization_id) references public.roi_evaluations(id,scenario_id,snapshot_id,organization_id) on delete cascade
);
create table public.roi_metrics(
 id uuid primary key default gen_random_uuid(), organization_id uuid not null, snapshot_id uuid not null,
 scenario_id uuid not null, evaluation_id uuid not null, code text not null, value numeric(18,4),
 special_value text check(special_value in ('unbounded','not_recovered')), unit text not null, calculation_json jsonb not null,
 created_at timestamptz not null default now(), unique(evaluation_id,code),
 check(value is not null or special_value is not null),
 foreign key(evaluation_id,scenario_id,snapshot_id,organization_id) references public.roi_evaluations(id,scenario_id,snapshot_id,organization_id) on delete cascade
);
create table public.roi_evidence(
 id uuid primary key default gen_random_uuid(), organization_id uuid not null, snapshot_id uuid not null,
 scenario_id uuid not null, evaluation_id uuid not null,
 automation_evidence_id uuid not null references public.automation_opportunity_evidence(id),
 business_finding_id uuid not null references public.business_findings(id), knowledge_fact_id uuid not null references public.knowledge_facts(id),
 explanation text not null, created_at timestamptz not null default now(), unique(evaluation_id,automation_evidence_id),
 foreign key(evaluation_id,scenario_id,snapshot_id,organization_id) references public.roi_evaluations(id,scenario_id,snapshot_id,organization_id) on delete cascade
);
create table public.roi_validations(
 id uuid primary key default gen_random_uuid(), organization_id uuid not null, snapshot_id uuid not null,
 code text not null, severity public.roi_validation_severity not null, message text not null,
 created_at timestamptz not null default now(),
 foreign key(snapshot_id,organization_id) references public.roi_evaluation_snapshots(id,organization_id) on delete cascade
);

do $$ declare t text; begin foreach t in array array['roi_model_catalog','roi_assumption_catalog','roi_evaluation_snapshots'] loop execute format('create trigger %I_updated_at before update on public.%I for each row execute function private.set_updated_at()',t,t); end loop; end $$;
create function private.validate_roi_source() returns trigger language plpgsql set search_path='' as $$
begin
 if not exists(
  select 1 from public.automation_opportunity_snapshots au
  join public.ai_opportunity_snapshots ai on ai.id=au.ai_opportunity_snapshot_id and ai.organization_id=au.organization_id
  join public.analysis_snapshots a on a.id=au.business_analysis_id and a.organization_id=au.organization_id
  join public.process_maps p on p.id=au.process_map_id and p.organization_id=au.organization_id
  join public.knowledge_snapshots k on k.id=au.knowledge_snapshot_id and k.organization_id=au.organization_id
  where au.id=new.automation_opportunity_snapshot_id and au.organization_id=new.organization_id and au.company_id=new.company_id
  and au.status='published' and ai.id=new.ai_opportunity_snapshot_id and ai.status='published'
  and a.id=new.business_analysis_id and a.status='published' and p.id=new.process_map_id and p.status='published'
  and k.id=new.knowledge_snapshot_id and k.status='ready'
 ) then raise exception 'ROI requires aligned published canonical sources'; end if;
 return new;
end $$;
revoke execute on function private.validate_roi_source() from public,anon,authenticated;
create trigger roi_source_valid before insert on public.roi_evaluation_snapshots for each row execute function private.validate_roi_source();

create function private.prevent_frozen_roi_catalog_mutation() returns trigger language plpgsql set search_path='' as $$
declare catalog_key text;
begin
 if old.published then raise exception 'Published ROI catalog versions are immutable'; end if;
 catalog_key:=case tg_table_name when 'roi_model_catalog' then 'models' else 'assumptions' end;
 if exists(select 1 from public.roi_evaluation_snapshots s where s.catalog_versions_json @> jsonb_build_object(catalog_key,jsonb_build_array(jsonb_build_object('id',old.id::text))))
 then raise exception 'ROI catalog versions referenced by a snapshot are immutable'; end if;
 if tg_op='DELETE' then return old; else return new; end if;
end $$;
revoke execute on function private.prevent_frozen_roi_catalog_mutation() from public,anon,authenticated;
create trigger roi_models_immutable before update or delete on public.roi_model_catalog for each row execute function private.prevent_frozen_roi_catalog_mutation();
create trigger roi_assumptions_immutable before update or delete on public.roi_assumption_catalog for each row execute function private.prevent_frozen_roi_catalog_mutation();

create function private.prevent_published_roi_mutation() returns trigger language plpgsql security definer set search_path='' as $$
declare sid uuid; frozen boolean;
begin
 if tg_table_name='roi_evaluation_snapshots' then
  if old.status='published' then raise exception 'Published ROI snapshots are immutable'; end if;
  if tg_op='DELETE' then return old; else return new; end if;
 end if;
 if tg_op='DELETE' then sid:=old.snapshot_id; else sid:=new.snapshot_id; end if;
 select exists(select 1 from public.roi_evaluation_snapshots where id=sid and status='published') into frozen;
 if frozen then raise exception 'Published ROI snapshots are immutable'; end if;
 if tg_op='DELETE' then return old; else return new; end if;
end $$;
revoke execute on function private.prevent_published_roi_mutation() from public,anon,authenticated;
create trigger roi_snapshots_immutable before update or delete on public.roi_evaluation_snapshots for each row execute function private.prevent_published_roi_mutation();
do $$ declare t text; begin foreach t in array array['roi_scenarios','roi_scenario_assumptions','roi_evaluations','roi_contributions','roi_metrics','roi_evidence','roi_validations'] loop execute format('create trigger %I_immutable before insert or update or delete on public.%I for each row execute function private.prevent_published_roi_mutation()',t,t); end loop; end $$;

do $$ declare t text; begin foreach t in array array['roi_model_catalog','roi_assumption_catalog','roi_evaluation_snapshots','roi_scenarios','roi_scenario_assumptions','roi_evaluations','roi_contributions','roi_metrics','roi_evidence','roi_validations'] loop execute format('alter table public.%I enable row level security',t); end loop; end $$;
do $$ declare t text; begin foreach t in array array['roi_model_catalog','roi_assumption_catalog'] loop
 execute format('create policy "members read %1$s" on public.%1$I for select to authenticated using(%1$I.organization_id is null or (select private.has_organization_role(%1$I.organization_id,array[''owner'',''admin'',''consultant'',''viewer'']::public.organization_role[])))',t);
 execute format('create policy "admins manage %1$s" on public.%1$I for all to authenticated using(%1$I.organization_id is not null and (select private.has_organization_role(%1$I.organization_id,array[''owner'',''admin'']::public.organization_role[]))) with check(%1$I.organization_id is not null and (select private.has_organization_role(%1$I.organization_id,array[''owner'',''admin'']::public.organization_role[])))',t);
end loop; end $$;
do $$ declare t text; begin foreach t in array array['roi_scenarios','roi_scenario_assumptions','roi_evaluations','roi_contributions','roi_metrics','roi_evidence','roi_validations'] loop
 execute format('create policy "members read %1$s" on public.%1$I for select to authenticated using((select private.has_organization_role(%1$I.organization_id,array[''owner'',''admin'',''consultant'',''viewer'']::public.organization_role[])))',t);
 execute format('create policy "editors manage %1$s" on public.%1$I for all to authenticated using((select private.has_organization_role(%1$I.organization_id,array[''owner'',''admin'',''consultant'']::public.organization_role[]))) with check((select private.has_organization_role(%1$I.organization_id,array[''owner'',''admin'',''consultant'']::public.organization_role[])))',t);
end loop; end $$;
create policy "members read roi snapshots" on public.roi_evaluation_snapshots for select to authenticated using((select private.has_organization_role(roi_evaluation_snapshots.organization_id,array['owner','admin','consultant','viewer']::public.organization_role[])));
create policy "editors create roi snapshots" on public.roi_evaluation_snapshots for insert to authenticated with check((select private.has_organization_role(roi_evaluation_snapshots.organization_id,array['owner','admin','consultant']::public.organization_role[])));
create policy "editors update roi snapshots" on public.roi_evaluation_snapshots for update to authenticated
using((select private.has_organization_role(roi_evaluation_snapshots.organization_id,array['owner','admin','consultant']::public.organization_role[])))
with check((select private.has_organization_role(roi_evaluation_snapshots.organization_id,array['owner','admin','consultant']::public.organization_role[])) and (roi_evaluation_snapshots.status<>'published' or (select private.has_organization_role(roi_evaluation_snapshots.organization_id,array['owner','admin']::public.organization_role[]))));
create policy "editors delete roi snapshots" on public.roi_evaluation_snapshots for delete to authenticated using((select private.has_organization_role(roi_evaluation_snapshots.organization_id,array['owner','admin','consultant']::public.organization_role[])));
grant select,insert,update,delete on public.roi_model_catalog,public.roi_assumption_catalog,public.roi_evaluation_snapshots,public.roi_scenarios,public.roi_scenario_assumptions,public.roi_evaluations,public.roi_contributions,public.roi_metrics,public.roi_evidence,public.roi_validations to authenticated;

insert into public.roi_model_catalog(code,version,title,description,formula_json,required_inputs,outputs,published) values
('automation_economic_impact',1,'Automation economic impact','Deterministic first-year economic evaluation',
'{"annualHoursSaved":"hoursSavedPerOccurrence * annualFrequency * volumeFactor * automationCoverage","annualCostSaved":"annualHoursSaved * hourlyCost","annualBenefit":"annualCostSaved + avoidedErrorCost","initialCost":"implementationCost + trainingCost + infrastructureCost","annualNetBenefit":"annualBenefit - maintenanceCost","roi":"(annualNetBenefit - initialCost) / initialCost * 100","payback":"initialCost / monthlyNetBenefit","scenarios":{"conservative":{"volume":0.75,"cost":1.2},"expected":{"volume":1,"cost":1},"optimistic":{"volume":1.25,"cost":0.9}}}',
'["hourly_cost","working_days","working_hours","monthly_frequency","annual_frequency","hours_saved_per_occurrence","implementation_cost","maintenance_cost","training_cost","infrastructure_cost","error_cost"]',
'["annual_hours_saved","monthly_hours_saved","annual_cost_saved","monthly_cost_saved","implementation_cost","maintenance_cost","training_cost","infrastructure_cost","annual_benefit","annual_net_benefit","payback_period","roi_percentage","confidence"]',true);
insert into public.roi_assumption_catalog(code,version,title,description,default_value,unit,required,published) values
('hourly_cost',1,'Hourly Cost','Loaded labor cost in evaluation currency',null,'currency/hour',true,true),
('working_days',1,'Working Days','Working days per year',null,'days/year',true,true),
('working_hours',1,'Working Hours','Working hours per day',null,'hours/day',true,true),
('monthly_frequency',1,'Monthly Frequency','Occurrences per month',null,'occurrences/month',true,true),
('annual_frequency',1,'Annual Frequency','Occurrences per year',null,'occurrences/year',true,true),
('hours_saved_per_occurrence',1,'Hours Saved per Occurrence','Estimated hours saved for one occurrence',null,'hours/occurrence',true,true),
('implementation_cost',1,'Implementation Cost','One-time implementation cost',null,'currency',true,true),
('maintenance_cost',1,'Maintenance Cost','Annual recurring maintenance cost',null,'currency/year',true,true),
('training_cost',1,'Training Cost','One-time training cost',null,'currency',true,true),
('infrastructure_cost',1,'Infrastructure Cost','One-time infrastructure cost',null,'currency',true,true),
('error_cost',1,'Error Cost','Avoidable error cost per occurrence',null,'currency/occurrence',true,true);
