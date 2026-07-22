create type public.rule_severity as enum ('info', 'low', 'medium', 'high', 'critical');

create table public.rule_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  code text not null check (code ~ '^[a-z][a-z0-9_]{1,79}$'),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  description text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index rule_categories_system_code_idx on public.rule_categories(code) where organization_id is null;
create unique index rule_categories_organization_code_idx on public.rule_categories(organization_id, code) where organization_id is not null;

create table public.rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  category_id uuid not null references public.rule_categories(id),
  code text not null check (code ~ '^[A-Z][A-Z0-9_]{1,119}$'),
  name text not null check (char_length(btrim(name)) between 2 and 160),
  description text,
  priority integer not null default 100 check (priority > 0),
  severity public.rule_severity not null default 'medium',
  weight numeric(12, 4) not null default 1 check (weight >= 0),
  condition_json jsonb not null check (jsonb_typeof(condition_json) = 'object'),
  result_json jsonb not null default '{}'::jsonb check (jsonb_typeof(result_json) = 'object'),
  active boolean not null default true,
  version integer not null default 1 check (version > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index rules_system_code_version_idx on public.rules(code, version) where organization_id is null;
create unique index rules_organization_code_version_idx on public.rules(organization_id, code, version) where organization_id is not null;
create index rules_category_active_idx on public.rules(category_id, active, priority);

create table public.rule_results (
  id uuid primary key default gen_random_uuid(),
  rule_id uuid not null references public.rules(id) on delete cascade,
  result_key text not null check (char_length(btrim(result_key)) between 1 and 80),
  label text not null check (char_length(btrim(label)) between 1 and 200),
  description text,
  score numeric(12, 4) not null default 0,
  metadata_json jsonb not null default '{}'::jsonb check (jsonb_typeof(metadata_json) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (rule_id, result_key)
);

create table public.audit_rule_matches (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  audit_id uuid not null,
  rule_id uuid not null references public.rules(id),
  matched boolean not null,
  score numeric(12, 4) not null default 0 check (score >= 0),
  details_json jsonb not null default '{}'::jsonb check (jsonb_typeof(details_json) = 'object'),
  evaluated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (audit_id, organization_id) references public.audits(id, organization_id) on delete cascade,
  unique (audit_id, rule_id)
);
create index audit_rule_matches_organization_audit_idx on public.audit_rule_matches(organization_id, audit_id);

create table public.audit_scores (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  audit_id uuid not null,
  category_id uuid references public.rule_categories(id),
  score numeric(12, 4) not null default 0 check (score >= 0),
  total numeric(12, 4) not null default 0 check (total >= 0),
  percentage numeric(7, 4) not null default 0 check (percentage between 0 and 100),
  evaluated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (audit_id, organization_id) references public.audits(id, organization_id) on delete cascade
);
create unique index audit_scores_category_idx on public.audit_scores(audit_id, category_id) where category_id is not null;
create unique index audit_scores_global_idx on public.audit_scores(audit_id) where category_id is null;
create index audit_scores_organization_audit_idx on public.audit_scores(organization_id, audit_id);

create function private.enforce_rule_category_scope()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.rule_categories as rc
    where rc.id = new.category_id
      and (rc.organization_id is null or rc.organization_id = new.organization_id)
  ) then
    raise exception 'Rule category must have the same organization scope as the rule' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger rules_enforce_category_scope before insert or update of category_id, organization_id on public.rules
for each row execute function private.enforce_rule_category_scope();

create function private.enforce_rule_execution_scope()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.audits as a
    where a.id = new.audit_id and a.organization_id = new.organization_id
  ) then raise exception 'Rule execution audit must belong to the organization' using errcode = '23514'; end if;
  if tg_table_name = 'audit_rule_matches' and not exists (
    select 1 from public.rules as r
    where r.id = new.rule_id and (r.organization_id is null or r.organization_id = new.organization_id)
  ) then raise exception 'Rule is not available to the audit organization' using errcode = '23514'; end if;
  if tg_table_name = 'audit_scores' and new.category_id is not null and not exists (
    select 1 from public.rule_categories as rc
    where rc.id = new.category_id and (rc.organization_id is null or rc.organization_id = new.organization_id)
  ) then raise exception 'Rule category is not available to the audit organization' using errcode = '23514'; end if;
  return new;
