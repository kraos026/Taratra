create type public.questionnaire_version_status as enum ('draft', 'published', 'archived');
create type public.question_type as enum (
  'short_text', 'long_text', 'number', 'boolean', 'single_choice',
  'multiple_choice', 'percentage', 'currency', 'date'
);
create type public.audit_status as enum ('draft', 'in_progress', 'completed', 'validated', 'archived');

create table public.questionnaire_templates (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id),
  name text not null check (char_length(btrim(name)) between 2 and 160),
  description text,
  category text not null check (char_length(btrim(category)) between 1 and 120),
  is_system boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  check ((is_system and organization_id is null) or (not is_system and organization_id is not null)),
  unique (id, organization_id)
);

create table public.questionnaire_versions (
  id uuid primary key default gen_random_uuid(),
  questionnaire_template_id uuid not null references public.questionnaire_templates(id),
  version_number integer not null check (version_number > 0),
  status public.questionnaire_version_status not null default 'draft',
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (questionnaire_template_id, version_number),
  unique (id, questionnaire_template_id),
  check ((status = 'published' and published_at is not null) or status <> 'published')
);

create unique index questionnaire_versions_one_published_idx
  on public.questionnaire_versions(questionnaire_template_id)
  where status = 'published';

create table public.questionnaire_sections (
  id uuid primary key default gen_random_uuid(),
  questionnaire_version_id uuid not null references public.questionnaire_versions(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 200),
  description text,
  position integer not null check (position > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (questionnaire_version_id, position),
  unique (id, questionnaire_version_id)
);

create table public.questionnaire_questions (
  id uuid primary key default gen_random_uuid(),
  questionnaire_section_id uuid not null references public.questionnaire_sections(id) on delete cascade,
  code text not null check (code ~ '^[A-Za-z][A-Za-z0-9_.-]{1,119}$'),
  label text not null check (char_length(btrim(label)) between 1 and 500),
  description text,
  question_type public.question_type not null,
  required boolean not null default false,
  position integer not null check (position > 0),
  options_json jsonb,
  validation_json jsonb not null default '{}'::jsonb,
  metadata_json jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (questionnaire_section_id, position),
  check (
    (question_type in ('single_choice', 'multiple_choice') and jsonb_typeof(options_json) = 'array' and jsonb_array_length(options_json) > 0)
    or (question_type not in ('single_choice', 'multiple_choice') and options_json is null)
  ),
  check (jsonb_typeof(validation_json) = 'object'),
  check (jsonb_typeof(metadata_json) = 'object')
);

alter table public.audits
  drop constraint audits_status_check,
  alter column status drop default,
  alter column status type public.audit_status using (
    case status
      when 'in_review' then 'in_progress'::public.audit_status
      else status::public.audit_status
    end
  ),
  alter column status set default 'draft',
  drop column questionnaire_version,
  add column questionnaire_version_id uuid references public.questionnaire_versions(id),
  add column started_at timestamptz,
  add column completed_at timestamptz,
  add column progress_percentage integer not null default 0 check (progress_percentage between 0 and 100),
  add column current_section_id uuid references public.questionnaire_sections(id),
  add unique (id, organization_id),
  add unique (id, questionnaire_version_id);

create table public.audit_answers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  audit_id uuid not null,
  question_id uuid not null references public.questionnaire_questions(id),
  value_json jsonb not null,
  answered_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (audit_id, question_id),
  foreign key (audit_id, organization_id) references public.audits(id, organization_id) on delete cascade
);

