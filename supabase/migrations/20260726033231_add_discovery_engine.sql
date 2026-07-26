create type public.discovery_status as enum ('draft','in_progress','completed','validated','archived');
create type public.discovery_step as enum ('company','business','organization','software','processes','review');
create type public.offering_type as enum ('product','service');

create table public.company_profiles (
  company_id uuid primary key, organization_id uuid not null references public.organizations(id) on delete cascade,
  industry text, country_code char(2), revenue_amount numeric(18,2), revenue_currency char(3), revenue_year integer,
  business_model text, growth_stage text, employee_count integer check(employee_count is null or employee_count >= 0),
  metadata_json jsonb not null default '{}' check(jsonb_typeof(metadata_json)='object'),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key(organization_id,company_id) references public.companies(organization_id,id) on delete cascade
);
create table public.company_offerings (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  company_id uuid not null, type public.offering_type not null, name text not null, description text,
  active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key(organization_id,company_id) references public.companies(organization_id,id) on delete cascade
);
create table public.departments (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  company_id uuid not null, name text not null, description text, headcount integer check(headcount is null or headcount>=0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key(organization_id,company_id) references public.companies(organization_id,id) on delete cascade,
  unique(id,organization_id,company_id)
);
create table public.company_roles (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  company_id uuid not null, department_id uuid, title text not null,
  headcount integer not null default 1 check(headcount>=0), responsibilities_json jsonb not null default '[]' check(jsonb_typeof(responsibilities_json)='array'),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key(organization_id,company_id) references public.companies(organization_id,id) on delete cascade,
  foreign key(department_id,organization_id,company_id) references public.departments(id,organization_id,company_id)
);
create table public.software_categories (
  id uuid primary key default gen_random_uuid(), organization_id uuid references public.organizations(id) on delete cascade,
  code text not null, name text not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index software_categories_system_code_idx on public.software_categories(code) where organization_id is null;
create unique index software_categories_org_code_idx on public.software_categories(organization_id,code) where organization_id is not null;
create table public.software (
  id uuid primary key default gen_random_uuid(), organization_id uuid references public.organizations(id) on delete cascade,
  category_id uuid references public.software_categories(id), name text not null, vendor text, active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.company_software (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  company_id uuid not null, software_id uuid references public.software(id), custom_name text, purpose text,
  criticality integer check(criticality between 1 and 5), users_count integer check(users_count is null or users_count>=0),
  metadata_json jsonb not null default '{}' check(jsonb_typeof(metadata_json)='object'), created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key(organization_id,company_id) references public.companies(organization_id,id) on delete cascade,
  check(software_id is not null or nullif(btrim(custom_name),'') is not null)
);
create table public.process_categories (
  id uuid primary key default gen_random_uuid(), organization_id uuid references public.organizations(id) on delete cascade,
  code text not null, name text not null, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index process_categories_system_code_idx on public.process_categories(code) where organization_id is null;
create unique index process_categories_org_code_idx on public.process_categories(organization_id,code) where organization_id is not null;
create table public.business_processes (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  company_id uuid not null, category_id uuid references public.process_categories(id), department_id uuid,
  name text not null, description text, frequency text, volume numeric(14,2), manual_hours_month numeric(12,2) check(manual_hours_month is null or manual_hours_month>=0),
  pain_points_json jsonb not null default '[]' check(jsonb_typeof(pain_points_json)='array'), metadata_json jsonb not null default '{}' check(jsonb_typeof(metadata_json)='object'),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key(organization_id,company_id) references public.companies(organization_id,id) on delete cascade,
  foreign key(department_id,organization_id,company_id) references public.departments(id,organization_id,company_id)
);
create table public.company_objectives (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  company_id uuid not null, title text not null, description text, priority integer not null default 3 check(priority between 1 and 5), target_date date,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), foreign key(organization_id,company_id) references public.companies(organization_id,id) on delete cascade
);
create table public.business_challenges (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  company_id uuid not null, title text not null, description text, severity integer not null default 3 check(severity between 1 and 5),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(), foreign key(organization_id,company_id) references public.companies(organization_id,id) on delete cascade
);
create table public.discovery_sessions (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  company_id uuid not null, status public.discovery_status not null default 'draft', current_step public.discovery_step not null default 'company',
  version integer not null default 1 check(version>0), lock_version integer not null default 1 check(lock_version>0), started_by uuid not null references auth.users(id),
  completed_at timestamptz, validated_at timestamptz, validated_by uuid references auth.users(id), archived_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key(organization_id,company_id) references public.companies(organization_id,id) on delete cascade,
  unique(id,organization_id)
);
create unique index discovery_sessions_active_company_idx on public.discovery_sessions(company_id) where status in ('draft','in_progress','completed');
create table public.discovery_answers (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  discovery_session_id uuid not null, step public.discovery_step not null,
  field_key text not null check(field_key ~ '^[a-z][a-z0-9_.]{1,119}$'), value_json jsonb not null, answered_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(discovery_session_id,field_key),
  foreign key(discovery_session_id,organization_id) references public.discovery_sessions(id,organization_id) on delete cascade
);

create index discovery_sessions_org_company_idx on public.discovery_sessions(organization_id,company_id);
create index discovery_answers_session_idx on public.discovery_answers(discovery_session_id,step);
create index departments_company_idx on public.departments(organization_id,company_id);
create index business_processes_company_idx on public.business_processes(organization_id,company_id);

do $$ declare t text; begin foreach t in array array['company_profiles','company_offerings','departments','company_roles','software_categories','software','company_software','process_categories','business_processes','company_objectives','business_challenges','discovery_sessions','discovery_answers'] loop execute format('create trigger %I_set_updated_at before update on public.%I for each row execute function private.set_updated_at()',t,t); execute format('alter table public.%I enable row level security',t); end loop; end $$;

create function private.discovery_session_organization(requested_session_id uuid) returns uuid language sql stable security definer set search_path='' as $$select organization_id from public.discovery_sessions where id=requested_session_id$$;
revoke execute on function private.discovery_session_organization(uuid) from public,anon; grant execute on function private.discovery_session_organization(uuid) to authenticated;

do $$ declare t text; begin foreach t in array array['company_profiles','company_offerings','departments','company_roles','company_software','business_processes','company_objectives','business_challenges','discovery_sessions'] loop
 execute format('create policy "members read %1$s" on public.%1$I for select to authenticated using ((select private.has_organization_role(%1$I.organization_id,array[''owner'',''admin'',''consultant'',''viewer'']::public.organization_role[])))',t);
 execute format('create policy "editors manage %1$s" on public.%1$I for all to authenticated using ((select private.has_organization_role(%1$I.organization_id,array[''owner'',''admin'',''consultant'']::public.organization_role[]))) with check ((select private.has_organization_role(%1$I.organization_id,array[''owner'',''admin'',''consultant'']::public.organization_role[])))',t);
end loop; end $$;
create policy "members read discovery answers" on public.discovery_answers for select to authenticated using ((select private.has_organization_role(discovery_answers.organization_id,array['owner','admin','consultant','viewer']::public.organization_role[])));
create policy "editors manage discovery answers" on public.discovery_answers for all to authenticated using ((select private.has_organization_role(discovery_answers.organization_id,array['owner','admin','consultant']::public.organization_role[]))) with check ((select private.has_organization_role(discovery_answers.organization_id,array['owner','admin','consultant']::public.organization_role[])));
create policy "members read software categories" on public.software_categories for select to authenticated using (software_categories.organization_id is null or (select private.has_organization_role(software_categories.organization_id,array['owner','admin','consultant','viewer']::public.organization_role[])));
create policy "editors manage software categories" on public.software_categories for all to authenticated using (software_categories.organization_id is not null and (select private.has_organization_role(software_categories.organization_id,array['owner','admin','consultant']::public.organization_role[]))) with check (software_categories.organization_id is not null and (select private.has_organization_role(software_categories.organization_id,array['owner','admin','consultant']::public.organization_role[])));
create policy "members read software" on public.software for select to authenticated using (software.organization_id is null or (select private.has_organization_role(software.organization_id,array['owner','admin','consultant','viewer']::public.organization_role[])));
create policy "editors manage software" on public.software for all to authenticated using (software.organization_id is not null and (select private.has_organization_role(software.organization_id,array['owner','admin','consultant']::public.organization_role[]))) with check (software.organization_id is not null and (select private.has_organization_role(software.organization_id,array['owner','admin','consultant']::public.organization_role[])));
create policy "members read process categories" on public.process_categories for select to authenticated using (process_categories.organization_id is null or (select private.has_organization_role(process_categories.organization_id,array['owner','admin','consultant','viewer']::public.organization_role[])));
create policy "editors manage process categories" on public.process_categories for all to authenticated using (process_categories.organization_id is not null and (select private.has_organization_role(process_categories.organization_id,array['owner','admin','consultant']::public.organization_role[]))) with check (process_categories.organization_id is not null and (select private.has_organization_role(process_categories.organization_id,array['owner','admin','consultant']::public.organization_role[])));
grant select,insert,update,delete on public.company_profiles,public.company_offerings,public.departments,public.company_roles,public.software_categories,public.software,public.company_software,public.process_categories,public.business_processes,public.company_objectives,public.business_challenges,public.discovery_sessions,public.discovery_answers to authenticated;

insert into public.software_categories(code,name) values ('crm','CRM'),('erp','ERP'),('accounting','Comptabilité'),('collaboration','Collaboration'),('marketing','Marketing'),('hr','Ressources humaines'),('analytics','Analyse'),('other','Autre');
insert into public.process_categories(code,name) values ('sales','Commercial'),('finance','Finance'),('hr','Ressources humaines'),('marketing','Marketing'),('it','IT'),('administration','Administration'),('operations','Opérations'),('support','Support client');
