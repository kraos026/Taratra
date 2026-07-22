create type public.implementation_difficulty as enum ('very_low', 'low', 'medium', 'high', 'very_high');

create table public.recommendations (
  id uuid primary key default gen_random_uuid(), organization_id uuid references public.organizations(id) on delete cascade,
  code text not null check (code ~ '^[A-Z][A-Z0-9_]{1,119}$'), version integer not null default 1 check (version > 0),
  title text not null check (char_length(btrim(title)) between 2 and 180), summary text not null, description text not null,
  implementation_difficulty public.implementation_difficulty not null, category_id uuid not null references public.rule_categories(id),
  active boolean not null default true, created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index recommendations_system_code_version_idx on public.recommendations(code, version) where organization_id is null;
create unique index recommendations_org_code_version_idx on public.recommendations(organization_id, code, version) where organization_id is not null;

create table public.recommendation_impacts (
  recommendation_id uuid primary key references public.recommendations(id) on delete cascade,
  estimated_hours_per_month numeric(12,2) not null check (estimated_hours_per_month >= 0), estimated_cost numeric(14,2) not null check (estimated_cost >= 0),
  estimated_savings numeric(14,2) not null default 0, metadata_json jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata_json) = 'object'),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);

create table public.rule_recommendations (
  rule_id uuid not null references public.rules(id) on delete cascade, recommendation_id uuid not null references public.recommendations(id) on delete cascade,
  active boolean not null default true, priority integer not null default 100 check (priority > 0), created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (rule_id, recommendation_id)
);

create table public.roi_profiles (
  id uuid primary key default gen_random_uuid(), organization_id uuid references public.organizations(id) on delete cascade,
  code text not null check (code ~ '^[A-Z][A-Z0-9_]{1,79}$'), name text not null, currency char(3) not null check (currency ~ '^[A-Z]{3}$'),
  hourly_cost numeric(14,2) not null check (hourly_cost >= 0), working_days_year numeric(6,2) not null check (working_days_year > 0),
  working_hours_day numeric(4,2) not null check (working_hours_day > 0), active boolean not null default true,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create unique index roi_profiles_system_code_idx on public.roi_profiles(code) where organization_id is null;
create unique index roi_profiles_org_code_idx on public.roi_profiles(organization_id, code) where organization_id is not null;

create table public.audit_recommendations (
  id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id) on delete cascade,
  audit_id uuid not null, recommendation_id uuid not null references public.recommendations(id), evaluation_id uuid not null,
  priority text not null check (priority in ('quick_win','strategic','nice_to_have','low_priority')),
  estimated_hours_year numeric(14,2) not null, estimated_savings_year numeric(14,2) not null, roi_percentage numeric(14,2) not null,
  implementation_cost numeric(14,2) not null, payback_months numeric(14,2), quick_win boolean not null, strategic boolean not null,
  metadata_json jsonb not null default '{}'::jsonb, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key (audit_id, organization_id) references public.audits(id, organization_id) on delete cascade,
  unique (audit_id, recommendation_id)
);
create index audit_recommendations_org_audit_idx on public.audit_recommendations(organization_id, audit_id);

create function private.enforce_recommendation_scope() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from public.rule_categories c where c.id=new.category_id and (c.organization_id is null or c.organization_id=new.organization_id)) then
    raise exception 'Recommendation category is outside its organization scope' using errcode='23514';
  end if;
  return new;
end; $$;
create trigger recommendations_enforce_scope before insert or update of organization_id,category_id on public.recommendations for each row execute function private.enforce_recommendation_scope();

create function private.enforce_rule_recommendation_scope() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if not exists(
    select 1 from public.rules ru join public.recommendations re on re.id=new.recommendation_id
    where ru.id=new.rule_id and (ru.organization_id is null or ru.organization_id=re.organization_id)
      and (re.organization_id is null or ru.organization_id is null or re.organization_id=ru.organization_id)
  ) then raise exception 'Rule and recommendation scopes are incompatible' using errcode='23514'; end if;
  return new;
end; $$;
create trigger rule_recommendations_enforce_scope before insert or update on public.rule_recommendations for each row execute function private.enforce_rule_recommendation_scope();

create function private.enforce_audit_recommendation_scope() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if not exists(select 1 from public.audits a where a.id=new.audit_id and a.organization_id=new.organization_id) then
    raise exception 'Audit recommendation audit is outside its organization scope' using errcode='23514';
  end if;
  if not exists(select 1 from public.recommendations r where r.id=new.recommendation_id and (r.organization_id is null or r.organization_id=new.organization_id)) then
    raise exception 'Recommendation is outside its organization scope' using errcode='23514';
  end if;
  return new;
