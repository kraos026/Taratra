create type public.automation_specification_status as enum ('draft','validated','published','archived');
create type public.automation_specification_severity as enum ('error','warning','information');
create type public.automation_specification_rule_type as enum ('transformation','validation');
create type public.automation_specification_element_type as enum (
 'trigger','data_contract','step','dependency','control','error_policy','security',
 'observability','acceptance_criterion'
);

create table public.automation_specification_rule_catalog(
 id uuid primary key default gen_random_uuid(),
 organization_id uuid references public.organizations(id),
 code text not null,
 version integer not null check(version>0),
 status text not null default 'draft' check(status in('draft','published','retired')),
 rule_type public.automation_specification_rule_type not null,
 condition_json jsonb not null default '{}' check(jsonb_typeof(condition_json)='object'),
 result_json jsonb not null default '{}' check(jsonb_typeof(result_json)='object'),
 severity public.automation_specification_severity,
 description text not null,
 created_at timestamptz not null default now(),
 published_at timestamptz,
 unique nulls not distinct(code,version,organization_id),
 check((rule_type='validation' and severity is not null) or (rule_type='transformation' and severity is null)),
 check(condition_json='{}'::jsonb),
 check(
  (rule_type='transformation' and result_json ? 'decision' and result_json-'decision'='{}'::jsonb)
  or
  (rule_type='validation' and result_json ? 'operator' and result_json-'operator'='{}'::jsonb)
 ),
 check((status='published' and published_at is not null) or status<>'published')
);

create table public.automation_specifications(
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null,
 solution_blueprint_id uuid not null,
 solution_blueprint_version_number integer not null check(solution_blueprint_version_number>0),
 previous_version_id uuid,
 version_number integer not null check(version_number>0),
 status public.automation_specification_status not null default 'draft',
 lock_version integer not null default 1 check(lock_version>0),
 name text not null,
 objective text not null,
 scope text not null,
 source_fingerprint text not null,
 catalog_versions_json jsonb not null check(jsonb_typeof(catalog_versions_json)='array'),
 created_by uuid not null,
 validated_at timestamptz,
 published_at timestamptz,
 archived_at timestamptz,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique(id,organization_id),
 unique(organization_id,solution_blueprint_id,version_number),
 foreign key(solution_blueprint_id,organization_id)
  references public.solution_blueprints(id,organization_id),
 foreign key(previous_version_id,organization_id)
  references public.automation_specifications(id,organization_id)
);

create table public.automation_specification_elements(
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null,
 automation_specification_id uuid not null,
 local_id text not null check(local_id ~ '^[a-z][a-z0-9_-]*$'),
 element_type public.automation_specification_element_type not null,
 definition_json jsonb not null check(jsonb_typeof(definition_json)='object'),
 display_order integer not null check(display_order>=0),
 created_at timestamptz not null default now(),
 unique(automation_specification_id,local_id),
 foreign key(automation_specification_id,organization_id)
  references public.automation_specifications(id,organization_id) on delete cascade
);

create table public.automation_specification_provenance(
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null,
 automation_specification_id uuid not null,
 target_local_id text,
 source_element_type text not null,
 source_element_id text not null,
 catalog_rule_code text,
 catalog_rule_version integer,
 reason text not null,
 consumed boolean not null default true,
 created_at timestamptz not null default now(),
 foreign key(automation_specification_id,organization_id)
  references public.automation_specifications(id,organization_id) on delete cascade,
 check(consumed or (target_local_id is null and length(reason)>0)),
 check((catalog_rule_code is null)=(catalog_rule_version is null))
);

create table public.automation_specification_validations(
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null,
 automation_specification_id uuid not null,
 rule_code text not null,
 rule_version integer not null check(rule_version>0),
 severity public.automation_specification_severity not null,
 passed boolean not null default false,
 target_local_id text,
 message text not null,
 details_json jsonb not null check(jsonb_typeof(details_json)='object'),
 created_at timestamptz not null default now(),
 unique(automation_specification_id,rule_code,rule_version),
 foreign key(automation_specification_id,organization_id)
  references public.automation_specifications(id,organization_id) on delete cascade
);

create index automation_specifications_lookup_idx
 on public.automation_specifications(organization_id,solution_blueprint_id,status,version_number desc);
create index automation_specification_elements_lookup_idx
 on public.automation_specification_elements(organization_id,automation_specification_id,element_type);
