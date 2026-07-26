create type public.interview_status as enum ('draft','in_progress','completed','validated','archived');
create type public.interview_answer_type as enum ('short_text','long_text','number','boolean','single_choice','multiple_choice');
create type public.interview_skip_reason as enum ('irrelevant','unknown','deferred');
create type public.evidence_confidence as enum ('validated','confirmed','uncertain','missing');

create table public.interview_questions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references public.organizations(id) on delete cascade,
  code text not null check(code ~ '^[a-z][a-z0-9_.]{2,119}$'),
  version integer not null default 1 check(version > 0),
  domain text not null check(domain ~ '^[a-z][a-z0-9_]{1,79}$'),
  prompt text not null,
  help_text text,
  answer_type public.interview_answer_type not null,
  options_json jsonb not null default '[]' check(jsonb_typeof(options_json) = 'array'),
  mandatory boolean not null default true,
  weight numeric(8,2) not null default 1 check(weight > 0),
  sequence integer not null check(sequence > 0),
  condition_json jsonb not null default '{}' check(jsonb_typeof(condition_json) = 'object'),
  validation_json jsonb not null default '{}' check(jsonb_typeof(validation_json) = 'object'),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index interview_questions_system_version_idx on public.interview_questions(code,version) where organization_id is null;
create unique index interview_questions_org_version_idx on public.interview_questions(organization_id,code,version) where organization_id is not null;

create table public.interview_sessions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_id uuid not null,
  discovery_session_id uuid not null,
  status public.interview_status not null default 'draft',
  version integer not null default 1 check(version > 0),
  lock_version integer not null default 1 check(lock_version > 0),
  current_question_id uuid references public.interview_questions(id),
  started_by uuid not null references auth.users(id),
  completed_at timestamptz,
  validated_at timestamptz,
  validated_by uuid references auth.users(id),
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key(organization_id,company_id) references public.companies(organization_id,id) on delete cascade,
  foreign key(discovery_session_id,organization_id) references public.discovery_sessions(id,organization_id),
  unique(id,organization_id)
);
create unique index interview_sessions_active_company_idx on public.interview_sessions(company_id) where status in ('draft','in_progress','completed');

create function private.enforce_interview_discovery_scope()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.discovery_sessions
    where discovery_sessions.id = new.discovery_session_id
      and discovery_sessions.organization_id = new.organization_id
      and discovery_sessions.company_id = new.company_id
      and discovery_sessions.status = 'validated'
  ) then
    raise exception 'Interview requires a validated Discovery for the same company';
  end if;
  return new;
end $$;
revoke execute on function private.enforce_interview_discovery_scope() from public,anon,authenticated;
create trigger interview_sessions_discovery_scope before insert or update of discovery_session_id,organization_id,company_id
on public.interview_sessions for each row execute function private.enforce_interview_discovery_scope();

create table public.interview_answers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  interview_session_id uuid not null,
  question_id uuid not null references public.interview_questions(id),
  value_json jsonb,
  skip_reason public.interview_skip_reason,
  confidence public.evidence_confidence not null,
  answered_by uuid not null references auth.users(id),
  revision integer not null default 1 check(revision > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key(interview_session_id,organization_id) references public.interview_sessions(id,organization_id) on delete cascade,
  unique(interview_session_id,question_id),
  check((value_json is not null and skip_reason is null and confidence in ('confirmed','uncertain')) or
        (value_json is null and skip_reason is not null and confidence = 'missing'))
);

create table public.interview_decisions (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  interview_session_id uuid not null,
  question_id uuid not null references public.interview_questions(id),
  decision text not null check(decision in ('ask','skip_irrelevant','answered','superseded')),
  reason text not null,
  facts_json jsonb not null default '{}' check(jsonb_typeof(facts_json) = 'object'),
  created_at timestamptz not null default now(),
  foreign key(interview_session_id,organization_id) references public.interview_sessions(id,organization_id) on delete cascade
);

create table public.interview_evidence (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  interview_session_id uuid not null,
  domain text not null,
  fact_key text not null,
  source_type text not null check(source_type in ('discovery','interview')),
  source_id uuid not null,
  confidence public.evidence_confidence not null,
  value_json jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key(interview_session_id,organization_id) references public.interview_sessions(id,organization_id) on delete cascade,
  unique(interview_session_id,fact_key,source_type)
);