create index questionnaire_templates_organization_idx on public.questionnaire_templates(organization_id) where deleted_at is null;
create index questionnaire_templates_search_idx on public.questionnaire_templates(lower(name), category) where deleted_at is null;
create index questionnaire_versions_template_idx on public.questionnaire_versions(questionnaire_template_id, version_number desc);
create index questionnaire_sections_version_idx on public.questionnaire_sections(questionnaire_version_id, position);
create index questionnaire_questions_section_idx on public.questionnaire_questions(questionnaire_section_id, position);
create index audits_questionnaire_version_idx on public.audits(questionnaire_version_id);
create index audits_status_idx on public.audits(organization_id, status) where deleted_at is null;
create index audit_answers_audit_idx on public.audit_answers(audit_id);
create index audit_answers_organization_idx on public.audit_answers(organization_id);

create function private.questionnaire_version_for_section(section_id uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select questionnaire_sections.questionnaire_version_id
  from public.questionnaire_sections
  where questionnaire_sections.id = section_id;
$$;
revoke execute on function private.questionnaire_version_for_section(uuid) from public, anon;
grant execute on function private.questionnaire_version_for_section(uuid) to authenticated;

create function private.questionnaire_template_for_version(version_id uuid)
returns uuid language sql stable security definer set search_path = '' as $$
  select questionnaire_versions.questionnaire_template_id
  from public.questionnaire_versions
  where questionnaire_versions.id = version_id;
$$;
revoke execute on function private.questionnaire_template_for_version(uuid) from public, anon;
grant execute on function private.questionnaire_template_for_version(uuid) to authenticated;

create function private.can_read_questionnaire_template(template_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.questionnaire_templates as qt
    where qt.id = template_id and qt.deleted_at is null and (
      (qt.is_system and exists (
        select 1 from public.questionnaire_versions as qv
        where qv.questionnaire_template_id = qt.id and qv.status = 'published'
      ))
      or exists (
        select 1 from public.organization_members as m
        where m.organization_id = qt.organization_id and m.user_id = (select auth.uid())
          and (m.role <> 'viewer' or exists (
            select 1 from public.questionnaire_versions as qv
            where qv.questionnaire_template_id = qt.id and qv.status = 'published'
          ))
      )
    )
  );
$$;
revoke execute on function private.can_read_questionnaire_template(uuid) from public, anon;
grant execute on function private.can_read_questionnaire_template(uuid) to authenticated;

create function private.can_manage_questionnaire_template(template_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.questionnaire_templates as qt
    join public.organization_members as m on m.organization_id = qt.organization_id
    where qt.id = template_id and not qt.is_system and qt.deleted_at is null
      and m.user_id = (select auth.uid()) and m.role in ('owner', 'admin')
  );
$$;
revoke execute on function private.can_manage_questionnaire_template(uuid) from public, anon;
grant execute on function private.can_manage_questionnaire_template(uuid) to authenticated;

create function private.ensure_draft_questionnaire_content()
returns trigger language plpgsql set search_path = '' as $$
declare version_id uuid;
begin
  if tg_table_name = 'questionnaire_sections' then
    version_id := coalesce(new.questionnaire_version_id, old.questionnaire_version_id);
  else
    version_id := private.questionnaire_version_for_section(coalesce(new.questionnaire_section_id, old.questionnaire_section_id));
  end if;
  if not exists (select 1 from public.questionnaire_versions where questionnaire_versions.id = version_id and questionnaire_versions.status = 'draft') then
    raise exception 'Only draft questionnaire versions can be modified' using errcode = '23514';
  end if;
  return case when tg_op = 'DELETE' then old else new end;
end;
$$;

create function private.ensure_unique_question_code()
returns trigger language plpgsql security definer set search_path = '' as $$
declare target_version_id uuid;
begin
  target_version_id := private.questionnaire_version_for_section(new.questionnaire_section_id);
  if exists (
    select 1 from public.questionnaire_questions as existing
    join public.questionnaire_sections as section on section.id = existing.questionnaire_section_id
    where section.questionnaire_version_id = target_version_id
      and lower(existing.code) = lower(new.code)
      and existing.id is distinct from new.id
  ) then
    raise exception 'Question code must be unique within a questionnaire version' using errcode = '23505';
  end if;
  return new;
end;
$$;

create trigger questionnaire_sections_require_draft before insert or update or delete on public.questionnaire_sections
for each row execute function private.ensure_draft_questionnaire_content();
create trigger questionnaire_questions_require_draft before insert or update or delete on public.questionnaire_questions
for each row execute function private.ensure_draft_questionnaire_content();
create trigger questionnaire_questions_unique_code before insert or update of code, questionnaire_section_id on public.questionnaire_questions
for each row execute function private.ensure_unique_question_code();

create function private.enforce_questionnaire_version_lifecycle()
returns trigger language plpgsql set search_path = '' as $$
begin
  if old.status in ('published', 'archived') then
    if not (old.status = 'published' and new.status = 'archived'
      and new.questionnaire_template_id = old.questionnaire_template_id
      and new.version_number = old.version_number
      and new.published_at is not distinct from old.published_at) then
      raise exception 'Published and archived questionnaire versions are immutable' using errcode = '23514';
    end if;
  end if;
  if new.status = 'published' and old.status <> 'draft' then
    raise exception 'Only draft questionnaire versions can be published' using errcode = '23514';
  end if;
  return new;
end;
$$;
create trigger questionnaire_versions_enforce_lifecycle before update on public.questionnaire_versions
for each row execute function private.enforce_questionnaire_version_lifecycle();

create function private.enforce_audit_integrity()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.companies as c
    where c.id = new.company_id and c.organization_id = new.organization_id and c.deleted_at is null
  ) then raise exception 'Audit company must belong to the audit organization' using errcode = '23514'; end if;
  if new.questionnaire_version_id is not null and not exists (
    select 1 from public.questionnaire_versions as qv
    join public.questionnaire_templates as qt on qt.id = qv.questionnaire_template_id
    where qv.id = new.questionnaire_version_id and qv.status = 'published'
      and (qt.is_system or qt.organization_id = new.organization_id)
  ) then raise exception 'Audit questionnaire must be a published accessible version' using errcode = '23514'; end if;
  if tg_op = 'UPDATE' and old.questionnaire_version_id is distinct from new.questionnaire_version_id
    and exists (select 1 from public.audit_answers where audit_answers.audit_id = old.id)
  then raise exception 'Questionnaire version is frozen after the first answer' using errcode = '23514'; end if;
  if tg_op = 'UPDATE' and new.status = 'validated' and old.status <> 'validated'
    and not private.has_organization_role(new.organization_id, array['owner','admin']::public.organization_role[])
  then raise exception 'Only owners and admins can validate audits' using errcode = '42501'; end if;
  return new;
