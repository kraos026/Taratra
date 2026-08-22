create or replace function private.validate_automation_specification_children()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
 if tg_table_name='automation_specification_provenance' then
  if new.target_local_id is not null
   and not exists(
    select 1 from public.automation_specification_elements element
    where element.automation_specification_id=new.automation_specification_id
     and element.organization_id=new.organization_id
     and element.local_id=new.target_local_id
   )
  then
   raise exception 'Automation Specification provenance target must exist in the same snapshot';
  end if;
  return new;
 end if;

 if tg_table_name='automation_specification_validations' then
  if not exists(
   select 1 from public.automation_specifications specification
   cross join lateral jsonb_array_elements(specification.catalog_versions_json) reference
   join public.automation_specification_rule_catalog rule
    on rule.id=(reference->>'id')::uuid
    and rule.code=new.rule_code
    and rule.version=new.rule_version
    and rule.rule_type='validation'
    and rule.severity=new.severity
    and rule.status='published'
    and (rule.organization_id is null or rule.organization_id=specification.organization_id)
   where specification.id=new.automation_specification_id
    and specification.organization_id=new.organization_id
  )
  then
   raise exception 'Validation must reference a published catalog rule frozen in the snapshot';
  end if;
  return new;
 end if;

 return new;
end $$;
