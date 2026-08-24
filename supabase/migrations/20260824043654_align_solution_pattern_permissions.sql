-- Align published Solution Designer pattern templates with the permissions
-- required by their referenced connector catalog entries.
--
-- This preserves pattern IDs, publication state, recommendation mappings,
-- connector mappings, and all unrelated template content. The immutable
-- catalog trigger is disabled only for this controlled catalog data repair and
-- re-enabled before the migration completes.

do $$
begin
alter table public.solution_pattern_catalog disable trigger solution_pattern_catalog_immutable;

with additions(code, missing_permissions) as (
  values
    ('approval_workflow', array['logs.read']::text[]),
    ('compliance_monitoring', array['metrics.read']::text[]),
    ('crm_synchronization', array['logs.read','metrics.read']::text[]),
    ('customer_support', array['search.write','logs.read','metrics.read']::text[]),
    ('document_processing', array['logs.read']::text[]),
    ('enterprise_transformation', array['logs.read']::text[]),
    ('erp_integration', array['logs.read','metrics.read']::text[]),
    ('forecasting', array['database.write','metrics.read']::text[]),
    ('inventory_synchronization', array['api.write','logs.read','metrics.read']::text[]),
    ('knowledge_assistant', array['search.write','logs.read','metrics.read']::text[]),
    ('master_data_synchronization', array['api.write','logs.read','metrics.read']::text[]),
    ('notification_hub', array['logs.read','metrics.read']::text[]),
    ('reporting_pipeline', array['logs.read','metrics.read']::text[]),
    ('workflow_automation', array['logs.read']::text[])
),
normalized_permissions as (
  select
    p.id,
    jsonb_agg(permission order by permission) as permissions_json
  from public.solution_pattern_catalog p
  join additions a on a.code = p.code
  cross join lateral (
    select jsonb_array_elements_text(coalesce(p.template_json->'permissions', '[]'::jsonb)) as permission
    union
    select unnest(a.missing_permissions) as permission
  ) permissions
  where p.published
  group by p.id
)
update public.solution_pattern_catalog p
set template_json = jsonb_set(p.template_json, '{permissions}', n.permissions_json, true)
from normalized_permissions n
where p.id = n.id;

alter table public.solution_pattern_catalog enable trigger solution_pattern_catalog_immutable;
exception when others then
 alter table public.solution_pattern_catalog enable trigger solution_pattern_catalog_immutable;
 raise;
end $$;
