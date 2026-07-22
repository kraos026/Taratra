alter table public.audit_rule_matches add column evaluation_id uuid not null default gen_random_uuid();
alter table public.audit_scores add column evaluation_id uuid not null default gen_random_uuid();
create index audit_rule_matches_evaluation_idx on public.audit_rule_matches(evaluation_id);
create index audit_scores_evaluation_idx on public.audit_scores(evaluation_id);

create function private.prevent_rule_decision_rewrite()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.code is distinct from new.code
    or old.category_id is distinct from new.category_id
    or old.severity is distinct from new.severity
    or old.weight is distinct from new.weight
    or old.condition_json is distinct from new.condition_json
    or old.result_json is distinct from new.result_json
    or old.version is distinct from new.version
  then raise exception 'Rule decision fields are immutable; create a new version' using errcode = '23514'; end if;
  return new;
end;
$$;
update public.rules as r set condition_json = v.condition_json
from (values
('CRM_ABSENT','{"fact":"sales.crm","operator":"equal","value":false}'::jsonb),
('EXCEL_USED','{"fact":"tools.list","operator":"contains","value":"Excel"}'::jsonb),
('DOUBLE_ENTRY','{"fact":"admin.manual_tasks","operator":"contains","value":"saisie"}'::jsonb),
('MANUAL_INVOICING','{"fact":"finance.invoicing","operator":"equal","value":false}'::jsonb),
('NO_BACKUP','{"fact":"general.digital_maturity","operator":"equal","value":"faible"}'::jsonb),
('EMAIL_ONLY_SUPPORT','{"fact":"support.channels","operator":"equal","value":"email"}'::jsonb),
('MANUAL_LEAD_ASSIGNMENT','{"fact":"sales.leads","operator":"greaterThan","value":50}'::jsonb),
('NO_SALES_PIPELINE','{"fact":"sales.followup","operator":"isEmpty"}'::jsonb),
('MANUAL_DATA_TRANSFER','{"fact":"tools.integrated","operator":"equal","value":false}'::jsonb),
('HIGH_REPETITIVE_TASKS','{"fact":"admin.hours","operator":"greaterThan","value":20}'::jsonb),
('NO_WORKFLOW_TOOL','{"fact":"admin.manual_tasks","operator":"contains","value":"validation"}'::jsonb),
('MANUAL_PAYMENT_REMINDERS','{"fact":"admin.manual_tasks","operator":"contains","value":"relance"}'::jsonb),
('MANUAL_EXPENSE_ENTRY','{"fact":"priority.areas","operator":"contains","value":"coûts"}'::jsonb),
('SLOW_MONTH_CLOSE','{"fact":"volume.reporting","operator":"equal","value":"trimestrielle"}'::jsonb),
('SHARED_PASSWORDS','{"fact":"tools.integrated","operator":"equal","value":false}'::jsonb),
('NO_MFA','{"fact":"general.digital_maturity","operator":"notEqual","value":"avancé"}'::jsonb),
('STALE_ACCESS_REVIEW','{"fact":"priority.areas","operator":"contains","value":"pilotage"}'::jsonb),
('NO_TICKETING','{"fact":"support.channels","operator":"equal","value":"email"}'::jsonb),
('SLOW_FIRST_RESPONSE','{"fact":"support.volume","operator":"greaterThan","value":100}'::jsonb),
('NO_SUPPORT_KB','{"fact":"priority.areas","operator":"contains","value":"expérience client"}'::jsonb)
) as v(code, condition_json)
where r.code = v.code and r.organization_id is null;

update public.rules as r
set code = v.new_code, name = v.new_name, description = v.new_description,
    result_json = jsonb_build_object('key', lower(v.new_code), 'label', v.new_name)
from (values
('NO_BACKUP','LOW_DIGITAL_MATURITY','Maturité numérique faible','La maturité numérique déclarée est faible'),
('MANUAL_LEAD_ASSIGNMENT','HIGH_LEAD_VOLUME','Volume de prospects élevé','Le volume mensuel de prospects dépasse 50'),
('NO_SALES_PIPELINE','NO_SALES_FOLLOWUP','Relance commerciale non décrite','Le processus de relance commerciale est vide'),
('NO_WORKFLOW_TOOL','MANUAL_VALIDATION','Validation administrative manuelle','La validation fait partie des tâches manuelles'),
('MANUAL_EXPENSE_ENTRY','COST_REDUCTION_PRIORITY','Réduction des coûts prioritaire','Les coûts sont un domaine prioritaire'),
('SLOW_MONTH_CLOSE','QUARTERLY_REPORTING','Reporting trimestriel','Le reporting est seulement trimestriel'),
('SHARED_PASSWORDS','DISCONNECTED_TOOLS','Outils non intégrés','Les outils n’échangent pas automatiquement leurs données'),
('NO_MFA','MATURITY_NOT_ADVANCED','Maturité numérique non avancée','La maturité numérique n’est pas avancée'),
('STALE_ACCESS_REVIEW','PILOTAGE_PRIORITY','Pilotage prioritaire','Le pilotage est un domaine prioritaire'),
('NO_TICKETING','EMAIL_SUPPORT_CHANNEL','Support principalement par email','Le canal principal du support est l’email'),
('NO_SUPPORT_KB','CUSTOMER_EXPERIENCE_PRIORITY','Expérience client prioritaire','L’expérience client est un domaine prioritaire')
) as v(old_code,new_code,new_name,new_description)
where r.code = v.old_code and r.organization_id is null;

update public.rule_results as rr
set result_key = r.result_json->>'key', label = r.result_json->>'label',
    description = r.description, score = r.weight
from public.rules as r where r.id = rr.rule_id and r.organization_id is null;

create trigger rules_prevent_decision_rewrite before update on public.rules
for each row execute function private.prevent_rule_decision_rewrite();
