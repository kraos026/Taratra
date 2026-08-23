# AutomateX P0.4 RLS / pgTAP Certification Report

Classification: **CURRENT EVIDENCE — LOCAL DISPOSABLE CERTIFICATION**

Date: 2026-08-20
Target: local Supabase certification database
Host: `127.0.0.1:54322`
Environment: local disposable certification
Production: NO
Destructive remediation performed: NO

## Executive verdict

P0.4 RLS / pgTAP certification: PASS

Evidence:

- Complete Supabase pgTAP command passed: `npx supabase test db`
- SQL suites executed: 18 / 18
- Total pgTAP tests: 236
- Failed tests: 0
- Public tables inventoried: 123
- Public tables with RLS disabled: 0
- RLS-enabled public tables without policies: 0
- Applied migrations: 21
- Latest applied migration: `20260817193000_add_durable_audit_evidence_workflow`

No migration, RLS policy, Prisma schema, product engine, Brain, AI, or business logic was modified during this certification run.

## pgTAP execution summary

Primary command:

```text
npx supabase test db
```

Primary output summary:

```text
All tests successful.
Files=18, Tests=236,  9 wallclock secs
Result: PASS
```

Per-suite verification was also run file-by-file to collect duration data. The `skipping` notices emitted by PostgreSQL are extension notices for `pgtap already exists`; they are not TAP skipped tests.

| Suite                                    | Tests | Passed | Failed | Skipped | Duration | Result |
| ---------------------------------------- | ----: | -----: | -----: | ------: | -------: | ------ |
| `adaptive_interview_rls.test.sql`        |     8 |      8 |      0 |       0 |   10.13s | PASS   |
| `ai_opportunity_rls.test.sql`            |    12 |     12 |      0 |       0 |   10.43s | PASS   |
| `audit_questionnaire_hardening.test.sql` |    11 |     11 |      0 |       0 |   12.79s | PASS   |
| `audit_questionnaire_rls.test.sql`       |    15 |     15 |      0 |       0 |   10.31s | PASS   |
| `automation_opportunity_rls.test.sql`    |    16 |     16 |      0 |       0 |   11.54s | PASS   |
| `automation_specification_rls.test.sql`  |    26 |     26 |      0 |       0 |   10.94s | PASS   |
| `business_analysis_rls.test.sql`         |     9 |      9 |      0 |       0 |   10.43s | PASS   |
| `companies_module_rls.test.sql`          |    11 |     11 |      0 |       0 |   12.58s | PASS   |
| `discovery_engine_rls.test.sql`          |     9 |      9 |      0 |       0 |    8.73s | PASS   |
| `enterprise_knowledge_rls.test.sql`      |     9 |      9 |      0 |       0 |   10.02s | PASS   |
| `process_mapping_rls.test.sql`           |     9 |      9 |      0 |       0 |   12.98s | PASS   |
| `recommendation_engine_v2_rls.test.sql`  |    13 |     13 |      0 |       0 |    9.47s | PASS   |
| `recommendation_roi_rls.test.sql`        |     8 |      8 |      0 |       0 |   11.15s | PASS   |
| `rls_foundations.test.sql`               |    18 |     18 |      0 |       0 |   12.34s | PASS   |
| `roi_engine_rls.test.sql`                |    14 |     14 |      0 |       0 |    9.51s | PASS   |
| `rule_engine_rls.test.sql`               |    12 |     12 |      0 |       0 |   11.70s | PASS   |
| `solution_designer_rls.test.sql`         |    26 |     26 |      0 |       0 |   10.91s | PASS   |
| `work_intelligence_rls.test.sql`         |    10 |     10 |      0 |       0 |   10.31s | PASS   |

## RLS schema inventory

| Metric                                     |                                               Result |
| ------------------------------------------ | ---------------------------------------------------: |
| Public tables                              |                                                  123 |
| Public tables with RLS enabled             |                                                  123 |
| Public tables with RLS disabled            |                                                    0 |
| RLS-enabled public tables without policies |                                                    0 |
| Applied migrations                         |                                                   21 |
| Latest migration                           | `20260817193000_add_durable_audit_evidence_workflow` |

## Coverage matrix

Coverage is based on the passing pgTAP suites plus direct schema/policy inventory.