end;
$$;
create trigger audit_rule_matches_enforce_scope before insert or update on public.audit_rule_matches
for each row execute function private.enforce_rule_execution_scope();
create trigger audit_scores_enforce_scope before insert or update on public.audit_scores
for each row execute function private.enforce_rule_execution_scope();

create trigger rule_categories_set_updated_at before update on public.rule_categories for each row execute function private.set_updated_at();
create trigger rules_set_updated_at before update on public.rules for each row execute function private.set_updated_at();
create trigger rule_results_set_updated_at before update on public.rule_results for each row execute function private.set_updated_at();
create trigger audit_rule_matches_set_updated_at before update on public.audit_rule_matches for each row execute function private.set_updated_at();
create trigger audit_scores_set_updated_at before update on public.audit_scores for each row execute function private.set_updated_at();

alter table public.rule_categories enable row level security;
alter table public.rules enable row level security;
alter table public.rule_results enable row level security;
alter table public.audit_rule_matches enable row level security;
alter table public.audit_scores enable row level security;

create policy "members read available rule categories" on public.rule_categories for select to authenticated
using (rule_categories.organization_id is null or (select private.has_organization_role(rule_categories.organization_id, array['owner','admin','consultant','viewer']::public.organization_role[])));
create policy "admins create organization rule categories" on public.rule_categories for insert to authenticated
with check (rule_categories.organization_id is not null and (select private.has_organization_role(rule_categories.organization_id, array['owner','admin']::public.organization_role[])));
create policy "admins update organization rule categories" on public.rule_categories for update to authenticated
using (rule_categories.organization_id is not null and (select private.has_organization_role(rule_categories.organization_id, array['owner','admin']::public.organization_role[])))
with check (rule_categories.organization_id is not null and (select private.has_organization_role(rule_categories.organization_id, array['owner','admin']::public.organization_role[])));

create policy "members read available rules" on public.rules for select to authenticated
using (rules.organization_id is null or (select private.has_organization_role(rules.organization_id, array['owner','admin','consultant','viewer']::public.organization_role[])));
create policy "admins create organization rules" on public.rules for insert to authenticated
with check (rules.organization_id is not null and (select private.has_organization_role(rules.organization_id, array['owner','admin']::public.organization_role[])));
create policy "admins update organization rules" on public.rules for update to authenticated
using (rules.organization_id is not null and (select private.has_organization_role(rules.organization_id, array['owner','admin']::public.organization_role[])))
with check (rules.organization_id is not null and (select private.has_organization_role(rules.organization_id, array['owner','admin']::public.organization_role[])));

create policy "members read available rule results" on public.rule_results for select to authenticated
using (exists (select 1 from public.rules as r where r.id = rule_results.rule_id and (r.organization_id is null or (select private.has_organization_role(r.organization_id, array['owner','admin','consultant','viewer']::public.organization_role[])))));
create policy "admins manage organization rule results" on public.rule_results for all to authenticated
using (exists (select 1 from public.rules as r where r.id = rule_results.rule_id and r.organization_id is not null and (select private.has_organization_role(r.organization_id, array['owner','admin']::public.organization_role[]))))
with check (exists (select 1 from public.rules as r where r.id = rule_results.rule_id and r.organization_id is not null and (select private.has_organization_role(r.organization_id, array['owner','admin']::public.organization_role[]))));

create policy "members read own audit rule matches" on public.audit_rule_matches for select to authenticated
using ((select private.has_organization_role(audit_rule_matches.organization_id, array['owner','admin','consultant','viewer']::public.organization_role[])));
create policy "editors create own audit rule matches" on public.audit_rule_matches for insert to authenticated
with check ((select private.has_organization_role(audit_rule_matches.organization_id, array['owner','admin','consultant']::public.organization_role[])));
create policy "editors update own audit rule matches" on public.audit_rule_matches for update to authenticated
using ((select private.has_organization_role(audit_rule_matches.organization_id, array['owner','admin','consultant']::public.organization_role[])))
with check ((select private.has_organization_role(audit_rule_matches.organization_id, array['owner','admin','consultant']::public.organization_role[])));
create policy "editors delete own audit rule matches" on public.audit_rule_matches for delete to authenticated
using ((select private.has_organization_role(audit_rule_matches.organization_id, array['owner','admin','consultant']::public.organization_role[])));