end;
$$;
create trigger audits_enforce_integrity before insert or update on public.audits
for each row execute function private.enforce_audit_integrity();

create function private.enforce_audit_answer_integrity()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.answered_by <> (select auth.uid()) then
    raise exception 'answered_by must match the authenticated user' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.audits as a
    join public.questionnaire_sections as qs on qs.questionnaire_version_id = a.questionnaire_version_id
    join public.questionnaire_questions as qq on qq.questionnaire_section_id = qs.id
    where a.id = new.audit_id and a.organization_id = new.organization_id
      and a.status not in ('validated', 'archived') and qq.id = new.question_id
  ) then raise exception 'Answer question must belong to the audit questionnaire version' using errcode = '23514'; end if;
  return new;
end;
$$;
create trigger audit_answers_enforce_integrity before insert or update on public.audit_answers
for each row execute function private.enforce_audit_answer_integrity();

create trigger questionnaire_templates_set_updated_at before update on public.questionnaire_templates
for each row execute function private.set_updated_at();
create trigger questionnaire_versions_set_updated_at before update on public.questionnaire_versions
for each row execute function private.set_updated_at();
create trigger questionnaire_sections_set_updated_at before update on public.questionnaire_sections
for each row execute function private.set_updated_at();
create trigger questionnaire_questions_set_updated_at before update on public.questionnaire_questions
for each row execute function private.set_updated_at();
create trigger audit_answers_set_updated_at before update on public.audit_answers
for each row execute function private.set_updated_at();

