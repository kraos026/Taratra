create or replace function private.can_read_questionnaire_template(requested_template_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.questionnaire_templates as qt
    where qt.id = requested_template_id
      and qt.deleted_at is null
      and (
        (qt.is_system and exists (
          select 1
          from public.questionnaire_versions as qv
          where qv.questionnaire_template_id = qt.id
            and qv.status = 'published'
        ))
        or exists (
          select 1
          from public.organization_members as m
          where m.organization_id = qt.organization_id
            and m.user_id = (select auth.uid())
            and (
              m.role in ('owner', 'admin', 'consultant')
              or (m.role = 'viewer' and exists (
                select 1
                from public.questionnaire_versions as qv
                where qv.questionnaire_template_id = qt.id
                  and qv.status = 'published'
              ))
            )
        )
      )
  );
$$;

create or replace function private.can_read_questionnaire_version(requested_version_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.questionnaire_versions as qv
    join public.questionnaire_templates as qt
      on qt.id = qv.questionnaire_template_id
    where qv.id = requested_version_id
      and qt.deleted_at is null
      and (
        (qt.is_system and qv.status = 'published')
        or exists (
          select 1
          from public.organization_members as m
          where m.organization_id = qt.organization_id
            and m.user_id = (select auth.uid())
            and (
              m.role in ('owner', 'admin', 'consultant')
              or (m.role = 'viewer' and qv.status = 'published')
            )
        )
      )
  );
$$;
revoke execute on function private.can_read_questionnaire_version(uuid) from public, anon;
grant execute on function private.can_read_questionnaire_version(uuid) to authenticated;

drop policy "members read questionnaire versions" on public.questionnaire_versions;
create policy "members read authorized questionnaire versions"
on public.questionnaire_versions for select to authenticated
using ((select private.can_read_questionnaire_version(questionnaire_versions.id)));

drop policy "members read questionnaire sections" on public.questionnaire_sections;
create policy "members read authorized questionnaire sections"
on public.questionnaire_sections for select to authenticated
using ((select private.can_read_questionnaire_version(questionnaire_sections.questionnaire_version_id)));

drop policy "members read questionnaire questions" on public.questionnaire_questions;
create policy "members read authorized questionnaire questions"
on public.questionnaire_questions for select to authenticated
using ((select private.can_read_questionnaire_version(
  private.questionnaire_version_for_section(questionnaire_questions.questionnaire_section_id)
)));

create or replace function private.enforce_audit_integrity()
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

  if new.current_section_id is not null and not exists (
    select 1 from public.questionnaire_sections as qs
    where qs.id = new.current_section_id
      and qs.questionnaire_version_id = new.questionnaire_version_id
  ) then raise exception 'Current section must belong to the audit questionnaire version' using errcode = '23514'; end if;

  if tg_op = 'UPDATE' and old.questionnaire_version_id is distinct from new.questionnaire_version_id
    and exists (select 1 from public.audit_answers where audit_answers.audit_id = old.id)
  then raise exception 'Questionnaire version is frozen after the first answer' using errcode = '23514'; end if;

  if tg_op = 'UPDATE' and new.status = 'validated' and old.status <> 'validated'
    and not private.has_organization_role(new.organization_id, array['owner','admin']::public.organization_role[])
  then raise exception 'Only owners and admins can validate audits' using errcode = '42501'; end if;
  return new;
end;
$$;