create policy "members read own audit scores" on public.audit_scores for select to authenticated
using ((select private.has_organization_role(audit_scores.organization_id, array['owner','admin','consultant','viewer']::public.organization_role[])));
create policy "editors create own audit scores" on public.audit_scores for insert to authenticated
with check ((select private.has_organization_role(audit_scores.organization_id, array['owner','admin','consultant']::public.organization_role[])));
create policy "editors update own audit scores" on public.audit_scores for update to authenticated
using ((select private.has_organization_role(audit_scores.organization_id, array['owner','admin','consultant']::public.organization_role[])))
with check ((select private.has_organization_role(audit_scores.organization_id, array['owner','admin','consultant']::public.organization_role[])));
create policy "editors delete own audit scores" on public.audit_scores for delete to authenticated
using ((select private.has_organization_role(audit_scores.organization_id, array['owner','admin','consultant']::public.organization_role[])));

grant select on public.rule_categories, public.rules, public.rule_results, public.audit_rule_matches, public.audit_scores to authenticated;
grant insert, update on public.rule_categories, public.rules, public.rule_results to authenticated;
grant insert, update, delete on public.audit_rule_matches, public.audit_scores to authenticated;

insert into public.rule_categories(id, code, name, description) values
('80000000-0000-0000-0000-000000000001','sales','Ventes et CRM','Processus commerciaux et relation client'),
('80000000-0000-0000-0000-000000000002','operations','Opérations','Exécution et circulation des données'),
('80000000-0000-0000-0000-000000000003','finance','Finance','Facturation, paiements et clôture'),
('80000000-0000-0000-0000-000000000004','security','Sécurité','Sauvegarde, accès et continuité'),
('80000000-0000-0000-0000-000000000005','support','Support client','Canaux et suivi des demandes');

