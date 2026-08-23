# AutomateX Prisma Drift Audit

Classification: **CURRENT EVIDENCE — READ WITH CURRENT STATUS CONTEXT**

Date: 2026-08-20
Branch: recover/advanced-product-flow
Scope: read-only Prisma/Supabase drift audit after P4002 remediation

## Executive Summary

Prisma P4002 is resolved. The remaining `prisma migrate diff` output is non-empty because Prisma is being asked to compare a Prisma ORM schema against a database whose physical schema is owned by Supabase migrations and PostgreSQL constraints.

The audit found no critical Prisma Client structural incompatibility:

- Tables mapped by Prisma: 123 / 123 PASS
- Missing mapped tables: 0
- Missing mapped columns: 0
- Scalar type mismatches after native type handling: 0
- Nullability mismatches: 0
- Enum mismatches: 0
- Critical tenant identifier drift: 0
- P4002 cross-schema blocker: resolved

The remaining drift is primarily physical database metadata: foreign keys, indexes, unique indexes, index names, and two SQL defaults that Prisma does not currently model.

## Drift Summary

- Total changed tables in Prisma diff: 122
- Critical findings: 0
- Important non-blocking findings: 2
- Acceptable findings: 122

## Category Counts

| Category                   |                             Count | Criticality                                       |
| -------------------------- | --------------------------------: | ------------------------------------------------- |
| TABLE MISSING              |                                 0 | None                                              |
| COLUMN MISSING             |                                 0 | None                                              |
| COLUMN TYPE MISMATCH       |                                 0 | None                                              |
| NULLABILITY MISMATCH       |                                 0 | None                                              |
| DEFAULT MISMATCH           |                                 2 | Important non-blocking                            |
| ENUM MISMATCH              |                                 0 | None                                              |
| PRIMARY KEY MISMATCH       |                                 0 | Acceptable unless relation runtime fails          |
| UNIQUE CONSTRAINT MISMATCH |                                12 | Acceptable for Prisma Client runtime in this gate |
| FOREIGN KEY MISMATCH       |                               319 | Acceptable physical DB metadata drift             |
| INDEX MISMATCH             |                                62 | Acceptable performance/metadata drift             |
| SCHEMA OWNERSHIP           |                                 1 | Expected: Supabase owns migrations/Auth           |
| GENERATED COLUMN           |                                 0 | None observed                                     |
| POSTGRES-SPECIFIC FEATURE  |       Present outside Prisma diff | Expected                                          |
| SUPABASE-MANAGED OBJECT    | Present via auth external objects | Expected                                          |
| OTHER                      |                                 0 | None observed                                     |

## Critical Drift Findings

None.

No evidence was found that the current Prisma Client would read incorrect data, write incorrect data, corrupt persisted data, break tenant isolation, or fail because of missing mapped tables/columns/types/nullability.

## Important Non-Blocking Findings

| Table / model                           | Mismatch                                                                                 | Runtime consequence                                                                              | Security consequence | Recommended fix                                                                                                         | Migration required |
| --------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------ | -------------------- | ----------------------------------------------------------------------------------------------------------------------- | ------------------ |
| `audit_rule_matches` / `AuditRuleMatch` | DB default `gen_random_uuid()` exists on `evaluation_id`; Prisma field has no `@default` | Prisma requires application code to provide `evaluationId`; current rule service does provide it | None observed        | Optional future schema alignment: add `@default(dbgenerated("gen_random_uuid()"))` if Prisma create omission is desired | NO                 |
| `audit_scores` / `AuditScore`           | DB default `gen_random_uuid()` exists on `evaluation_id`; Prisma field has no `@default` | Prisma requires application code to provide `evaluationId`; current rule service does provide it | None observed        | Optional future schema alignment: add `@default(dbgenerated("gen_random_uuid()"))` if Prisma create omission is desired | NO                 |

## Expected / Acceptable Drift

The following drift classes are expected in this architecture and should not block P0 if Prisma Client structural compatibility remains green:

- Supabase migrations manage physical FK creation, FK names, indexes, unique indexes, and partial/compound database metadata.
- Prisma is used as ORM/client, not as migration owner.
- RLS, policies, triggers, check constraints, extensions, and Supabase Auth internals are database-owned and not fully represented by Prisma models.
- Supabase Auth schema `auth.*` is external. Prisma must know the schema exists to resolve FKs, but must not manage or migrate it.
- Index name differences and FK representation differences are not runtime blockers for Prisma Client reads/writes when scalar fields, relation fields, PKs and tenant keys remain compatible.

## Model Structural Compatibility

| Check                                         | Result |
| --------------------------------------------- | ------ |
| Prisma public models mapped to DB tables      | PASS   |
| Table mapping                                 | PASS   |
| Column mapping                                | PASS   |
| Scalar/native type compatibility              | PASS   |
| Nullability compatibility                     | PASS   |
| Enum compatibility                            | PASS   |
| Tenant identifier columns present             | PASS   |
| Relation smoke test against FK-bearing models | PASS   |
| Transaction rollback smoke test               | PASS   |

## Changed Tables By Diff

