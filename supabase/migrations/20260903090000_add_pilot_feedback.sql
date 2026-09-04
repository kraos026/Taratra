create table public.pilot_feedback (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id) on delete cascade,
  company_id uuid not null,
  audit_id uuid,
  executive_result_id uuid,
  user_id uuid not null references auth.users(id) on delete cascade,
  context_status text not null check (context_status in ('AUDIT_IN_PROGRESS', 'AUDIT_COMPLETE')),
  understanding_score integer not null check (understanding_score between 1 and 5),
  recommendation_relevance_score integer not null check (recommendation_relevance_score between 1 and 5),
  roi_credibility_score integer not null check (roi_credibility_score between 1 and 5),
  next_step_clarity_score integer not null check (next_step_clarity_score between 1 and 5),
  experience_score integer not null check (experience_score between 1 and 5),
  willing_to_pay text not null check (willing_to_pay in ('YES', 'NO', 'UNSURE')),
  acceptable_price numeric(12,2) check (acceptable_price > 0),
  price_currency varchar(3),
  comment varchar(2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (organization_id, company_id)
    references public.companies(organization_id, id) on delete cascade,
  foreign key (audit_id, organization_id)
    references public.audits(id, organization_id)
);

create unique index pilot_feedback_user_audit_key
  on public.pilot_feedback(user_id, audit_id)
  where audit_id is not null;

create unique index pilot_feedback_user_company_without_audit_key
  on public.pilot_feedback(user_id, company_id)
  where audit_id is null;

create index pilot_feedback_company_idx
  on public.pilot_feedback(organization_id, company_id);

create index pilot_feedback_user_idx
  on public.pilot_feedback(user_id, updated_at desc);

create trigger pilot_feedback_set_updated_at
before update on public.pilot_feedback
for each row execute function private.set_updated_at();

alter table public.pilot_feedback enable row level security;

create policy "users read their pilot feedback"
on public.pilot_feedback for select to authenticated
using (
  user_id = (select auth.uid())
  and (select private.has_organization_role(
    organization_id,
    array['owner','admin','consultant','viewer']::public.organization_role[]
  ))
);

create policy "users create their pilot feedback"
on public.pilot_feedback for insert to authenticated
with check (
  user_id = (select auth.uid())
  and (select private.has_organization_role(
    organization_id,
    array['owner','admin','consultant','viewer']::public.organization_role[]
  ))
);

create policy "users update their pilot feedback"
on public.pilot_feedback for update to authenticated
using (
  user_id = (select auth.uid())
  and (select private.has_organization_role(
    organization_id,
    array['owner','admin','consultant','viewer']::public.organization_role[]
  )))
with check (
  user_id = (select auth.uid())
  and (select private.has_organization_role(
    organization_id,
    array['owner','admin','consultant','viewer']::public.organization_role[]
  ))
);

grant select, insert, update on public.pilot_feedback to authenticated;
