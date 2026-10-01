-- Additive catalog versions. Published V1 rows and historical snapshots are
-- deliberately untouched. This is a V1 correctness fix, not Product V2.
insert into public.roi_model_catalog
  (organization_id, code, version, title, description, formula_json, required_inputs, outputs, published)
select organization_id, code, 2, title,
  'Estimated savings per occurrence; finding coverage is not a time-saving percentage. Shared assumptions are non-additive across opportunities.',
  formula_json || jsonb_build_object(
    'annualHoursSaved', 'hoursSavedPerOccurrence * annualFrequency * volumeFactor',
    'avoidedErrorCost', 'errorCost * annualFrequency * volumeFactor',
    'confidence', 'sourceOpportunityConfidence * providedAssumptionShare; no uplift from reference count',
    'savingsBasis', 'hours_saved_per_occurrence_assumption_not_finding_coverage'
  ), required_inputs, outputs, true
from public.roi_model_catalog
where code = 'automation_economic_impact' and version = 1 and organization_id is null
on conflict (code, version, organization_id) do nothing;

insert into public.automation_score_definition_catalog
  (organization_id, code, version, title, direction, formula_json, active)
select organization_id, code, 2, 'Finding Coverage', direction,
  '{"formula":"matched findings / all findings in affected processes * 100","basis":"finding_count_not_time_saved","empty":0}'::jsonb,
  true
from public.automation_score_definition_catalog
where code = 'automation_coverage' and version = 1 and organization_id is null
on conflict (code, version, organization_id) do nothing;