end; $$;
create trigger audit_recommendations_enforce_scope before insert or update on public.audit_recommendations for each row execute function private.enforce_audit_recommendation_scope();

create trigger recommendations_set_updated_at before update on public.recommendations for each row execute function private.set_updated_at();
create trigger recommendation_impacts_set_updated_at before update on public.recommendation_impacts for each row execute function private.set_updated_at();
create trigger rule_recommendations_set_updated_at before update on public.rule_recommendations for each row execute function private.set_updated_at();
create trigger roi_profiles_set_updated_at before update on public.roi_profiles for each row execute function private.set_updated_at();
create trigger audit_recommendations_set_updated_at before update on public.audit_recommendations for each row execute function private.set_updated_at();

alter table public.recommendations enable row level security; alter table public.recommendation_impacts enable row level security;
alter table public.rule_recommendations enable row level security; alter table public.roi_profiles enable row level security; alter table public.audit_recommendations enable row level security;

create policy "members read recommendations" on public.recommendations for select to authenticated using (recommendations.organization_id is null or (select private.has_organization_role(recommendations.organization_id,array['owner','admin','consultant','viewer']::public.organization_role[])));
create policy "admins manage recommendations" on public.recommendations for all to authenticated using (recommendations.organization_id is not null and (select private.has_organization_role(recommendations.organization_id,array['owner','admin']::public.organization_role[]))) with check (recommendations.organization_id is not null and (select private.has_organization_role(recommendations.organization_id,array['owner','admin']::public.organization_role[])));
create policy "members read impacts" on public.recommendation_impacts for select to authenticated using (exists(select 1 from public.recommendations r where r.id=recommendation_impacts.recommendation_id and (r.organization_id is null or (select private.has_organization_role(r.organization_id,array['owner','admin','consultant','viewer']::public.organization_role[])))));
create policy "admins manage impacts" on public.recommendation_impacts for all to authenticated using (exists(select 1 from public.recommendations r where r.id=recommendation_impacts.recommendation_id and r.organization_id is not null and (select private.has_organization_role(r.organization_id,array['owner','admin']::public.organization_role[])))) with check (exists(select 1 from public.recommendations r where r.id=recommendation_impacts.recommendation_id and r.organization_id is not null and (select private.has_organization_role(r.organization_id,array['owner','admin']::public.organization_role[]))));
create policy "members read mappings" on public.rule_recommendations for select to authenticated using (exists(select 1 from public.recommendations r where r.id=rule_recommendations.recommendation_id and (r.organization_id is null or (select private.has_organization_role(r.organization_id,array['owner','admin','consultant','viewer']::public.organization_role[])))));
create policy "admins manage mappings" on public.rule_recommendations for all to authenticated using (exists(select 1 from public.recommendations r where r.id=rule_recommendations.recommendation_id and r.organization_id is not null and (select private.has_organization_role(r.organization_id,array['owner','admin']::public.organization_role[])))) with check (exists(select 1 from public.recommendations r where r.id=rule_recommendations.recommendation_id and r.organization_id is not null and (select private.has_organization_role(r.organization_id,array['owner','admin']::public.organization_role[]))));
create policy "members read profiles" on public.roi_profiles for select to authenticated using (roi_profiles.organization_id is null or (select private.has_organization_role(roi_profiles.organization_id,array['owner','admin','consultant','viewer']::public.organization_role[])));
create policy "admins manage profiles" on public.roi_profiles for all to authenticated using (roi_profiles.organization_id is not null and (select private.has_organization_role(roi_profiles.organization_id,array['owner','admin']::public.organization_role[]))) with check (roi_profiles.organization_id is not null and (select private.has_organization_role(roi_profiles.organization_id,array['owner','admin']::public.organization_role[])));
create policy "members read audit recommendations" on public.audit_recommendations for select to authenticated using ((select private.has_organization_role(audit_recommendations.organization_id,array['owner','admin','consultant','viewer']::public.organization_role[])));
create policy "editors manage audit recommendations" on public.audit_recommendations for all to authenticated using ((select private.has_organization_role(audit_recommendations.organization_id,array['owner','admin','consultant']::public.organization_role[]))) with check ((select private.has_organization_role(audit_recommendations.organization_id,array['owner','admin','consultant']::public.organization_role[])));
grant select on public.recommendations,public.recommendation_impacts,public.rule_recommendations,public.roi_profiles,public.audit_recommendations to authenticated;
grant insert,update,delete on public.recommendations,public.recommendation_impacts,public.rule_recommendations,public.roi_profiles,public.audit_recommendations to authenticated;