create table public.interview_progress (
  interview_session_id uuid not null,
  organization_id uuid not null references public.organizations(id) on delete cascade,
  domain text not null,
  answered_weight numeric(10,2) not null default 0,
  required_weight numeric(10,2) not null default 0,
  progress_percentage numeric(5,2) not null check(progress_percentage between 0 and 100),
  confidence_percentage numeric(5,2) not null check(confidence_percentage between 0 and 100),
  missing_mandatory integer not null default 0 check(missing_mandatory >= 0),
  ready boolean not null default false,
  updated_at timestamptz not null default now(),
  primary key(interview_session_id,domain),
  foreign key(interview_session_id,organization_id) references public.interview_sessions(id,organization_id) on delete cascade
);

create table public.interview_timeline (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  interview_session_id uuid not null,
  actor_id uuid not null references auth.users(id),
  event_type text not null,
  metadata_json jsonb not null default '{}' check(jsonb_typeof(metadata_json) = 'object'),
  created_at timestamptz not null default now(),
  foreign key(interview_session_id,organization_id) references public.interview_sessions(id,organization_id) on delete cascade
);

create function private.enforce_interview_question_scope()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if not exists (
    select 1 from public.interview_questions
    where interview_questions.id = new.question_id
      and (interview_questions.organization_id is null or interview_questions.organization_id = new.organization_id)
  ) then
    raise exception 'Interview question is outside organization scope';
  end if;
  return new;
end $$;
revoke execute on function private.enforce_interview_question_scope() from public,anon,authenticated;
create trigger interview_answers_question_scope before insert or update of question_id,organization_id
on public.interview_answers for each row execute function private.enforce_interview_question_scope();
create trigger interview_decisions_question_scope before insert or update of question_id,organization_id
on public.interview_decisions for each row execute function private.enforce_interview_question_scope();

do $$ declare t text; begin foreach t in array array[
  'interview_questions','interview_sessions','interview_answers','interview_evidence','interview_progress'
] loop execute format('create trigger %I_set_updated_at before update on public.%I for each row execute function private.set_updated_at()',t,t); end loop; end $$;

do $$ declare t text; begin foreach t in array array[
  'interview_questions','interview_sessions','interview_answers','interview_decisions','interview_evidence','interview_progress','interview_timeline'
] loop execute format('alter table public.%I enable row level security',t); end loop; end $$;

create policy "members read interview questions" on public.interview_questions for select to authenticated
using (interview_questions.organization_id is null or (select private.has_organization_role(interview_questions.organization_id,array['owner','admin','consultant','viewer']::public.organization_role[])));
create policy "admins manage interview questions" on public.interview_questions for all to authenticated
using (interview_questions.organization_id is not null and (select private.has_organization_role(interview_questions.organization_id,array['owner','admin']::public.organization_role[])))
with check (interview_questions.organization_id is not null and (select private.has_organization_role(interview_questions.organization_id,array['owner','admin']::public.organization_role[])));

do $$ declare t text; begin foreach t in array array[
  'interview_answers','interview_decisions','interview_evidence','interview_progress','interview_timeline'
] loop
 execute format('create policy "members read %1$s" on public.%1$I for select to authenticated using ((select private.has_organization_role(%1$I.organization_id,array[''owner'',''admin'',''consultant'',''viewer'']::public.organization_role[])))',t);
 execute format('create policy "editors manage %1$s" on public.%1$I for all to authenticated using ((select private.has_organization_role(%1$I.organization_id,array[''owner'',''admin'',''consultant'']::public.organization_role[]))) with check ((select private.has_organization_role(%1$I.organization_id,array[''owner'',''admin'',''consultant'']::public.organization_role[])))',t);
end loop; end $$;

create policy "members read interview sessions" on public.interview_sessions for select to authenticated
using ((select private.has_organization_role(interview_sessions.organization_id,array['owner','admin','consultant','viewer']::public.organization_role[])));
create policy "editors create interview sessions" on public.interview_sessions for insert to authenticated
with check ((select private.has_organization_role(interview_sessions.organization_id,array['owner','admin','consultant']::public.organization_role[])));
create policy "editors update interview sessions" on public.interview_sessions for update to authenticated
using ((select private.has_organization_role(interview_sessions.organization_id,array['owner','admin','consultant']::public.organization_role[])))
with check (
  (select private.has_organization_role(interview_sessions.organization_id,array['owner','admin','consultant']::public.organization_role[]))
  and (
    interview_sessions.status <> 'validated'
    or (select private.has_organization_role(interview_sessions.organization_id,array['owner','admin']::public.organization_role[]))
  )
);