| Table                                         | FK diff lines | Index diff lines | Unique diff lines | Default diff lines | Classification         |
| --------------------------------------------- | ------------: | ---------------: | ----------------: | -----------------: | ---------------------- |
| `ai_capability_catalog`                       |             1 |                0 |                 0 |                  0 | ACCEPTABLE             |
| `ai_detection_rule_catalog`                   |             1 |                0 |                 0 |                  0 | ACCEPTABLE             |
| `ai_opportunities`                            |             3 |                1 |                 0 |                  0 | ACCEPTABLE             |
| `ai_opportunity_capabilities`                 |             3 |                0 |                 0 |                  0 | ACCEPTABLE             |
| `ai_opportunity_evidence`                     |             4 |                1 |                 0 |                  0 | ACCEPTABLE             |
| `ai_opportunity_prerequisites`                |             2 |                0 |                 0 |                  0 | ACCEPTABLE             |
| `ai_opportunity_scores`                       |             3 |                0 |                 0 |                  0 | ACCEPTABLE             |
| `ai_opportunity_snapshots`                    |             7 |                1 |                 0 |                  0 | ACCEPTABLE             |
| `ai_opportunity_validations`                  |             2 |                0 |                 0 |                  0 | ACCEPTABLE             |
| `ai_score_definition_catalog`                 |             1 |                0 |                 0 |                  0 | ACCEPTABLE             |
| `analysis_rule_catalog`                       |             1 |                0 |                 0 |                  0 | ACCEPTABLE             |
| `analysis_snapshots`                          |             6 |                2 |                 0 |                  0 | ACCEPTABLE             |
| `analysis_validations`                        |             2 |                0 |                 0 |                  0 | ACCEPTABLE             |
| `audit_answers`                               |             7 |                0 |                 0 |                  0 | ACCEPTABLE             |
| `audit_discovery_action_executions`           |             3 |                1 |                 0 |                  0 | ACCEPTABLE             |
| `audit_discovery_loops`                       |             2 |                2 |                 0 |                  0 | ACCEPTABLE             |
| `audit_discovery_response_processings`        |             2 |                1 |                 0 |                  0 | ACCEPTABLE             |
| `audit_evidence_acquisition_requests`         |             4 |                3 |                 0 |                  0 | ACCEPTABLE             |
| `audit_production_evidence_records`           |             3 |                2 |                 0 |                  0 | ACCEPTABLE             |
| `audit_production_evidence_sources`           |             3 |                2 |                 0 |                  0 | ACCEPTABLE             |
| `audit_recommendations`                       |             6 |                1 |                 0 |                  0 | ACCEPTABLE             |
| `audit_rule_matches`                          |             6 |                1 |                 0 |                  1 | ACCEPTABLE / IMPORTANT |
| `audit_scores`                                |             6 |                1 |                 0 |                  1 | ACCEPTABLE / IMPORTANT |
| `audits`                                      |             8 |                0 |                 0 |                  0 | ACCEPTABLE             |
| `automation_connector_catalog`                |             1 |                0 |                 0 |                  0 | ACCEPTABLE             |
| `automation_detection_rule_catalog`           |             1 |                1 |                 0 |                  0 | ACCEPTABLE             |
| `automation_generation_idempotency`           |             1 |                1 |                 0 |                  0 | ACCEPTABLE             |
| `automation_generation_outbox`                |             2 |                3 |                 0 |                  0 | ACCEPTABLE             |
| `automation_generations`                      |             2 |                3 |                 0 |                  0 | ACCEPTABLE             |
| `automation_opportunities`                    |             4 |                0 |                 0 |                  0 | ACCEPTABLE             |
| `automation_opportunity_ai_links`             |             2 |                0 |                 0 |                  0 | ACCEPTABLE             |
| `automation_opportunity_connectors`           |             2 |                0 |                 0 |                  0 | ACCEPTABLE             |
| `automation_opportunity_evidence`             |             3 |                1 |                 0 |                  0 | ACCEPTABLE             |
| `automation_opportunity_scores`               |             2 |                0 |                 0 |                  0 | ACCEPTABLE             |
| `automation_opportunity_snapshots`            |             4 |                1 |                 0 |                  0 | ACCEPTABLE             |
| `automation_opportunity_validations`          |             1 |                0 |                 0 |                  0 | ACCEPTABLE             |
| `automation_pattern_catalog`                  |             1 |                0 |                 0 |                  0 | ACCEPTABLE             |
| `automation_score_definition_catalog`         |             1 |                1 |                 0 |                  0 | ACCEPTABLE             |
| `automation_specification_elements`           |             2 |                2 |                 0 |                  0 | ACCEPTABLE             |
| `automation_specification_provenance`         |             2 |                1 |                 0 |                  0 | ACCEPTABLE             |
| `automation_specification_rule_catalog`       |             1 |                1 |                 0 |                  0 | ACCEPTABLE             |
| `automation_specification_validations`        |             2 |                2 |                 0 |                  0 | ACCEPTABLE             |
| `automation_specifications`                   |             2 |                2 |                 0 |                  0 | ACCEPTABLE             |
| `business_challenges`                         |             2 |                0 |                 0 |                  0 | ACCEPTABLE             |
| `business_findings`                           |             4 |                1 |                 0 |                  0 | ACCEPTABLE             |
| `business_health`                             |             2 |                1 |                 0 |                  0 | ACCEPTABLE             |
| `business_processes`                          |             4 |                1 |                 0 |                  0 | ACCEPTABLE             |
| `business_scores`                             |             2 |                1 |                 0 |                  0 | ACCEPTABLE             |
| `companies`                                   |             2 |                0 |                 0 |                  0 | ACCEPTABLE             |
| `company_objectives`                          |             2 |                0 |                 0 |                  0 | ACCEPTABLE             |
| `company_offerings`                           |             2 |                0 |                 0 |                  0 | ACCEPTABLE             |
| `company_profiles`                            |             3 |                0 |                 1 |                  0 | ACCEPTABLE             |
| `company_roles`                               |             3 |                0 |                 0 |                  0 | ACCEPTABLE             |
| `company_software`                            |             3 |                0 |                 0 |                  0 | ACCEPTABLE             |
| `departments`                                 |             2 |                1 |                 1 |                  0 | ACCEPTABLE             |
| `discovery_answers`                           |             4 |                1 |                 0 |                  0 | ACCEPTABLE             |
| `discovery_sessions`                          |             4 |                1 |                 1 |                  0 | ACCEPTABLE             |
| `finding_evidence`                            |             3 |                1 |                 0 |                  0 | ACCEPTABLE             |
| `interview_answers`                           |             4 |                0 |                 0 |                  0 | ACCEPTABLE             |
| `interview_decisions`                         |             3 |                0 |                 0 |                  0 | ACCEPTABLE             |
| `interview_evidence`                          |             2 |                0 |                 0 |                  0 | ACCEPTABLE             |
| `interview_progress`                          |             2 |                0 |                 0 |                  0 | ACCEPTABLE             |
| `interview_questions`                         |             1 |                0 |                 0 |                  0 | ACCEPTABLE             |
| `interview_sessions`                          |             6 |                0 |                 1 |                  0 | ACCEPTABLE             |
| `interview_timeline`                          |             3 |                0 |                 0 |                  0 | ACCEPTABLE             |
| `knowledge_evidence`                          |             3 |                1 |                 0 |                  0 | ACCEPTABLE             |
| `knowledge_facts`                             |             3 |                1 |                 1 |                  0 | ACCEPTABLE             |
| `knowledge_nodes`                             |             2 |                1 |                 1 |                  0 | ACCEPTABLE             |
| `knowledge_relationships`                     |             3 |                0 |                 0 |                  0 | ACCEPTABLE             |
| `knowledge_snapshots`                         |             3 |                1 |                 1 |                  0 | ACCEPTABLE             |
| `knowledge_sources`                           |             2 |                0 |                 1 |                  0 | ACCEPTABLE             |
| `organization_members`                        |             3 |                0 |                 0 |                  0 | ACCEPTABLE             |
| `priority_definition_catalog`                 |             1 |                0 |                 0 |                  0 | ACCEPTABLE             |
| `process_categories`                          |             1 |                0 |                 0 |                  0 | ACCEPTABLE             |
| `process_map_edges`                           |             3 |                0 |                 0 |                  0 | ACCEPTABLE             |
| `process_map_fact_usage`                      |             2 |                0 |                 0 |                  0 | ACCEPTABLE             |
| `process_map_nodes`                           |             2 |                1 |                 1 |                  0 | ACCEPTABLE             |
| `process_map_ownership`                       |             2 |                0 |                 0 |                  0 | ACCEPTABLE             |
| `process_map_validations`                     |             2 |                1 |                 0 |                  0 | ACCEPTABLE             |
| `process_maps`                                |             6 |                2 |                 1 |                  0 | ACCEPTABLE             |
| `process_patterns`                            |             1 |                0 |                 0 |                  0 | ACCEPTABLE             |
| `questionnaire_questions`                     |             2 |                0 |                 0 |                  0 | ACCEPTABLE             |
| `questionnaire_sections`                      |             2 |                1 |                 0 |                  0 | ACCEPTABLE             |
| `questionnaire_templates`                     |             2 |                0 |                 1 |                  0 | ACCEPTABLE             |
| `questionnaire_versions`                      |             2 |                0 |                 0 |                  0 | ACCEPTABLE             |
| `recommendation_impacts`                      |             2 |                0 |                 0 |                  0 | ACCEPTABLE             |
| `recommendation_portfolio_snapshots`          |             4 |                1 |                 0 |                  0 | ACCEPTABLE             |
| `recommendation_portfolio_validations`        |             1 |                0 |                 0 |                  0 | ACCEPTABLE             |
| `recommendation_rule_catalog`                 |             1 |                0 |                 0 |                  0 | ACCEPTABLE             |
| `recommendations`                             |             4 |                0 |                 0 |                  0 | ACCEPTABLE             |
| `roi_assumption_catalog`                      |             1 |                0 |                 0 |                  0 | ACCEPTABLE             |
| `roi_contributions`                           |             2 |                0 |                 0 |                  0 | ACCEPTABLE             |
| `roi_evaluation_snapshots`                    |             4 |                0 |                 0 |                  0 | ACCEPTABLE             |
| `roi_evaluations`                             |             1 |                0 |                 0 |                  0 | ACCEPTABLE             |
| `roi_evidence`                                |             4 |                0 |                 0 |                  0 | ACCEPTABLE             |
| `roi_metrics`                                 |             1 |                0 |                 0 |                  0 | ACCEPTABLE             |
| `roi_model_catalog`                           |             1 |                0 |                 0 |                  0 | ACCEPTABLE             |
| `roi_profiles`                                |             2 |                0 |                 0 |                  0 | ACCEPTABLE             |
| `roi_scenario_assumptions`                    |             2 |                0 |                 0 |                  0 | ACCEPTABLE             |
| `roi_scenarios`                               |             2 |                0 |                 0 |                  0 | ACCEPTABLE             |
| `roi_validations`                             |             1 |                0 |                 0 |                  0 | ACCEPTABLE             |
| `rule_categories`                             |             2 |                0 |                 0 |                  0 | ACCEPTABLE             |
| `rule_recommendations`                        |             4 |                0 |                 0 |                  0 | ACCEPTABLE             |
| `rule_results`                                |             2 |                0 |                 0 |                  0 | ACCEPTABLE             |
| `rules`                                       |             4 |                0 |                 0 |                  0 | ACCEPTABLE             |
| `software`                                    |             2 |                0 |                 0 |                  0 | ACCEPTABLE             |
| `software_categories`                         |             1 |                0 |                 0 |                  0 | ACCEPTABLE             |
| `solution_blueprint_evidence`                 |             2 |                0 |                 0 |                  0 | ACCEPTABLE             |
| `solution_blueprint_validations`              |             1 |                0 |                 1 |                  0 | ACCEPTABLE             |
| `solution_blueprints`                         |             6 |                0 |                 0 |                  0 | ACCEPTABLE             |
| `solution_capability_catalog`                 |             1 |                0 |                 0 |                  0 | ACCEPTABLE             |
| `solution_connector_requirement_catalog`      |             1 |                1 |                 0 |                  0 | ACCEPTABLE             |
| `solution_constraint_catalog`                 |             1 |                0 |                 0 |                  0 | ACCEPTABLE             |
| `solution_pattern_catalog`                    |             1 |                0 |                 0 |                  0 | ACCEPTABLE             |
| `solution_validation_rule_catalog`            |             1 |                1 |                 0 |                  0 | ACCEPTABLE             |
| `transformation_recommendation_contributions` |             1 |                1 |                 0 |                  0 | ACCEPTABLE             |
| `transformation_recommendation_dependencies`  |             2 |                0 |                 0 |                  0 | ACCEPTABLE             |
| `transformation_recommendation_evidence`      |             4 |                1 |                 0 |                  0 | ACCEPTABLE             |
| `transformation_recommendations`              |             5 |                1 |                 0 |                  0 | ACCEPTABLE             |
| `work_activities`                             |             7 |                0 |                 0 |                  0 | ACCEPTABLE             |
| `work_intelligence_retention_events`          |             4 |                0 |                 0 |                  0 | ACCEPTABLE             |
| `work_intelligence_retention_policies`        |             2 |                1 |                 0 |                  0 | ACCEPTABLE             |