insert into public.roi_profiles(id,code,name,currency,hourly_cost,working_days_year,working_hours_day) values
('82000000-0000-0000-0000-000000000001','MADAGASCAR','Madagascar','MGA',15000,220,8),('82000000-0000-0000-0000-000000000002','FRANCE','France','EUR',35,220,7.5),
('82000000-0000-0000-0000-000000000003','CANADA','Canada','CAD',45,220,8),('82000000-0000-0000-0000-000000000004','BELGIUM','Belgique','EUR',40,220,7.6),
('82000000-0000-0000-0000-000000000005','SWITZERLAND','Suisse','CHF',65,220,8),('82000000-0000-0000-0000-000000000006','LUXEMBOURG','Luxembourg','EUR',55,220,8),
('82000000-0000-0000-0000-000000000007','USA','USA','USD',50,220,8),('82000000-0000-0000-0000-000000000008','UK','UK','GBP',38,220,7.5);

with data(rule_code,code,title,difficulty,hours,cost) as (values
('CRM_ABSENT','INSTALL_CRM','Installer un CRM','medium',30,3500),('CRM_ABSENT','AUTOMATE_LEAD_CAPTURE','Automatiser la capture des prospects','low',12,900),
('EXCEL_USED','CENTRALIZE_OPERATIONAL_DATA','Centraliser les données opérationnelles','high',25,6000),('EXCEL_USED','AUTOMATE_SPREADSHEETS','Automatiser les feuilles de calcul','low',15,800),
('DOUBLE_ENTRY','REMOVE_DOUBLE_ENTRY','Supprimer la double saisie','medium',35,4000),('MANUAL_INVOICING','AUTOMATE_INVOICING','Automatiser la facturation','medium',22,2500),
('MANUAL_INVOICING','ELECTRONIC_SIGNATURE','Déployer la signature électronique','very_low',8,400),('LOW_DIGITAL_MATURITY','CLOUD_BACKUP','Mettre en place une sauvegarde cloud','low',6,700),
('EMAIL_SUPPORT_CHANNEL','CENTRALIZE_EMAILS','Centraliser les emails clients','low',16,1000),('HIGH_LEAD_VOLUME','AUTOMATE_LEAD_ASSIGNMENT','Automatiser l’attribution des prospects','medium',18,2200),
('NO_SALES_FOLLOWUP','CREATE_SALES_PIPELINE','Structurer le pipeline commercial','medium',20,2800),('MANUAL_DATA_TRANSFER','SYNCHRONIZE_BUSINESS_TOOLS','Synchroniser les outils métier','high',40,7500),
('HIGH_REPETITIVE_TASKS','ROBOTIZE_REPETITIVE_TASKS','Automatiser les tâches répétitives','medium',45,5000),('MANUAL_VALIDATION','DIGITAL_APPROVAL_WORKFLOW','Créer un workflow de validation','medium',20,2400),
('MANUAL_PAYMENT_REMINDERS','AUTOMATE_PAYMENT_REMINDERS','Automatiser les relances','low',14,900),('COST_REDUCTION_PRIORITY','EXPENSE_CAPTURE','Automatiser la saisie des dépenses','low',12,1200),
('QUARTERLY_REPORTING','AUTOMATE_MONTHLY_REPORTING','Automatiser le reporting mensuel','medium',24,3000),('DISCONNECTED_TOOLS','SSO_PASSWORD_MANAGER','Déployer SSO et gestionnaire de mots de passe','medium',10,1800),
('MATURITY_NOT_ADVANCED','ENABLE_MFA','Activer l’authentification multifacteur','very_low',3,300),('PILOTAGE_PRIORITY','AUTOMATE_ACCESS_REVIEWS','Automatiser les revues d’accès','medium',8,1600),
('EMAIL_SUPPORT_CHANNEL','INSTALL_TICKETING','Installer un outil de ticketing','medium',20,2600),('SLOW_FIRST_RESPONSE','AUTOMATE_TICKET_ROUTING','Automatiser le routage des tickets','low',18,1200),
('CUSTOMER_EXPERIENCE_PRIORITY','CREATE_KNOWLEDGE_BASE','Créer une base de connaissances','medium',14,2000),('CRM_ABSENT','AUTOMATE_QUOTES','Automatiser les devis','medium',18,2300),
('MANUAL_DATA_TRANSFER','ACCOUNTING_SYNC','Synchroniser la comptabilité','high',28,5500),('HIGH_REPETITIVE_TASKS','HR_WORKFLOW','Automatiser les workflows RH','high',22,4800),
('EMAIL_SUPPORT_CHANNEL','CUSTOMER_SELF_SERVICE','Créer un portail client','high',30,7000),('QUARTERLY_REPORTING','MANAGEMENT_DASHBOARD','Automatiser les indicateurs de pilotage','medium',18,3200),
('MANUAL_PAYMENT_REMINDERS','AUTOMATE_CASH_COLLECTION','Automatiser le suivi des encaissements','medium',16,2600),('PILOTAGE_PRIORITY','ACCESS_GOVERNANCE','Formaliser la gouvernance des accès','high',6,3500)
), inserted as (
 insert into public.recommendations(organization_id,code,version,title,summary,description,implementation_difficulty,category_id)
 select null,d.code,1,d.title,'Hypothèse configurable du MVP',d.title||'. Estimation de démonstration à remplacer par une valeur métier validée.',d.difficulty::public.implementation_difficulty,r.category_id
 from data d join public.rules r on r.code=d.rule_code and r.organization_id is null returning id,code
)
insert into public.recommendation_impacts(recommendation_id,estimated_hours_per_month,estimated_cost,estimated_savings,metadata_json)
select i.id,d.hours,d.cost,0,'{"assumptionType":"mvp_demo","configurable":true}' from inserted i join data d on d.code=i.code;