insert into public.rules(id, category_id, code, name, description, priority, severity, weight, condition_json, result_json) values
('81000000-0000-0000-0000-000000000001','80000000-0000-0000-0000-000000000001','CRM_ABSENT','CRM absent','Aucun CRM utilisé',10,'high',8,'{"fact":"crm_used","operator":"equal","value":false}','{"key":"crm_absent","label":"CRM absent"}'),
('81000000-0000-0000-0000-000000000002','80000000-0000-0000-0000-000000000002','EXCEL_USED','Excel utilisé','Excel utilisé comme outil opérationnel',20,'medium',5,'{"fact":"excel_used","operator":"equal","value":true}','{"key":"excel_used","label":"Dépendance à Excel"}'),
('81000000-0000-0000-0000-000000000003','80000000-0000-0000-0000-000000000002','DOUBLE_ENTRY','Double saisie','Données saisies plusieurs fois',10,'high',8,'{"fact":"double_entry","operator":"equal","value":true}','{"key":"double_entry","label":"Double saisie"}'),
('81000000-0000-0000-0000-000000000004','80000000-0000-0000-0000-000000000003','MANUAL_INVOICING','Facturation manuelle','Factures créées manuellement',10,'high',8,'{"fact":"invoicing_mode","operator":"equal","value":"manual"}','{"key":"manual_invoicing","label":"Facturation manuelle"}'),
('81000000-0000-0000-0000-000000000005','80000000-0000-0000-0000-000000000004','NO_BACKUP','Absence de sauvegarde','Aucune sauvegarde régulière',5,'critical',10,'{"fact":"backup_enabled","operator":"equal","value":false}','{"key":"no_backup","label":"Absence de sauvegarde"}'),
('81000000-0000-0000-0000-000000000006','80000000-0000-0000-0000-000000000005','EMAIL_ONLY_SUPPORT','Support par email uniquement','Le support utilise seulement les emails',20,'medium',5,'{"fact":"support_channels","operator":"equal","value":["email"]}','{"key":"email_only_support","label":"Support uniquement par email"}'),
('81000000-0000-0000-0000-000000000007','80000000-0000-0000-0000-000000000001','MANUAL_LEAD_ASSIGNMENT','Attribution manuelle des prospects','Les prospects sont distribués manuellement',30,'medium',4,'{"fact":"lead_assignment","operator":"equal","value":"manual"}','{"key":"manual_leads","label":"Attribution manuelle des prospects"}'),
('81000000-0000-0000-0000-000000000008','80000000-0000-0000-0000-000000000001','NO_SALES_PIPELINE','Absence de pipeline commercial','Aucun suivi structuré du pipeline',15,'high',7,'{"fact":"sales_pipeline","operator":"isEmpty"}','{"key":"no_pipeline","label":"Pipeline commercial absent"}'),
('81000000-0000-0000-0000-000000000009','80000000-0000-0000-0000-000000000002','MANUAL_DATA_TRANSFER','Transfert manuel des données','Les données sont copiées entre outils',15,'high',7,'{"fact":"manual_data_transfer","operator":"equal","value":true}','{"key":"manual_transfer","label":"Transfert manuel des données"}'),
('81000000-0000-0000-0000-000000000010','80000000-0000-0000-0000-000000000002','HIGH_REPETITIVE_TASKS','Tâches répétitives fréquentes','Volume important de tâches répétitives',20,'high',7,'{"fact":"repetitive_tasks_per_week","operator":"greaterOrEqual","value":20}','{"key":"repetitive_tasks","label":"Tâches répétitives fréquentes"}'),
('81000000-0000-0000-0000-000000000011','80000000-0000-0000-0000-000000000002','NO_WORKFLOW_TOOL','Absence de workflow','Aucun outil de workflow utilisé',25,'medium',5,'{"fact":"workflow_tool","operator":"isEmpty"}','{"key":"no_workflow","label":"Outil de workflow absent"}'),
('81000000-0000-0000-0000-000000000012','80000000-0000-0000-0000-000000000003','MANUAL_PAYMENT_REMINDERS','Relances de paiement manuelles','Les impayés sont relancés manuellement',20,'medium',5,'{"fact":"payment_reminders","operator":"equal","value":"manual"}','{"key":"manual_reminders","label":"Relances manuelles"}'),
('81000000-0000-0000-0000-000000000013','80000000-0000-0000-0000-000000000003','MANUAL_EXPENSE_ENTRY','Saisie manuelle des dépenses','Les dépenses sont ressaisies',30,'medium',4,'{"fact":"expense_entry","operator":"equal","value":"manual"}','{"key":"manual_expenses","label":"Saisie manuelle des dépenses"}'),
('81000000-0000-0000-0000-000000000014','80000000-0000-0000-0000-000000000003','SLOW_MONTH_CLOSE','Clôture mensuelle lente','La clôture dépasse cinq jours',30,'medium',4,'{"fact":"month_close_days","operator":"greaterThan","value":5}','{"key":"slow_close","label":"Clôture mensuelle lente"}'),
('81000000-0000-0000-0000-000000000015','80000000-0000-0000-0000-000000000004','SHARED_PASSWORDS','Mots de passe partagés','Des identifiants sont partagés',5,'critical',10,'{"fact":"shared_passwords","operator":"equal","value":true}','{"key":"shared_passwords","label":"Mots de passe partagés"}'),
('81000000-0000-0000-0000-000000000016','80000000-0000-0000-0000-000000000004','NO_MFA','Absence de MFA','Authentification multifacteur non utilisée',10,'high',8,'{"fact":"mfa_enabled","operator":"equal","value":false}','{"key":"no_mfa","label":"MFA absent"}'),
('81000000-0000-0000-0000-000000000017','80000000-0000-0000-0000-000000000004','STALE_ACCESS_REVIEW','Revue des accès insuffisante','Les accès sont rarement revus',20,'high',7,'{"fact":"access_review_months","operator":"greaterThan","value":6}','{"key":"stale_access","label":"Revue des accès insuffisante"}'),
('81000000-0000-0000-0000-000000000018','80000000-0000-0000-0000-000000000005','NO_TICKETING','Absence de ticketing','Les demandes ne sont pas tracées',10,'high',7,'{"fact":"ticketing_tool","operator":"isEmpty"}','{"key":"no_ticketing","label":"Ticketing absent"}'),
('81000000-0000-0000-0000-000000000019','80000000-0000-0000-0000-000000000005','SLOW_FIRST_RESPONSE','Première réponse lente','Le délai dépasse huit heures',25,'medium',5,'{"fact":"first_response_hours","operator":"greaterThan","value":8}','{"key":"slow_response","label":"Première réponse lente"}'),
('81000000-0000-0000-0000-000000000020','80000000-0000-0000-0000-000000000005','NO_SUPPORT_KB','Absence de base de connaissances','Aucune base de connaissances support',30,'medium',4,'{"fact":"knowledge_base","operator":"isEmpty"}','{"key":"no_kb","label":"Base de connaissances absente"}');

insert into public.rule_results(rule_id, result_key, label, description, score)
select rules.id, rules.result_json->>'key', rules.result_json->>'label', rules.description, rules.weight
from public.rules
where rules.organization_id is null;