create index automation_specification_provenance_lookup_idx
 on public.automation_specification_provenance(organization_id,automation_specification_id);
create index automation_specification_validations_lookup_idx
 on public.automation_specification_validations(organization_id,automation_specification_id);

create trigger automation_specifications_updated_at before update on public.automation_specifications
for each row execute function private.set_updated_at();

create function private.prevent_automation_specification_catalog_mutation() returns trigger
language plpgsql set search_path='' as $$
begin
 if old.status in('published','retired')
 then raise exception 'Published Automation Specification catalog versions are immutable'; end if;
 if tg_op='DELETE' then return old; else return new; end if;
end $$;
revoke execute on function private.prevent_automation_specification_catalog_mutation()
 from public,anon,authenticated;
create trigger automation_specification_catalog_immutable
before update or delete on public.automation_specification_rule_catalog
for each row execute function private.prevent_automation_specification_catalog_mutation();

create function private.enforce_automation_specification_write_boundary() returns trigger
language plpgsql security definer set search_path='' as $$
declare specification_id uuid;
begin
 if coalesce(current_setting('app.automation_specification_internal_write',true),'') <> 'on'
 then raise exception 'Automation Specification writes must use the application transaction'; end if;
 if tg_table_name='automation_specifications' then
  if new.status<>'draft' or new.lock_version<>1
  then raise exception 'An Automation Specification must be created as draft with lock version 1'; end if;
  if not exists(
   select 1 from public.solution_blueprints blueprint
   where blueprint.id=new.solution_blueprint_id
    and blueprint.organization_id=new.organization_id
    and blueprint.version_number=new.solution_blueprint_version_number
    and blueprint.status='published'
  ) then raise exception 'Automation Specification requires one published Solution Blueprint'; end if;
  if (new.version_number=1 and new.previous_version_id is not null)
   or (new.version_number>1 and not exists(
    select 1 from public.automation_specifications previous
    where previous.id=new.previous_version_id
     and previous.organization_id=new.organization_id
     and previous.solution_blueprint_id=new.solution_blueprint_id
     and previous.solution_blueprint_version_number=new.solution_blueprint_version_number
     and previous.version_number=new.version_number-1
   ))
  then raise exception 'Previous Automation Specification must be the preceding version in the same Blueprint lineage'; end if;
  return new;
 end if;
 specification_id:=case when tg_op='DELETE' then old.automation_specification_id else new.automation_specification_id end;
 if not exists(
  select 1 from public.automation_specifications specification
  where specification.id=specification_id
   and specification.organization_id=case when tg_op='DELETE' then old.organization_id else new.organization_id end
   and specification.status='draft'
 ) then raise exception 'Automation Specification children are writable only for a draft'; end if;
 if tg_op='DELETE' then return old; else return new; end if;
end $$;
revoke execute on function private.enforce_automation_specification_write_boundary()
 from public,anon,authenticated;
create trigger automation_specification_internal_insert
before insert on public.automation_specifications
for each row execute function private.enforce_automation_specification_write_boundary();
create trigger automation_specification_elements_internal_write
before insert or update or delete on public.automation_specification_elements
for each row execute function private.enforce_automation_specification_write_boundary();
create trigger automation_specification_provenance_internal_write
before insert or update or delete on public.automation_specification_provenance
for each row execute function private.enforce_automation_specification_write_boundary();
create trigger automation_specification_validations_internal_write
before insert or update or delete on public.automation_specification_validations
for each row execute function private.enforce_automation_specification_write_boundary();

create function private.validate_automation_specification_children() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_table_name='automation_specification_provenance' and new.target_local_id is not null
  and not exists(
   select 1 from public.automation_specification_elements element
   where element.automation_specification_id=new.automation_specification_id
    and element.organization_id=new.organization_id and element.local_id=new.target_local_id
  ) then raise exception 'Automation Specification provenance target must exist in the same snapshot'; end if;
 if tg_table_name='automation_specification_validations' and not exists(
  select 1 from public.automation_specifications specification
  cross join lateral jsonb_array_elements(specification.catalog_versions_json) reference
  join public.automation_specification_rule_catalog rule
   on rule.id=(reference->>'id')::uuid
   and rule.code=new.rule_code and rule.version=new.rule_version
   and rule.rule_type='validation' and rule.severity=new.severity
   and rule.status='published'
   and (rule.organization_id is null or rule.organization_id=specification.organization_id)
  where specification.id=new.automation_specification_id
   and specification.organization_id=new.organization_id
 ) then raise exception 'Validation must reference a published catalog rule frozen in the snapshot'; end if;
 return new;