alter table public.questionnaire_templates enable row level security;
alter table public.questionnaire_versions enable row level security;
alter table public.questionnaire_sections enable row level security;
alter table public.questionnaire_questions enable row level security;
alter table public.audit_answers enable row level security;

create policy "members read questionnaire templates" on public.questionnaire_templates for select to authenticated
using ((select private.can_read_questionnaire_template(questionnaire_templates.id)));
create policy "admins create custom questionnaire templates" on public.questionnaire_templates for insert to authenticated
with check (not questionnaire_templates.is_system and (select private.has_organization_role(questionnaire_templates.organization_id, array['owner','admin']::public.organization_role[])));
create policy "admins update custom questionnaire templates" on public.questionnaire_templates for update to authenticated
using ((select private.can_manage_questionnaire_template(questionnaire_templates.id)))
with check (not questionnaire_templates.is_system and (select private.has_organization_role(questionnaire_templates.organization_id, array['owner','admin']::public.organization_role[])));

create policy "members read questionnaire versions" on public.questionnaire_versions for select to authenticated
using ((select private.can_read_questionnaire_template(questionnaire_versions.questionnaire_template_id)));
create policy "admins create questionnaire versions" on public.questionnaire_versions for insert to authenticated
with check ((select private.can_manage_questionnaire_template(questionnaire_versions.questionnaire_template_id)));
create policy "admins update questionnaire versions" on public.questionnaire_versions for update to authenticated
using ((select private.can_manage_questionnaire_template(questionnaire_versions.questionnaire_template_id)))
with check ((select private.can_manage_questionnaire_template(questionnaire_versions.questionnaire_template_id)));

create policy "members read questionnaire sections" on public.questionnaire_sections for select to authenticated
using ((select private.can_read_questionnaire_template(private.questionnaire_template_for_version(questionnaire_sections.questionnaire_version_id))));
create policy "admins create questionnaire sections" on public.questionnaire_sections for insert to authenticated
with check ((select private.can_manage_questionnaire_template(private.questionnaire_template_for_version(questionnaire_sections.questionnaire_version_id))));
create policy "admins update questionnaire sections" on public.questionnaire_sections for update to authenticated
using ((select private.can_manage_questionnaire_template(private.questionnaire_template_for_version(questionnaire_sections.questionnaire_version_id))))
with check ((select private.can_manage_questionnaire_template(private.questionnaire_template_for_version(questionnaire_sections.questionnaire_version_id))));
create policy "admins delete questionnaire sections" on public.questionnaire_sections for delete to authenticated
using ((select private.can_manage_questionnaire_template(private.questionnaire_template_for_version(questionnaire_sections.questionnaire_version_id))));

create policy "members read questionnaire questions" on public.questionnaire_questions for select to authenticated
using ((select private.can_read_questionnaire_template(private.questionnaire_template_for_version(private.questionnaire_version_for_section(questionnaire_questions.questionnaire_section_id)))));
create policy "admins create questionnaire questions" on public.questionnaire_questions for insert to authenticated
with check ((select private.can_manage_questionnaire_template(private.questionnaire_template_for_version(private.questionnaire_version_for_section(questionnaire_questions.questionnaire_section_id)))));
create policy "admins update questionnaire questions" on public.questionnaire_questions for update to authenticated
using ((select private.can_manage_questionnaire_template(private.questionnaire_template_for_version(private.questionnaire_version_for_section(questionnaire_questions.questionnaire_section_id)))))
with check ((select private.can_manage_questionnaire_template(private.questionnaire_template_for_version(private.questionnaire_version_for_section(questionnaire_questions.questionnaire_section_id)))));
create policy "admins delete questionnaire questions" on public.questionnaire_questions for delete to authenticated
using ((select private.can_manage_questionnaire_template(private.questionnaire_template_for_version(private.questionnaire_version_for_section(questionnaire_questions.questionnaire_section_id)))));

