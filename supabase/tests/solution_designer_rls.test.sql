begin;
select plan(26);
select has_table('public','solution_pattern_catalog','pattern catalog exists');
select has_table('public','solution_capability_catalog','capability catalog exists');
select has_table('public','solution_connector_requirement_catalog','connector catalog exists');
select has_table('public','solution_constraint_catalog','constraint catalog exists');
select has_table('public','solution_validation_rule_catalog','validation catalog exists');
select has_table('public','solution_blueprints','blueprints exist');
select has_table('public','solution_blueprint_evidence','evidence exists');
select has_table('public','solution_blueprint_validations','validations exist');
select is((select count(*)::integer from public.solution_pattern_catalog where published),15,'fifteen patterns');
select is((select count(*)::integer from public.solution_capability_catalog where published),25,'twenty-five capabilities');
select is((select count(*)::integer from public.solution_connector_requirement_catalog where published),20,'twenty connectors');
select is((select count(*)::integer from public.solution_constraint_catalog where published),16,'sixteen constraints');
select is((select count(*)::integer from public.solution_validation_rule_catalog where published),13,'thirteen validation rules');
select is((select count(*)::integer from public.solution_validation_rule_catalog where published and jsonb_typeof(rule_json)='object'),13,'all validation rules are executable catalog definitions');
select is((select relrowsecurity from pg_class where oid='public.solution_blueprints'::regclass),true,'blueprint RLS enabled');
select is((select relrowsecurity from pg_class where oid='public.solution_pattern_catalog'::regclass),true,'catalog RLS enabled');
select has_trigger('public','solution_blueprints','solution_blueprints_immutable','database lifecycle trigger exists');
select has_trigger('public','solution_blueprint_validations','solution_blueprint_validation_scope','validation catalog scope trigger exists');
select col_is_unique('public','solution_blueprint_validations',array['blueprint_id','code'],'one result per catalog rule and blueprint');
select is((
 select count(*)::integer from pg_constraint
 where conrelid='public.solution_blueprints'::regclass and contype='f'
  and pg_get_constraintdef(oid) like 'FOREIGN KEY (previous_version_id, organization_id)%'
),1,'previous version has a composite tenant foreign key');
select is((
 select count(*)::integer
 from public.solution_pattern_catalog p,
 lateral jsonb_array_elements(p.template_json->'edges') edge
 where p.code='customer_support'
  and edge->>'from'='escalation' and edge->>'to'='assistant'
  and edge->>'type' in('produces','consumes','calls','stores','approves','schedules')
),0,'customer support catalog has no reverse dependency cycle');
select throws_like($$update public.solution_pattern_catalog set name='Changed' where code='simple_automation'$$,'%immutable%','published pattern immutable');
select throws_like($$insert into public.solution_blueprints(organization_id,company_id,recommendation_id,recommendation_snapshot_id,roi_snapshot_id,automation_opportunity_id,automation_opportunity_snapshot_id,pattern_id,version_number,name,description,objective,architecture,components_json,capabilities_json,connectors_json,constraints_json,assumptions_json,secrets_json,permissions_json,inputs_json,outputs_json,topology_json,dependencies_json,risks_json,final_risk,estimated_technical_cost_index,complexity_score,catalog_versions_json,provenance_json,created_by) select gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),id,1,'x','x','x','x','[]','[]','[]','[]','[]','[]','[]','[]','[]','[]','[]','[]',0,0,0,'{"validations":[]}','{}',gen_random_uuid() from public.solution_pattern_catalog limit 1$$,'%application transaction%','direct blueprint generation is rejected');
select lives_ok($$select set_config('app.solution_designer_internal_write','on',true)$$,'application transaction marker can be set locally');
select throws_ok($$insert into public.solution_blueprints(organization_id,company_id,recommendation_id,recommendation_snapshot_id,roi_snapshot_id,automation_opportunity_id,automation_opportunity_snapshot_id,pattern_id,version_number,name,description,objective,architecture,components_json,capabilities_json,connectors_json,constraints_json,assumptions_json,secrets_json,permissions_json,inputs_json,outputs_json,topology_json,dependencies_json,risks_json,final_risk,estimated_technical_cost_index,complexity_score,catalog_versions_json,provenance_json,created_by) select gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),gen_random_uuid(),id,1,'x','x','x','x','[]','[]','[]','[]','[]','[]','[]','[]','[]','[]','[]','[]',0,0,0,'{}','{}',gen_random_uuid() from public.solution_pattern_catalog limit 1$$,'P0001','Solution Blueprint requires aligned published canonical sources','unpublished source rejected');
select lives_ok($$select template_json->'normalization' from public.solution_pattern_catalog where code='simple_automation'$$,'normalization stored in catalog');
select * from finish();
rollback;