| Area                                       |            Table coverage | Policy coverage | Test coverage                                               | Result |
| ------------------------------------------ | ------------------------: | --------------: | ----------------------------------------------------------- | ------ |
| Core organization / membership / companies |                  3 tables |     11 policies | `rls_foundations`, `companies_module_rls`                   | PASS   |
| Audit questionnaire                        |                  4 tables |     14 policies | `audit_questionnaire_rls`, `audit_questionnaire_hardening`  | PASS   |
| Discovery engine                           |                  5 tables |     10 policies | `discovery_engine_rls`                                      | PASS   |
| Adaptive interview                         |                  7 tables |     15 policies | `adaptive_interview_rls`                                    | PASS   |
| Enterprise knowledge                       |                  6 tables |     12 policies | `enterprise_knowledge_rls`                                  | PASS   |
| Process mapping                            |                 10 tables |     21 policies | `process_mapping_rls`                                       | PASS   |
| Business analysis                          | 2 directly matched tables |      8 policies | `business_analysis_rls`                                     | PASS   |
| AI opportunities                           |                  6 tables |     14 policies | `ai_opportunity_rls`                                        | PASS   |
| Automation opportunities                   |                  6 tables |     14 policies | `automation_opportunity_rls`                                | PASS   |
| ROI / recommendation ROI                   |                 11 tables |     24 policies | `roi_engine_rls`, `recommendation_roi_rls`                  | PASS   |
| Recommendations                            |                 11 tables |     23 policies | `recommendation_engine_v2_rls`                              | PASS   |
| Solution designer                          |                  8 tables |     18 policies | `solution_designer_rls`                                     | PASS   |
| Automation specification                   |                  5 tables |     12 policies | `automation_specification_rls`                              | PASS   |
| Work Intelligence                          |                  3 tables |      8 policies | `work_intelligence_rls`                                     | PASS   |
| Durable audit evidence workflow            |                  3 tables |      6 policies | durable evidence tables inventoried; P0.3 migration present | PASS   |

## Required security cases

| Security case                       | Evidence                                                                                                                                                              | Result |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ |
| Anonymous rejection                 | Covered in RLS suites including Work Intelligence, ROI, Solution Designer, Automation Opportunity checks                                                              | PASS   |
| Same-tenant read/write              | Covered across foundations, questionnaire, specifications, rule engine, Work Intelligence                                                                             | PASS   |
| Cross-tenant read denial            | Covered across foundations, companies, questionnaire, discovery, knowledge, process, business analysis, rule engine, Work Intelligence                                | PASS   |
| Cross-tenant insert denial          | Covered across companies, questionnaire, discovery, knowledge, process, business analysis, AI opportunities, automation opportunities, rule engine, Work Intelligence | PASS   |
| Cross-tenant update denial          | Covered across companies/foundations and domain-specific RLS suites                                                                                                   | PASS   |
| Cross-tenant delete denial          | Covered in foundations, companies, discovery, adaptive interview, Work Intelligence                                                                                   | PASS   |
| Organization isolation              | `organization_members` and organization-scoped policies tested                                                                                                        | PASS   |
| Company isolation                   | company-owned and organization/company composite references tested                                                                                                    | PASS   |
| Membership-based access             | `organization_members` and `private.has_organization_role(...)` dependent policies tested                                                                             | PASS   |
| Member/editor/admin permissions     | owner/admin/consultant/viewer/editor-style access tested by suites                                                                                                    | PASS   |
| Immutable evidence protections      | knowledge, analysis, opportunity, ROI, recommendation, solution, specification and Work Intelligence immutability tests pass                                          | PASS   |
| Durable evidence protections        | durable evidence tables present with RLS/policies; referenced Work Intelligence evidence deletion protection tested                                                   | PASS   |
| SECURITY DEFINER functions          | one public security definer reviewed; authenticated-only execution, no anon/PUBLIC execute, explicit empty search path, auth and membership checks present            | PASS   |
| Role escalation prevention          | organization membership role updates and cross-tenant membership mutations tested                                                                                     | PASS   |
| Organization membership enforcement | create/read/update/delete membership behavior tested in `rls_foundations`                                                                                             | PASS   |

## SECURITY DEFINER review

Detected public SECURITY DEFINER functions: 1

| Function                                                   | `search_path` safe           | Authenticated check    | Membership / tenant check                                                                                       | anon execute | authenticated execute | PUBLIC execute | Result |
| ---------------------------------------------------------- | ---------------------------- | ---------------------- | --------------------------------------------------------------------------------------------------------------- | ------------ | --------------------- | -------------- | ------ |
| `public.create_first_organization(organization_name text)` | YES, `SET search_path TO ''` | YES, uses `auth.uid()` | YES, checks existing organization membership before creation and writes owner membership for authenticated user | NO           | YES                   | NO             | PASS   |

No privilege-escalation finding was identified during this certification run.

## Failed tests

None.

## Notes and limits

- This report certifies the local Supabase pgTAP/RLS gate for P0.4.
- It does not claim remote staging/prod parity.
- No clean rebuild was performed during this step because the requested mission was pgTAP/RLS certification on the already confirmed local Supabase target.
- No product behavior was changed.

## Final certification decision

P0.4 RLS / pgTAP certification: PASS

Next gate: P0.5 authenticated Playwright golden journey / refresh persistence, using the already prepared certification harness.