create policy "editors create audits" on public.audits for insert to authenticated
with check ((select private.has_organization_role(audits.organization_id, array['owner','admin','consultant']::public.organization_role[])));
create policy "editors update audits" on public.audits for update to authenticated
using ((select private.has_organization_role(audits.organization_id, array['owner','admin','consultant']::public.organization_role[])) and audits.deleted_at is null)
with check ((select private.has_organization_role(audits.organization_id, array['owner','admin','consultant']::public.organization_role[])));

create policy "members read audit answers" on public.audit_answers for select to authenticated
using ((select private.has_organization_role(audit_answers.organization_id, array['owner','admin','consultant','viewer']::public.organization_role[])));
create policy "editors create audit answers" on public.audit_answers for insert to authenticated
with check ((select private.has_organization_role(audit_answers.organization_id, array['owner','admin','consultant']::public.organization_role[])));
create policy "editors update audit answers" on public.audit_answers for update to authenticated
using ((select private.has_organization_role(audit_answers.organization_id, array['owner','admin','consultant']::public.organization_role[])))
with check ((select private.has_organization_role(audit_answers.organization_id, array['owner','admin','consultant']::public.organization_role[])));

grant select, insert, update on public.questionnaire_templates to authenticated;
grant select, insert, update on public.questionnaire_versions to authenticated;
grant select, insert, update, delete on public.questionnaire_sections to authenticated;
grant select, insert, update, delete on public.questionnaire_questions to authenticated;
grant insert, update on public.audits to authenticated;
grant select, insert, update on public.audit_answers to authenticated;

insert into public.questionnaire_templates (id, name, description, category, is_system)
values ('00000000-0000-4000-8000-000000000100', 'Audit d’automatisation opérationnelle', 'Questionnaire de démonstration couvrant les principaux processus opérationnels.', 'automation', true);
insert into public.questionnaire_versions (id, questionnaire_template_id, version_number, status, published_at)
values ('00000000-0000-4000-8000-000000000101', '00000000-0000-4000-8000-000000000100', 1, 'draft', null);

insert into public.questionnaire_sections (id, questionnaire_version_id, title, position) values
('00000000-0000-4000-8000-000000000111','00000000-0000-4000-8000-000000000101','Informations générales',1),
('00000000-0000-4000-8000-000000000112','00000000-0000-4000-8000-000000000101','Processus administratifs',2),
('00000000-0000-4000-8000-000000000113','00000000-0000-4000-8000-000000000101','Ventes et CRM',3),
('00000000-0000-4000-8000-000000000114','00000000-0000-4000-8000-000000000101','Marketing',4),
('00000000-0000-4000-8000-000000000115','00000000-0000-4000-8000-000000000101','Service client',5),
('00000000-0000-4000-8000-000000000116','00000000-0000-4000-8000-000000000101','Finance et facturation',6),
('00000000-0000-4000-8000-000000000117','00000000-0000-4000-8000-000000000101','Ressources humaines',7),
('00000000-0000-4000-8000-000000000118','00000000-0000-4000-8000-000000000101','Outils et systèmes',8),
('00000000-0000-4000-8000-000000000119','00000000-0000-4000-8000-000000000101','Volumes et fréquences',9),
('00000000-0000-4000-8000-000000000120','00000000-0000-4000-8000-000000000101','Priorités de l’entreprise',10);