end $$;
revoke execute on function private.validate_automation_specification_children()
 from public,anon,authenticated;
create trigger automation_specification_provenance_scope
before insert or update on public.automation_specification_provenance
for each row execute function private.validate_automation_specification_children();
create trigger automation_specification_validation_scope
before insert or update on public.automation_specification_validations
for each row execute function private.validate_automation_specification_children();

create function private.enforce_automation_specification_lifecycle() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if old.status='archived' then raise exception 'Archived Automation Specifications are immutable'; end if;
 if tg_op='DELETE' then
  if old.status='published' then raise exception 'Published Automation Specifications are immutable'; end if;
  return old;
 end if;
 if (to_jsonb(new)-array['status','lock_version','validated_at','published_at','archived_at','updated_at'])
    is distinct from
    (to_jsonb(old)-array['status','lock_version','validated_at','published_at','archived_at','updated_at'])
 then raise exception 'Automation Specification content is immutable; rebuild a new draft version'; end if;
 if new.lock_version<>old.lock_version+1
 then raise exception 'Automation Specification transition requires the next lock version'; end if;
 if exists(
  select 1 from public.automation_specifications newer
  where newer.organization_id=old.organization_id
   and newer.solution_blueprint_id=old.solution_blueprint_id
   and newer.version_number>old.version_number
 ) then raise exception 'Only the latest Automation Specification version can transition'; end if;
 if new.status<>'archived' and (
  not exists(
   select 1 from public.automation_specification_validations validation
   where validation.automation_specification_id=old.id
  )
  or exists(
   select 1 from public.automation_specification_validations validation
   where validation.automation_specification_id=old.id
    and validation.severity='error' and not validation.passed
  )
 ) then raise exception 'Automation Specification has incomplete or blocking validations'; end if;
 if old.status='draft' and new.status='validated' then
  if new.validated_at is null or new.published_at is not null or new.archived_at is not null
  then raise exception 'Invalid Automation Specification validation transition'; end if;
 elsif old.status='validated' and new.status='published' then
  if not (select private.has_organization_role(old.organization_id,array['owner','admin']::public.organization_role[]))
  then raise exception 'Only owner or admin can publish an Automation Specification'; end if;
  if new.published_at is null or new.archived_at is not null
  then raise exception 'Invalid Automation Specification publication transition'; end if;
 elsif new.status='archived' then
  if not (select private.has_organization_role(old.organization_id,array['owner','admin']::public.organization_role[]))
  then raise exception 'Only owner or admin can archive an Automation Specification'; end if;
  if new.archived_at is null then raise exception 'Archive timestamp is required'; end if;
 else raise exception 'Invalid Automation Specification lifecycle transition';
 end if;
 return new;
end $$;
revoke execute on function private.enforce_automation_specification_lifecycle()
 from public,anon,authenticated;
create trigger automation_specifications_immutable
before update or delete on public.automation_specifications
for each row execute function private.enforce_automation_specification_lifecycle();

do $$ declare table_name text; begin
 foreach table_name in array array[
  'automation_specification_rule_catalog','automation_specifications',
  'automation_specification_elements','automation_specification_provenance',
  'automation_specification_validations'
 ] loop execute format('alter table public.%I enable row level security',table_name); end loop;
end $$;