grant select,insert,update,delete on public.interview_questions,public.interview_sessions,public.interview_answers,public.interview_decisions,public.interview_evidence,public.interview_progress,public.interview_timeline to authenticated;

insert into public.interview_questions(code,domain,prompt,answer_type,mandatory,weight,sequence,condition_json,validation_json,options_json) values
('company.value_proposition','company','Quelle est la proposition de valeur principale ?','long_text',true,2,10,'{}','{"minLength":10}','[]'),
('operations.order_channels','operations','Comment les commandes ou demandes sont-elles reçues ?','multiple_choice',true,2,20,'{}','{}','["email","telephone","website","in_person","marketplace","other"]'),
('operations.monthly_volume','operations','Quel est le volume mensuel moyen traité ?','number',true,2,30,'{}','{"min":0}','[]'),
('operations.manual_steps','operations','Quelles étapes sont encore manuelles ?','long_text',true,2,40,'{}','{"minLength":3}','[]'),
('finance.invoices_email','finance','Les factures arrivent-elles par email ?','boolean',true,1,50,'{}','{}','[]'),
('finance.invoice_volume','finance','Combien de factures sont traitées par mois ?','number',true,2,60,'{"fact":"answer.finance.invoices_email","operator":"equal","value":true}','{"min":0}','[]'),
('finance.invoice_owner','finance','Qui traite ces factures ?','short_text',true,1,70,'{"fact":"answer.finance.invoices_email","operator":"equal","value":true}','{"minLength":2}','[]'),
('finance.invoice_mode','finance','Le traitement des factures est-il manuel ou automatique ?','single_choice',true,2,80,'{"fact":"answer.finance.invoices_email","operator":"equal","value":true}','{}','["manual","mixed","automatic"]'),
('finance.invoice_time','finance','Quel est le temps moyen de traitement en minutes ?','number',false,1,90,'{"fact":"answer.finance.invoices_email","operator":"equal","value":true}','{"min":0}','[]'),
('finance.invoice_software','software','Quel logiciel est utilisé pour les factures ?','short_text',false,1,100,'{"fact":"answer.finance.invoices_email","operator":"equal","value":true}','{}','[]'),
('software.integration','software','Les logiciels critiques échangent-ils automatiquement leurs données ?','boolean',true,2,110,'{}','{}','[]'),
('hr.employee_lifecycle','hr','Comment gérez-vous l’arrivée et le départ des collaborateurs ?','long_text',true,2,120,'{}','{"minLength":3}','[]'),
('restaurant.reservations','operations','Comment gérez-vous les réservations ?','long_text',true,2,200,'{"fact":"discovery.industry","operator":"contains","value":"restaurant"}','{}','[]'),
('restaurant.pos','software','Quel système de caisse utilisez-vous ?','short_text',true,2,210,'{"fact":"discovery.industry","operator":"contains","value":"restaurant"}','{}','[]'),
('restaurant.kitchen','operations','Comment les commandes circulent-elles jusqu’en cuisine ?','long_text',true,2,220,'{"fact":"discovery.industry","operator":"contains","value":"restaurant"}','{}','[]'),
('restaurant.stock','operations','Comment suivez-vous les stocks et pertes ?','long_text',true,2,230,'{"fact":"discovery.industry","operator":"contains","value":"restaurant"}','{}','[]'),
('construction.planning','operations','Comment planifiez-vous les projets et chantiers ?','long_text',true,2,300,'{"fact":"discovery.industry","operator":"contains","value":"construction"}','{}','[]'),
('construction.procurement','finance','Comment gérez-vous les achats et approvisionnements ?','long_text',true,2,310,'{"fact":"discovery.industry","operator":"contains","value":"construction"}','{}','[]'),
('construction.safety','operations','Comment suivez-vous les contrôles de sécurité ?','long_text',true,2,320,'{"fact":"discovery.industry","operator":"contains","value":"construction"}','{}','[]'),
('construction.subcontractors','operations','Comment coordonnez-vous les sous-traitants ?','long_text',true,2,330,'{"fact":"discovery.industry","operator":"contains","value":"construction"}','{}','[]');