insert into public.rule_recommendations(rule_id,recommendation_id,priority)
select r.id,rec.id,row_number() over(partition by r.id order by rec.code)::int
from public.recommendations rec join public.rules r on r.category_id=rec.category_id and r.organization_id is null
where exists (select 1 from (values
('CRM_ABSENT','INSTALL_CRM'),('CRM_ABSENT','AUTOMATE_LEAD_CAPTURE'),('EXCEL_USED','CENTRALIZE_OPERATIONAL_DATA'),('EXCEL_USED','AUTOMATE_SPREADSHEETS'),('DOUBLE_ENTRY','REMOVE_DOUBLE_ENTRY'),('MANUAL_INVOICING','AUTOMATE_INVOICING'),('MANUAL_INVOICING','ELECTRONIC_SIGNATURE'),('LOW_DIGITAL_MATURITY','CLOUD_BACKUP'),('EMAIL_SUPPORT_CHANNEL','CENTRALIZE_EMAILS'),('HIGH_LEAD_VOLUME','AUTOMATE_LEAD_ASSIGNMENT'),('NO_SALES_FOLLOWUP','CREATE_SALES_PIPELINE'),('MANUAL_DATA_TRANSFER','SYNCHRONIZE_BUSINESS_TOOLS'),('HIGH_REPETITIVE_TASKS','ROBOTIZE_REPETITIVE_TASKS'),('MANUAL_VALIDATION','DIGITAL_APPROVAL_WORKFLOW'),('MANUAL_PAYMENT_REMINDERS','AUTOMATE_PAYMENT_REMINDERS'),('COST_REDUCTION_PRIORITY','EXPENSE_CAPTURE'),('QUARTERLY_REPORTING','AUTOMATE_MONTHLY_REPORTING'),('DISCONNECTED_TOOLS','SSO_PASSWORD_MANAGER'),('MATURITY_NOT_ADVANCED','ENABLE_MFA'),('PILOTAGE_PRIORITY','AUTOMATE_ACCESS_REVIEWS'),('EMAIL_SUPPORT_CHANNEL','INSTALL_TICKETING'),('SLOW_FIRST_RESPONSE','AUTOMATE_TICKET_ROUTING'),('CUSTOMER_EXPERIENCE_PRIORITY','CREATE_KNOWLEDGE_BASE'),('CRM_ABSENT','AUTOMATE_QUOTES'),('MANUAL_DATA_TRANSFER','ACCOUNTING_SYNC'),('HIGH_REPETITIVE_TASKS','HR_WORKFLOW'),('EMAIL_SUPPORT_CHANNEL','CUSTOMER_SELF_SERVICE'),('QUARTERLY_REPORTING','MANAGEMENT_DASHBOARD'),('MANUAL_PAYMENT_REMINDERS','AUTOMATE_CASH_COLLECTION'),('PILOTAGE_PRIORITY','ACCESS_GOVERNANCE')) v(rule_code,recommendation_code) where v.rule_code=r.code and v.recommendation_code=rec.code);