insert into public.questionnaire_questions (questionnaire_section_id, code, label, question_type, required, position, options_json, validation_json) values
('00000000-0000-4000-8000-000000000111','general.activity','Décrivez l’activité principale de l’entreprise.','long_text',true,1,null,'{"minLength":10,"maxLength":2000}'),
('00000000-0000-4000-8000-000000000111','general.founded','Date de création de l’entreprise.','date',false,2,null,'{}'),
('00000000-0000-4000-8000-000000000111','general.digital_maturity','Niveau de maturité numérique perçu.','single_choice',true,3,'["faible","intermédiaire","avancé"]','{}'),
('00000000-0000-4000-8000-000000000112','admin.manual_tasks','Quelles tâches administratives restent manuelles ?','multiple_choice',true,1,'["saisie","classement","validation","relance","reporting"]','{}'),
('00000000-0000-4000-8000-000000000112','admin.hours','Heures administratives manuelles par semaine.','number',true,2,null,'{"min":0,"max":500}'),
('00000000-0000-4000-8000-000000000113','sales.crm','Utilisez-vous un CRM ?','boolean',true,1,null,'{}'),
('00000000-0000-4000-8000-000000000113','sales.leads','Nombre moyen de nouveaux prospects par mois.','number',false,2,null,'{"min":0}'),
('00000000-0000-4000-8000-000000000113','sales.followup','Décrivez le processus de relance commerciale.','long_text',false,3,null,'{"maxLength":2000}'),
('00000000-0000-4000-8000-000000000114','marketing.channels','Canaux marketing utilisés.','multiple_choice',false,1,'["email","réseaux sociaux","publicité","contenu","événements"]','{}'),
('00000000-0000-4000-8000-000000000114','marketing.conversion','Taux de conversion marketing estimé.','percentage',false,2,null,'{}'),
('00000000-0000-4000-8000-000000000115','support.channels','Canal principal du service client.','single_choice',true,1,'["email","téléphone","chat","portail"]','{}'),
('00000000-0000-4000-8000-000000000115','support.volume','Demandes clients reçues par mois.','number',false,2,null,'{"min":0}'),
('00000000-0000-4000-8000-000000000116','finance.invoicing','La facturation est-elle automatisée ?','boolean',true,1,null,'{}'),
('00000000-0000-4000-8000-000000000116','finance.monthly_revenue','Chiffre d’affaires mensuel indicatif.','currency',false,2,null,'{"min":0}'),
('00000000-0000-4000-8000-000000000116','finance.late_rate','Pourcentage de factures payées en retard.','percentage',false,3,null,'{}'),
('00000000-0000-4000-8000-000000000117','hr.onboarding','Décrivez l’intégration d’un nouveau collaborateur.','long_text',false,1,null,'{"maxLength":2000}'),
('00000000-0000-4000-8000-000000000117','hr.recruitments','Recrutements prévus cette année.','number',false,2,null,'{"min":0,"max":10000}'),
('00000000-0000-4000-8000-000000000118','tools.list','Listez les principaux outils utilisés.','long_text',true,1,null,'{"minLength":2,"maxLength":3000}'),
('00000000-0000-4000-8000-000000000118','tools.integrated','Les outils échangent-ils automatiquement leurs données ?','boolean',false,2,null,'{}'),
('00000000-0000-4000-8000-000000000119','volume.transactions','Transactions traitées par mois.','number',false,1,null,'{"min":0}'),
('00000000-0000-4000-8000-000000000119','volume.reporting','Fréquence du reporting.','single_choice',false,2,'["quotidienne","hebdomadaire","mensuelle","trimestrielle"]','{}'),
('00000000-0000-4000-8000-000000000120','priority.main','Priorité opérationnelle principale.','short_text',true,1,null,'{"minLength":2,"maxLength":200}'),
('00000000-0000-4000-8000-000000000120','priority.areas','Domaines à améliorer en priorité.','multiple_choice',true,2,'["temps","qualité","coûts","expérience client","pilotage"]','{}'),
('00000000-0000-4000-8000-000000000120','priority.target_date','Date cible pour les premières améliorations.','date',false,3,null,'{}');

update public.questionnaire_versions
set status = 'published', published_at = now()
where questionnaire_versions.id = '00000000-0000-4000-8000-000000000101';