## Recommended Parity Gate

Recommended method: Prisma structural compatibility gate.

Use this gate for P0 instead of requiring `prisma migrate diff --exit-code` to be zero:

1. `npx supabase db reset --local`
2. `npx prisma validate`
3. `npx prisma generate`
4. custom structural compatibility check for mapped Prisma models:
   - mapped tables exist
   - mapped columns exist
   - scalar/native types compatible
   - nullability compatible
   - enum mappings compatible
   - tenant identifier columns present
5. Prisma runtime smoke tests:
   - connection
   - public table read
   - FK/provenance-bearing model read
   - rollback-safe transaction
6. pgTAP/RLS for database enforcement.

Reason: `supabase/migrations` is the source of truth. Prisma Migrate is not owner and should not be forced into this architecture.

## Prisma Runtime Status

- validate: PASS
- generate: PASS
- query smoke: PASS
- transaction rollback smoke: PASS
- structural compatibility: PASS
- full zero-diff parity: NOT APPLICABLE / FAIL by design for this architecture

## Decision

PRISMA CLIENT SAFE FOR P0.4 RLS TESTING = YES

REMEDIATION REQUIRED BEFORE RLS = NO

## Full Raw Prisma Diff

```text
[*] Changed the `ai_capability_catalog` table
  [+] Added foreign key on columns (organization_id)

[*] Changed the `ai_detection_rule_catalog` table
  [+] Added foreign key on columns (organization_id)

[*] Changed the `ai_opportunities` table
  [+] Added index on columns (snapshot_id, business_impact)
  [+] Added foreign key on columns (detection_rule_id)
  [+] Added foreign key on columns (organization_id)
  [+] Added foreign key on columns (snapshot_id, organization_id)

[*] Changed the `ai_opportunity_capabilities` table
  [+] Added foreign key on columns (capability_id)
  [+] Added foreign key on columns (opportunity_id, snapshot_id, organization_id)
  [+] Added foreign key on columns (organization_id)

[*] Changed the `ai_opportunity_evidence` table
  [+] Added index on columns (business_finding_id)
  [+] Added foreign key on columns (business_finding_id)
  [+] Added foreign key on columns (knowledge_fact_id)
  [+] Added foreign key on columns (opportunity_id, snapshot_id, organization_id)
  [+] Added foreign key on columns (organization_id)

[*] Changed the `ai_opportunity_prerequisites` table
  [+] Added foreign key on columns (opportunity_id, snapshot_id, organization_id)
  [+] Added foreign key on columns (organization_id)

[*] Changed the `ai_opportunity_scores` table
  [+] Added foreign key on columns (opportunity_id, snapshot_id, organization_id)
  [+] Added foreign key on columns (organization_id)
  [+] Added foreign key on columns (score_definition_id)

[*] Changed the `ai_opportunity_snapshots` table
  [+] Added index on columns (organization_id, company_id, status, version_number)
  [+] Added foreign key on columns (business_analysis_id, organization_id)
  [+] Added foreign key on columns (created_by)
  [+] Added foreign key on columns (knowledge_snapshot_id, organization_id)
  [+] Added foreign key on columns (organization_id, company_id)
  [+] Added foreign key on columns (organization_id)
  [+] Added foreign key on columns (previous_version_id, organization_id)
  [+] Added foreign key on columns (process_map_id, organization_id)

[*] Changed the `ai_opportunity_validations` table
  [+] Added foreign key on columns (organization_id)
  [+] Added foreign key on columns (snapshot_id, organization_id)

[*] Changed the `ai_score_definition_catalog` table
  [+] Added foreign key on columns (organization_id)

[*] Changed the `analysis_rule_catalog` table
  [+] Added foreign key on columns (organization_id)

[*] Changed the `analysis_snapshots` table
  [+] Added index on columns (organization_id, company_id, status, version_number)
  [+] Added index on columns (process_map_id, version_number)
  [+] Added foreign key on columns (created_by)
  [+] Added foreign key on columns (knowledge_snapshot_id, organization_id)
  [+] Added foreign key on columns (organization_id, company_id)
  [+] Added foreign key on columns (organization_id)
  [+] Added foreign key on columns (previous_version_id, organization_id)
  [+] Added foreign key on columns (process_map_id, organization_id)

[*] Changed the `analysis_validations` table
  [+] Added foreign key on columns (analysis_snapshot_id, organization_id)
  [+] Added foreign key on columns (organization_id)

[*] Changed the `audit_answers` table
  [-] Removed foreign key on columns (organization_id)
  [-] Removed foreign key on columns (audit_id, organization_id)
  [-] Removed foreign key on columns (question_id)
  [+] Added foreign key on columns (answered_by)
  [+] Added foreign key on columns (audit_id, organization_id)
  [+] Added foreign key on columns (organization_id)
  [+] Added foreign key on columns (question_id)

[*] Changed the `audit_discovery_action_executions` table
  [+] Added foreign key on columns (organization_id, company_id)
  [+] Added foreign key on columns (executed_by)
  [+] Added foreign key on columns (organization_id)
  [*] Renamed index `audit_discovery_action_executions_organization_id_company_i_idx` to `audit_discovery_actions_loop_idx`

[*] Changed the `audit_discovery_loops` table
  [-] Removed index on columns (organization_id, company_id, updated_at)
  [+] Added index on columns (organization_id, company_id, updated_at)
  [+] Added foreign key on columns (organization_id, company_id)
  [+] Added foreign key on columns (organization_id)

[*] Changed the `audit_discovery_response_processings` table
  [+] Added foreign key on columns (organization_id, company_id)
  [+] Added foreign key on columns (organization_id)
  [*] Renamed index `audit_discovery_response_processings_organization_id_compan_key` to `audit_discovery_response_proc_organization_id_company_id_pr_key`

[*] Changed the `audit_evidence_acquisition_requests` table
  [-] Removed index on columns (organization_id, company_id, status, updated_at)
  [+] Added index on columns (organization_id, company_id, status, updated_at)
  [+] Added foreign key on columns (received_source_id, organization_id)
  [+] Added foreign key on columns (organization_id, company_id)
  [+] Added foreign key on columns (organization_id)
  [+] Added foreign key on columns (requested_by)
  [*] Renamed index `audit_evidence_acquisition_requests_organization_id_company_key` to `audit_evidence_acquisition_re_organization_id_company_id_re_key`

[*] Changed the `audit_production_evidence_records` table
  [+] Added foreign key on columns (organization_id, company_id)
  [+] Added foreign key on columns (source_id, organization_id)
  [+] Added foreign key on columns (organization_id)
  [*] Renamed index `audit_production_evidence_records_organization_id_source_id_idx` to `audit_production_evidence_records_source_idx`
  [*] Renamed index `audit_production_evidence_records_organization_id_source_id_key` to `audit_production_evidence_rec_organization_id_source_id_evi_key`

[*] Changed the `audit_production_evidence_sources` table
  [+] Added foreign key on columns (acquisition_request_id, organization_id)
  [+] Added foreign key on columns (organization_id, company_id)
  [+] Added foreign key on columns (organization_id)
  [*] Renamed index `audit_production_evidence_sources_organization_id_acquisiti_idx` to `audit_production_evidence_sources_request_idx`
  [*] Renamed index `audit_production_evidence_sources_organization_id_company_i_key` to `audit_production_evidence_sou_organization_id_company_id_so_key`

[*] Changed the `audit_recommendations` table
  [-] Removed foreign key on columns (organization_id)
  [-] Removed foreign key on columns (audit_id, organization_id)
  [-] Removed foreign key on columns (recommendation_id)
  [+] Added index on columns (organization_id, audit_id)
  [+] Added foreign key on columns (audit_id, organization_id)
  [+] Added foreign key on columns (organization_id)
  [+] Added foreign key on columns (recommendation_id)

[*] Changed the `audit_rule_matches` table
  [-] Removed foreign key on columns (organization_id)
  [-] Removed foreign key on columns (audit_id, organization_id)
  [-] Removed foreign key on columns (rule_id)
  [*] Altered column `evaluation_id` (default changed from `None` to `Some(DbGenerated(Some("gen_random_uuid()")))`)
  [+] Added index on columns (evaluation_id)
  [+] Added foreign key on columns (audit_id, organization_id)
  [+] Added foreign key on columns (organization_id)
  [+] Added foreign key on columns (rule_id)

[*] Changed the `audit_scores` table
  [-] Removed foreign key on columns (organization_id)
  [-] Removed foreign key on columns (audit_id, organization_id)
  [-] Removed foreign key on columns (category_id)
  [*] Altered column `evaluation_id` (default changed from `None` to `Some(DbGenerated(Some("gen_random_uuid()")))`)
  [+] Added index on columns (evaluation_id)
  [+] Added foreign key on columns (audit_id, organization_id)
  [+] Added foreign key on columns (category_id)
  [+] Added foreign key on columns (organization_id)

[*] Changed the `audits` table
  [-] Removed foreign key on columns (organization_id)
  [-] Removed foreign key on columns (organization_id, company_id)
  [-] Removed foreign key on columns (questionnaire_version_id)
  [-] Removed foreign key on columns (current_section_id)
  [+] Added foreign key on columns (current_section_id)
  [+] Added foreign key on columns (organization_id, company_id)
  [+] Added foreign key on columns (organization_id)
  [+] Added foreign key on columns (questionnaire_version_id)

[*] Changed the `automation_connector_catalog` table
  [+] Added foreign key on columns (organization_id)

[*] Changed the `automation_detection_rule_catalog` table
  [+] Added foreign key on columns (organization_id)
  [*] Renamed index `automation_detection_rule_catalog_code_version_organization_key` to `automation_detection_rule_cata_code_version_organization_id_key`

[*] Changed the `automation_generation_idempotency` table
  [+] Added foreign key on columns (organization_id)
  [*] Renamed index `automation_generation_idempotency_created_at_idx` to `automation_generation_idempotency_created_idx`

[*] Changed the `automation_generation_outbox` table
  [-] Removed index on columns (published_at, created_at)
  [+] Added index on columns (published_at, created_at, id)
  [+] Added foreign key on columns (aggregate_id, organization_id)
  [+] Added foreign key on columns (organization_id)
  [*] Renamed index `automation_generation_outbox_organization_id_aggregate_id_idx` to `automation_generation_outbox_aggregate_idx`

[*] Changed the `automation_generations` table
  [-] Removed index on columns (organization_id, specification_lineage_id, generation_version)
  [+] Added index on columns (organization_id, specification_lineage_id, generation_version)
  [+] Added foreign key on columns (organization_id)
  [+] Added foreign key on columns (specification_snapshot_id, organization_id)
  [*] Renamed index `automation_generations_organization_id_lineage_id_status_is_idx` to `automation_generations_active_lineage_idx`

[*] Changed the `automation_opportunities` table
  [+] Added foreign key on columns (detection_rule_id)
  [+] Added foreign key on columns (organization_id)
  [+] Added foreign key on columns (pattern_id)
  [+] Added foreign key on columns (snapshot_id, organization_id)

[*] Changed the `automation_opportunity_ai_links` table
  [+] Added foreign key on columns (ai_opportunity_id, ai_opportunity_snapshot_id, organization_id)
  [+] Added foreign key on columns (opportunity_id, snapshot_id, organization_id)

[*] Changed the `automation_opportunity_connectors` table
  [+] Added foreign key on columns (opportunity_id, snapshot_id, organization_id)
  [+] Added foreign key on columns (connector_id)

[*] Changed the `automation_opportunity_evidence` table
  [+] Added foreign key on columns (opportunity_id, snapshot_id, organization_id)
  [+] Added foreign key on columns (business_finding_id)
  [+] Added foreign key on columns (knowledge_fact_id)
  [*] Renamed index `automation_opportunity_evidence_opportunity_id_business_fin_key` to `automation_opportunity_eviden_opportunity_id_business_findi_key`

[*] Changed the `automation_opportunity_scores` table
  [+] Added foreign key on columns (opportunity_id, snapshot_id, organization_id)
  [+] Added foreign key on columns (score_definition_id)

[*] Changed the `automation_opportunity_snapshots` table
  [+] Added foreign key on columns (ai_opportunity_snapshot_id, organization_id)
  [+] Added foreign key on columns (company_id, organization_id)
  [+] Added foreign key on columns (organization_id)
  [+] Added foreign key on columns (previous_version_id)
  [*] Renamed index `automation_opportunity_snapshots_organization_id_ai_opportu_key` to `automation_opportunity_snapsh_organization_id_ai_opportunit_key`

[*] Changed the `automation_opportunity_validations` table
  [+] Added foreign key on columns (snapshot_id, organization_id)

[*] Changed the `automation_pattern_catalog` table
  [+] Added foreign key on columns (organization_id)

[*] Changed the `automation_score_definition_catalog` table
  [+] Added foreign key on columns (organization_id)
  [*] Renamed index `automation_score_definition_catalog_code_version_organizati_key` to `automation_score_definition_ca_code_version_organization_id_key`

[*] Changed the `automation_specification_elements` table
  [-] Removed foreign key on columns (automation_specification_id)
  [+] Added foreign key on columns (automation_specification_id, organization_id)
  [*] Renamed index `automation_specification_elements_organization_id_automatio_idx` to `automation_specification_elements_lookup_idx`
  [*] Renamed index `automation_specification_elements_automation_specification__key` to `automation_specification_elem_automation_specification_id_l_key`

[*] Changed the `automation_specification_provenance` table
  [-] Removed foreign key on columns (automation_specification_id)
  [+] Added foreign key on columns (automation_specification_id, organization_id)
  [*] Renamed index `automation_specification_provenance_organization_id_automat_idx` to `automation_specification_provenance_lookup_idx`

[*] Changed the `automation_specification_rule_catalog` table
  [+] Added foreign key on columns (organization_id)
  [*] Renamed index `automation_specification_rule_catalog_code_version_organiza_key` to `automation_specification_rule__code_version_organization_id_key`

[*] Changed the `automation_specification_validations` table
  [-] Removed foreign key on columns (automation_specification_id)
  [+] Added foreign key on columns (automation_specification_id, organization_id)
  [*] Renamed index `automation_specification_validations_organization_id_automa_idx` to `automation_specification_validations_lookup_idx`
  [*] Renamed index `automation_specification_validations_automation_specificati_key` to `automation_specification_vali_automation_specification_id_r_key`

[*] Changed the `automation_specifications` table
  [-] Removed index on columns (organization_id, solution_blueprint_id, status)
  [+] Added index on columns (organization_id, solution_blueprint_id, status, version_number)
  [+] Added foreign key on columns (previous_version_id, organization_id)
  [+] Added foreign key on columns (solution_blueprint_id, organization_id)

[*] Changed the `business_challenges` table
  [+] Added foreign key on columns (organization_id, company_id)
  [+] Added foreign key on columns (organization_id)

[*] Changed the `business_findings` table
  [+] Added index on columns (analysis_snapshot_id, severity, category)
  [+] Added foreign key on columns (analysis_snapshot_id, organization_id)
  [+] Added foreign key on columns (organization_id)
  [+] Added foreign key on columns (related_process_map_id, organization_id)
  [+] Added foreign key on columns (rule_id)

[*] Changed the `business_health` table
  [+] Added index on columns (analysis_snapshot_id)
  [+] Added foreign key on columns (analysis_snapshot_id, organization_id)
  [+] Added foreign key on columns (organization_id)

[*] Changed the `business_processes` table
  [+] Added index on columns (organization_id, company_id)
  [+] Added foreign key on columns (category_id)
  [+] Added foreign key on columns (department_id, organization_id, company_id)
  [+] Added foreign key on columns (organization_id, company_id)
  [+] Added foreign key on columns (organization_id)

[*] Changed the `business_scores` table
  [+] Added index on columns (analysis_snapshot_id)
  [+] Added foreign key on columns (analysis_snapshot_id, organization_id)
  [+] Added foreign key on columns (organization_id)

[*] Changed the `companies` table
  [-] Removed foreign key on columns (organization_id)
  [+] Added foreign key on columns (organization_id)

[*] Changed the `company_objectives` table
  [+] Added foreign key on columns (organization_id, company_id)
  [+] Added foreign key on columns (organization_id)

[*] Changed the `company_offerings` table
  [+] Added foreign key on columns (organization_id, company_id)
  [+] Added foreign key on columns (organization_id)

[*] Changed the `company_profiles` table
  [-] Removed foreign key on columns (organization_id, company_id)
  [-] Removed unique index on columns (organization_id, company_id)
  [+] Added foreign key on columns (organization_id, company_id)
  [+] Added foreign key on columns (organization_id)

[*] Changed the `company_roles` table
  [+] Added foreign key on columns (department_id, organization_id, company_id)
  [+] Added foreign key on columns (organization_id, company_id)
  [+] Added foreign key on columns (organization_id)

[*] Changed the `company_software` table
  [+] Added foreign key on columns (organization_id, company_id)
  [+] Added foreign key on columns (organization_id)
  [+] Added foreign key on columns (software_id)

[*] Changed the `departments` table
  [+] Added index on columns (organization_id, company_id)
  [+] Added unique index on columns (id, organization_id, company_id)
  [+] Added foreign key on columns (organization_id, company_id)
  [+] Added foreign key on columns (organization_id)

[*] Changed the `discovery_answers` table
  [-] Removed foreign key on columns (discovery_session_id)
  [+] Added index on columns (discovery_session_id, step)
  [+] Added foreign key on columns (answered_by)
  [+] Added foreign key on columns (discovery_session_id, organization_id)
  [+] Added foreign key on columns (organization_id)

[*] Changed the `discovery_sessions` table
  [+] Added unique index on columns (id, organization_id)
  [+] Added index on columns (organization_id, company_id)
  [+] Added foreign key on columns (organization_id, company_id)
  [+] Added foreign key on columns (organization_id)
  [+] Added foreign key on columns (started_by)
  [+] Added foreign key on columns (validated_by)

[*] Changed the `finding_evidence` table
  [+] Added index on columns (knowledge_fact_id)
  [+] Added foreign key on columns (finding_id, analysis_snapshot_id, organization_id)
  [+] Added foreign key on columns (knowledge_fact_id)
  [+] Added foreign key on columns (organization_id)

[*] Changed the `interview_answers` table
  [+] Added foreign key on columns (answered_by)
  [+] Added foreign key on columns (interview_session_id, organization_id)
  [+] Added foreign key on columns (organization_id)
  [+] Added foreign key on columns (question_id)

[*] Changed the `interview_decisions` table
  [+] Added foreign key on columns (interview_session_id, organization_id)
  [+] Added foreign key on columns (organization_id)
  [+] Added foreign key on columns (question_id)

[*] Changed the `interview_evidence` table
  [+] Added foreign key on columns (interview_session_id, organization_id)
  [+] Added foreign key on columns (organization_id)

[*] Changed the `interview_progress` table
  [+] Added foreign key on columns (interview_session_id, organization_id)
  [+] Added foreign key on columns (organization_id)

[*] Changed the `interview_questions` table
  [+] Added foreign key on columns (organization_id)

[*] Changed the `interview_sessions` table
  [+] Added unique index on columns (id, organization_id)
  [+] Added foreign key on columns (current_question_id)
  [+] Added foreign key on columns (discovery_session_id, organization_id)
  [+] Added foreign key on columns (organization_id, company_id)
  [+] Added foreign key on columns (organization_id)
  [+] Added foreign key on columns (started_by)
  [+] Added foreign key on columns (validated_by)

[*] Changed the `interview_timeline` table
  [+] Added foreign key on columns (actor_id)
  [+] Added foreign key on columns (interview_session_id, organization_id)
  [+] Added foreign key on columns (organization_id)

[*] Changed the `knowledge_evidence` table
  [+] Added index on columns (source_id, source_record_id)
  [+] Added foreign key on columns (fact_id, snapshot_id, organization_id)
  [+] Added foreign key on columns (organization_id)
  [+] Added foreign key on columns (source_id, snapshot_id, organization_id)

[*] Changed the `knowledge_facts` table
  [+] Added index on columns (snapshot_id, domain)
  [+] Added unique index on columns (id, snapshot_id, organization_id)
  [+] Added foreign key on columns (node_id, snapshot_id, organization_id)
  [+] Added foreign key on columns (organization_id)
  [+] Added foreign key on columns (snapshot_id, organization_id)

[*] Changed the `knowledge_nodes` table
  [+] Added unique index on columns (id, snapshot_id, organization_id)
  [+] Added index on columns (snapshot_id, node_type)
  [+] Added foreign key on columns (organization_id)
  [+] Added foreign key on columns (snapshot_id, organization_id)

[*] Changed the `knowledge_relationships` table
  [+] Added foreign key on columns (from_node_id, snapshot_id, organization_id)
  [+] Added foreign key on columns (organization_id)
  [+] Added foreign key on columns (to_node_id, snapshot_id, organization_id)

[*] Changed the `knowledge_snapshots` table
  [+] Added index on columns (organization_id, company_id, version)
  [+] Added unique index on columns (id, organization_id)
  [+] Added foreign key on columns (created_by)
  [+] Added foreign key on columns (organization_id, company_id)
  [+] Added foreign key on columns (organization_id)

[*] Changed the `knowledge_sources` table
  [+] Added unique index on columns (id, snapshot_id, organization_id)
  [+] Added foreign key on columns (organization_id)
  [+] Added foreign key on columns (snapshot_id, organization_id)

[*] Changed the `organization_members` table
  [-] Removed foreign key on columns (organization_id)
  [+] Added foreign key on columns (organization_id)
  [+] Added foreign key on columns (user_id)

[*] Changed the `priority_definition_catalog` table
  [+] Added foreign key on columns (organization_id)

[*] Changed the `process_categories` table
  [+] Added foreign key on columns (organization_id)

[*] Changed the `process_map_edges` table
  [+] Added foreign key on columns (from_node_id, process_map_id, organization_id)
  [+] Added foreign key on columns (organization_id)
  [+] Added foreign key on columns (to_node_id, process_map_id, organization_id)

[*] Changed the `process_map_fact_usage` table
  [+] Added foreign key on columns (organization_id)
  [+] Added foreign key on columns (process_map_id, organization_id)

[*] Changed the `process_map_nodes` table
  [+] Added unique index on columns (id, process_map_id, organization_id)
  [+] Added index on columns (process_map_id, sequence)
  [+] Added foreign key on columns (organization_id)
  [+] Added foreign key on columns (process_map_id, organization_id)

[*] Changed the `process_map_ownership` table
  [+] Added foreign key on columns (organization_id)
  [+] Added foreign key on columns (process_map_id, organization_id)

[*] Changed the `process_map_validations` table
  [+] Added index on columns (process_map_id, severity)
  [+] Added foreign key on columns (organization_id)
  [+] Added foreign key on columns (process_map_id, organization_id)

[*] Changed the `process_maps` table
  [+] Added index on columns (organization_id, company_id, status, version_number)
  [+] Added unique index on columns (id, organization_id)
  [+] Added index on columns (knowledge_snapshot_id)
  [+] Added foreign key on columns (created_by)
  [+] Added foreign key on columns (knowledge_snapshot_id, organization_id)
  [+] Added foreign key on columns (organization_id, company_id)
  [+] Added foreign key on columns (organization_id)
  [+] Added foreign key on columns (previous_version_id, organization_id)
  [+] Added foreign key on columns (process_pattern_id)

[*] Changed the `process_patterns` table
  [+] Added foreign key on columns (organization_id)

[*] Changed the `questionnaire_questions` table
  [-] Removed foreign key on columns (questionnaire_section_id)
  [+] Added foreign key on columns (questionnaire_section_id)

[*] Changed the `questionnaire_sections` table
  [-] Removed foreign key on columns (questionnaire_version_id)
  [+] Added index on columns (questionnaire_version_id, position)
  [+] Added foreign key on columns (questionnaire_version_id)

[*] Changed the `questionnaire_templates` table
  [-] Removed foreign key on columns (organization_id)
  [+] Added unique index on columns (id, organization_id)
  [+] Added foreign key on columns (organization_id)

[*] Changed the `questionnaire_versions` table
  [-] Removed foreign key on columns (questionnaire_template_id)
  [+] Added foreign key on columns (questionnaire_template_id)

[*] Changed the `recommendation_impacts` table
  [-] Removed foreign key on columns (recommendation_id)
  [+] Added foreign key on columns (recommendation_id)

[*] Changed the `recommendation_portfolio_snapshots` table
  [+] Added foreign key on columns (roi_snapshot_id, organization_id)
  [+] Added foreign key on columns (company_id, organization_id)
  [+] Added foreign key on columns (organization_id)
  [+] Added foreign key on columns (previous_version_id)
  [*] Renamed index `recommendation_portfolio_snapshots_organization_id_roi_snap_key` to `recommendation_portfolio_snap_organization_id_roi_snapshot__key`

[*] Changed the `recommendation_portfolio_validations` table
  [+] Added foreign key on columns (snapshot_id, organization_id)

[*] Changed the `recommendation_rule_catalog` table
  [+] Added foreign key on columns (organization_id)

[*] Changed the `recommendations` table
  [-] Removed foreign key on columns (organization_id)
  [-] Removed foreign key on columns (category_id)
  [+] Added foreign key on columns (category_id)
  [+] Added foreign key on columns (organization_id)

[*] Changed the `roi_assumption_catalog` table
  [+] Added foreign key on columns (organization_id)

[*] Changed the `roi_contributions` table
  [+] Added foreign key on columns (assumption_id)
  [+] Added foreign key on columns (evaluation_id, scenario_id, snapshot_id, organization_id)

[*] Changed the `roi_evaluation_snapshots` table
  [+] Added foreign key on columns (automation_opportunity_snapshot_id, organization_id)
  [+] Added foreign key on columns (company_id, organization_id)
  [+] Added foreign key on columns (organization_id)
  [+] Added foreign key on columns (previous_version_id)

[*] Changed the `roi_evaluations` table
  [+] Added foreign key on columns (scenario_id, snapshot_id, organization_id)

[*] Changed the `roi_evidence` table
  [+] Added foreign key on columns (automation_evidence_id)
  [+] Added foreign key on columns (business_finding_id)
  [+] Added foreign key on columns (evaluation_id, scenario_id, snapshot_id, organization_id)
  [+] Added foreign key on columns (knowledge_fact_id)

[*] Changed the `roi_metrics` table
  [+] Added foreign key on columns (evaluation_id, scenario_id, snapshot_id, organization_id)

[*] Changed the `roi_model_catalog` table
  [+] Added foreign key on columns (organization_id)

[*] Changed the `roi_profiles` table
  [-] Removed foreign key on columns (organization_id)
  [+] Added foreign key on columns (organization_id)

[*] Changed the `roi_scenario_assumptions` table
  [+] Added foreign key on columns (assumption_id)
  [+] Added foreign key on columns (scenario_id, snapshot_id, organization_id)

[*] Changed the `roi_scenarios` table
  [+] Added foreign key on columns (model_id)
  [+] Added foreign key on columns (snapshot_id, organization_id)

[*] Changed the `roi_validations` table
  [+] Added foreign key on columns (snapshot_id, organization_id)

[*] Changed the `rule_categories` table
  [-] Removed foreign key on columns (organization_id)
  [+] Added foreign key on columns (organization_id)

[*] Changed the `rule_recommendations` table
  [-] Removed foreign key on columns (rule_id)
  [-] Removed foreign key on columns (recommendation_id)
  [+] Added foreign key on columns (recommendation_id)
  [+] Added foreign key on columns (rule_id)

[*] Changed the `rule_results` table
  [-] Removed foreign key on columns (rule_id)
  [+] Added foreign key on columns (rule_id)

[*] Changed the `rules` table
  [-] Removed foreign key on columns (organization_id)
  [-] Removed foreign key on columns (category_id)
  [+] Added foreign key on columns (category_id)
  [+] Added foreign key on columns (organization_id)

[*] Changed the `software` table
  [+] Added foreign key on columns (category_id)
  [+] Added foreign key on columns (organization_id)

[*] Changed the `software_categories` table
  [+] Added foreign key on columns (organization_id)

[*] Changed the `solution_blueprint_evidence` table
  [+] Added foreign key on columns (blueprint_id, organization_id)
  [+] Added foreign key on columns (recommendation_evidence_id)

[*] Changed the `solution_blueprint_validations` table
  [+] Added unique index on columns (blueprint_id, code)
  [+] Added foreign key on columns (blueprint_id, organization_id)

[*] Changed the `solution_blueprints` table
  [+] Added foreign key on columns (automation_opportunity_id, automation_opportunity_snapshot_id, organization_id)
  [+] Added foreign key on columns (company_id, organization_id)
  [+] Added foreign key on columns (pattern_id)
  [+] Added foreign key on columns (previous_version_id, organization_id)
  [+] Added foreign key on columns (recommendation_id, recommendation_snapshot_id, organization_id)
  [+] Added foreign key on columns (roi_snapshot_id, organization_id)

[*] Changed the `solution_capability_catalog` table
  [+] Added foreign key on columns (organization_id)

[*] Changed the `solution_connector_requirement_catalog` table
  [+] Added foreign key on columns (organization_id)
  [*] Renamed index `solution_connector_requirement_catalog_code_version_organiz_key` to `solution_connector_requirement_code_version_organization_id_key`

[*] Changed the `solution_constraint_catalog` table
  [+] Added foreign key on columns (organization_id)

[*] Changed the `solution_pattern_catalog` table
  [+] Added foreign key on columns (organization_id)

[*] Changed the `solution_validation_rule_catalog` table
  [+] Added foreign key on columns (organization_id)
  [*] Renamed index `solution_validation_rule_catalog_code_version_organization__key` to `solution_validation_rule_catal_code_version_organization_id_key`

[*] Changed the `transformation_recommendation_contributions` table
  [+] Added foreign key on columns (recommendation_id, snapshot_id, organization_id)
  [*] Renamed index `transformation_recommendation_contributions_recommendation__key` to `transformation_recommendation_c_recommendation_id_component_key`

[*] Changed the `transformation_recommendation_dependencies` table
  [+] Added foreign key on columns (depends_on_id, snapshot_id, organization_id)
  [+] Added foreign key on columns (recommendation_id, snapshot_id, organization_id)

[*] Changed the `transformation_recommendation_evidence` table
  [+] Added foreign key on columns (recommendation_id, snapshot_id, organization_id)
  [+] Added foreign key on columns (business_finding_id)
  [+] Added foreign key on columns (knowledge_fact_id)
  [+] Added foreign key on columns (roi_evidence_id)
  [*] Renamed index `transformation_recommendation_evidence_recommendation_id_ro_key` to `transformation_recommendation_recommendation_id_roi_evidenc_key`

[*] Changed the `transformation_recommendations` table
  [+] Added foreign key on columns (automation_opportunity_id, automation_opportunity_snapshot_id, organization_id)
  [+] Added foreign key on columns (roi_evaluation_id, roi_scenario_id, roi_snapshot_id, organization_id)
  [+] Added foreign key on columns (priority_definition_id)
  [+] Added foreign key on columns (rule_id)
  [+] Added foreign key on columns (snapshot_id, organization_id)
  [*] Renamed index `transformation_recommendations_id_snapshot_id_organization__key` to `transformation_recommendation_id_snapshot_id_organization_i_key`

[*] Changed the `work_activities` table
  [-] Removed foreign key on columns (retention_policy_id, organization_id)
  [+] Added foreign key on columns (captured_by)
  [+] Added foreign key on columns (confirmed_by)
  [+] Added foreign key on columns (organization_id, company_id)
  [+] Added foreign key on columns (organization_id)
  [+] Added foreign key on columns (retention_policy_id, organization_id)
  [+] Added foreign key on columns (supersedes_activity_id, organization_id)

[*] Changed the `work_intelligence_retention_events` table
  [+] Added foreign key on columns (activity_id, organization_id)
  [+] Added foreign key on columns (policy_id, organization_id)
  [+] Added foreign key on columns (actor_id)
  [+] Added foreign key on columns (organization_id)

[*] Changed the `work_intelligence_retention_policies` table
  [+] Added foreign key on columns (created_by)
  [+] Added foreign key on columns (organization_id)
  [*] Renamed index `work_intelligence_retention_policies_organization_id_policy_key` to `work_intelligence_retention_p_organization_id_policy_key_ve_key`
```
