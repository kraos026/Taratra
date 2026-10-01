begin;
select plan(16);
select has_table('public','roi_model_catalog','ROI model catalog exists');
select has_table('public','roi_assumption_catalog','ROI assumption catalog exists');
select has_table('public','roi_evaluation_snapshots','ROI snapshots exist');
select has_table('public','roi_scenarios','ROI scenarios exist');
select has_table('public','roi_scenario_assumptions','frozen assumptions exist');
select has_table('public','roi_evaluations','ROI evaluations exist');
select has_table('public','roi_contributions','ROI contributions exist');
select has_table('public','roi_metrics','ROI metrics exist');
select has_table('public','roi_evidence','ROI evidence exists');
select has_table('public','roi_validations','ROI validations exist');
select is((select count(distinct code)::integer from public.roi_model_catalog where organization_id is null and published),1,'one published system model across immutable versions');
select is((select formula_json->>'annualHoursSaved' from public.roi_model_catalog where organization_id is null and code='automation_economic_impact' and version=1),'hoursSavedPerOccurrence * annualFrequency * volumeFactor * automationCoverage','legacy ROI formula is preserved');
select is((select formula_json->>'annualHoursSaved' from public.roi_model_catalog where organization_id is null and code='automation_economic_impact' and version=2),'hoursSavedPerOccurrence * annualFrequency * volumeFactor','current ROI does not multiply savings by finding coverage');
select is((select count(*)::integer from public.roi_assumption_catalog where organization_id is null and published),11,'eleven published assumptions');
select row_security_active('public.roi_evaluation_snapshots'::regclass),'ROI snapshot RLS active';
select throws_like($$update public.roi_model_catalog set title='Changed' where code='automation_economic_impact'$$,'%immutable%','published model is immutable');
select throws_ok(
 $$insert into public.roi_evaluation_snapshots(organization_id,company_id,automation_opportunity_snapshot_id,ai_opportunity_snapshot_id,business_analysis_id,process_map_id,knowledge_snapshot_id,version_number,currency,catalog_versions_json,provenance_json,created_by)
 values(gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),1,'EUR','{}','{}',gen_random_uuid())$$,
 'P0001','ROI requires aligned published canonical sources','invalid source chain is rejected'
);
select * from finish();
rollback;
