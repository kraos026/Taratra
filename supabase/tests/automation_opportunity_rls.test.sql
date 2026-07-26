begin;
select plan(16);
select has_table('public','automation_pattern_catalog','pattern catalog exists');
select has_table('public','automation_connector_catalog','connector catalog exists');
select has_table('public','automation_detection_rule_catalog','rule catalog exists');
select has_table('public','automation_score_definition_catalog','score catalog exists');
select has_table('public','automation_opportunity_snapshots','snapshots exist');
select has_table('public','automation_opportunities','opportunities exist');
select has_table('public','automation_opportunity_connectors','connector links exist');
select has_table('public','automation_opportunity_ai_links','AI links exist');
select has_table('public','automation_opportunity_evidence','evidence exists');
select has_table('public','automation_opportunity_scores','scores exist');
select has_table('public','automation_opportunity_validations','validations exist');
select is((select count(*)::integer from public.automation_pattern_catalog where organization_id is null and published),20,'20 system patterns');
select is((select count(*)::integer from public.automation_connector_catalog where organization_id is null and published),20,'20 system connectors');
select is((select count(*)::integer from public.automation_score_definition_catalog where organization_id is null and active),7,'7 score definitions');
select throws_like($$update public.automation_pattern_catalog set title='Changed' where code='invoice_processing'$$,'%immutable%','published pattern versions are immutable');
select row_security_active('public.automation_opportunity_snapshots'::regclass),'snapshot RLS active';
select row_security_active('public.automation_opportunities'::regclass),'opportunity RLS active';
select throws_ok(
 $$insert into public.automation_opportunity_snapshots(organization_id,company_id,ai_opportunity_snapshot_id,business_analysis_id,process_map_id,knowledge_snapshot_id,version_number,catalog_versions_json,provenance_json,created_by)
 values(gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),1,'{}','{}',gen_random_uuid())$$,
 'P0001','Automation Opportunity requires aligned published canonical sources','invalid cross-tenant source chain is rejected'
);
select * from finish();
rollback;