create policy "members read automation specification rule catalog"
on public.automation_specification_rule_catalog for select to authenticated
using(
 automation_specification_rule_catalog.organization_id is null
 or (select private.has_organization_role(
  automation_specification_rule_catalog.organization_id,
  array['owner','admin','consultant','viewer']::public.organization_role[]
 ))
);
create policy "admins manage automation specification rule catalog"
on public.automation_specification_rule_catalog for all to authenticated
using(
 automation_specification_rule_catalog.organization_id is not null
 and (select private.has_organization_role(
  automation_specification_rule_catalog.organization_id,
  array['owner','admin']::public.organization_role[]
 ))
)
with check(
 automation_specification_rule_catalog.organization_id is not null
 and (select private.has_organization_role(
  automation_specification_rule_catalog.organization_id,
  array['owner','admin']::public.organization_role[]
 ))
);
create policy "members read automation specifications"
on public.automation_specifications for select to authenticated
using((select private.has_organization_role(
 automation_specifications.organization_id,
 array['owner','admin','consultant','viewer']::public.organization_role[]
)));
create policy "editors insert automation specifications"
on public.automation_specifications for insert to authenticated
with check((select private.has_organization_role(
 automation_specifications.organization_id,
 array['owner','admin','consultant']::public.organization_role[]
)));
create policy "editors update automation specifications"
on public.automation_specifications for update to authenticated
using((select private.has_organization_role(
 automation_specifications.organization_id,
 array['owner','admin','consultant']::public.organization_role[]
)))
with check(
 (select private.has_organization_role(
  automation_specifications.organization_id,
  array['owner','admin','consultant']::public.organization_role[]
 ))
 and (
  automation_specifications.status<>'published'
  or (select private.has_organization_role(
   automation_specifications.organization_id,
   array['owner','admin']::public.organization_role[]
  ))
 )
);
create policy "admins delete automation specifications"
on public.automation_specifications for delete to authenticated
using((select private.has_organization_role(
 automation_specifications.organization_id,
 array['owner','admin']::public.organization_role[]
)));

do $$ declare table_name text; begin
 foreach table_name in array array[
  'automation_specification_elements','automation_specification_provenance',
  'automation_specification_validations'
 ] loop
  execute format(
   'create policy "members read %1$s" on public.%1$I for select to authenticated using((select private.has_organization_role(%1$I.organization_id,array[''owner'',''admin'',''consultant'',''viewer'']::public.organization_role[])))',
   table_name
  );
  execute format(
   'create policy "editors manage %1$s" on public.%1$I for all to authenticated using((select private.has_organization_role(%1$I.organization_id,array[''owner'',''admin'',''consultant'']::public.organization_role[]))) with check((select private.has_organization_role(%1$I.organization_id,array[''owner'',''admin'',''consultant'']::public.organization_role[])))',
   table_name
  );
 end loop;
end $$;

grant select,insert,update,delete on
 public.automation_specification_rule_catalog,
 public.automation_specifications,
 public.automation_specification_elements,
 public.automation_specification_provenance,
 public.automation_specification_validations
to authenticated;

insert into public.automation_specification_rule_catalog
(code,version,status,rule_type,condition_json,result_json,severity,description,published_at) values
('project_triggers',1,'published','transformation','{}','{"decision":"project_triggers"}',null,'Project Blueprint inputs as abstract triggers',now()),
('project_data_contracts',1,'published','transformation','{}','{"decision":"project_data_contracts"}',null,'Project Blueprint inputs and outputs as data contracts',now()),
('project_steps',1,'published','transformation','{}','{"decision":"project_steps"}',null,'Project Blueprint components as abstract steps',now()),
('project_dependencies',1,'published','transformation','{}','{"decision":"project_dependencies"}',null,'Project Blueprint topology as dependencies',now()),
('project_controls',1,'published','transformation','{}','{"decision":"project_controls"}',null,'Project approval edges as human controls',now()),
('project_error_policies',1,'published','transformation','{}','{"decision":"project_error_policies"}',null,'Require an abstract failure policy for each step',now()),
('project_security',1,'published','transformation','{}','{"decision":"project_security"}',null,'Project connector and constraint security requirements',now()),
('project_observability',1,'published','transformation','{}','{"decision":"project_observability"}',null,'Require observable completion for each step',now()),
('project_acceptance_criteria',1,'published','transformation','{}','{"decision":"project_acceptance_criteria"}',null,'Project outputs as acceptance criteria',now()),
('source_published',1,'published','validation','{}','{"operator":"source_published"}','error','Source Solution Blueprint must be published',now()),
('elements_present',1,'published','validation','{}','{"operator":"elements_present"}','error','Specification must contain elements',now()),
('unique_local_ids',1,'published','validation','{}','{"operator":"unique_local_ids"}','error','Element local identifiers must be unique',now()),
('references_valid',1,'published','validation','{}','{"operator":"references_valid"}','error','Dependencies must reference existing steps',now()),
('graph_acyclic',1,'published','validation','{}','{"operator":"graph_acyclic"}','error','Step dependency graph must be acyclic',now()),
('data_contracts_resolved',1,'published','validation','{}','{"operator":"data_contracts_resolved"}','error','Step data contracts must resolve',now()),
('provenance_complete',1,'published','validation','{}','{"operator":"provenance_complete"}','error','Every generated element must preserve provenance',now());
