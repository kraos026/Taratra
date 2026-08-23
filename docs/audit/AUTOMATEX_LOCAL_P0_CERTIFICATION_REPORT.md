# AutomateX Local P0 Certification Report

Classification: **HISTORICAL SNAPSHOT — NOT CURRENT RELEASE VERDICT**

Date: 2026-08-20
Branch: recover/advanced-product-flow
SHA: ee51c5e0a1de7cebfe237f989435a7876a4a5c4f

## Target

- TARGET: LOCAL SUPABASE
- HOST: 127.0.0.1
- PORT: 54322
- PRODUCTION: NO
- DISPOSABLE: YES
- SAFE TO RESET: YES

## Verdict

RED - NOT READY

Reason: P0.3 Prisma parity is blocked by Prisma `P4002` during read-only schema diff. The local database rebuild itself passed, but Prisma cannot introspect the rebuilt database consistently because a `public` schema table references `auth.users` while the Prisma datasource does not include the `auth` schema.

## P0 Gates

- Local Supabase: PASS
- Clean migration rebuild: PASS
- Prisma validate: PASS
- Prisma generate: PASS
- Prisma migrate status: FAIL
- Prisma parity: FAIL
- pgTAP: NOT RUN
- RLS certification: NOT RUN
- Tenant A/B: NOT RUN
- Authentication: NOT RUN
- Authorization: NOT RUN
- Golden Journey: NOT RUN
- Refresh persistence: NOT RUN

## Clean Migration Rebuild

Command: `npx supabase db reset --local`

Result: PASS

Migration journal:

| Version        | Name                                    | Status | Duration           | Error |
| -------------- | --------------------------------------- | ------ | ------------------ | ----- |
| 0001           | foundations                             | PASS   | Not emitted by CLI | None  |
| 20260722050457 | extend_companies_module                 | PASS   | Not emitted by CLI | None  |
| 20260722064705 | add_audit_questionnaire                 | PASS   | Not emitted by CLI | None  |
| 20260722073301 | harden_audit_questionnaire              | PASS   | Not emitted by CLI | None  |
| 20260722083514 | add_rule_engine_core                    | PASS   | Not emitted by CLI | None  |
| 20260722092453 | correct_rule_engine_versioning          | PASS   | Not emitted by CLI | None  |
| 20260722120456 | add_recommendation_roi_engine           | PASS   | Not emitted by CLI | None  |
| 20260726033231 | add_discovery_engine                    | PASS   | Not emitted by CLI | None  |
| 20260726042817 | add_adaptive_interview_engine           | PASS   | Not emitted by CLI | None  |
| 20260726050014 | add_enterprise_knowledge_foundation     | PASS   | Not emitted by CLI | None  |
| 20260726051835 | add_process_mapping_engine              | PASS   | Not emitted by CLI | None  |
| 20260726060854 | add_business_analysis_engine            | PASS   | Not emitted by CLI | None  |
| 20260726070749 | add_ai_opportunity_engine               | PASS   | Not emitted by CLI | None  |
| 20260726074924 | add_automation_opportunity_engine       | PASS   | Not emitted by CLI | None  |
| 20260726082805 | add_roi_engine                          | PASS   | Not emitted by CLI | None  |
| 20260726091105 | add_recommendation_engine_v2            | PASS   | Not emitted by CLI | None  |
| 20260726185708 | add_solution_designer_v2                | PASS   | Not emitted by CLI | None  |
| 20260727190000 | add_automation_specification_engine     | PASS   | Not emitted by CLI | None  |
| 20260728110000 | add_automation_generator_infrastructure | PASS   | Not emitted by CLI | None  |
| 20260809014412 | add_work_intelligence_persistence       | PASS   | Not emitted by CLI | None  |
| 20260817193000 | add_durable_audit_evidence_workflow     | PASS   | Not emitted by CLI | None  |

## Database Inventory After Rebuild

- Public tables: 123
- Supabase migrations applied: 21
- Latest migration applied: 20260817193000
- Public tables with RLS enabled: 123 / 123
- Public policies: 290
- Durable evidence tables present: PASS

Durable evidence tables:

- audit_discovery_action_executions
- audit_discovery_loops
- audit_discovery_response_processings
- audit_evidence_acquisition_requests
- audit_production_evidence_records
- audit_production_evidence_sources

## Prisma Live Certification

- `npx prisma validate`: PASS
- `npx prisma generate`: PASS
- Generated client path: `src/generated/prisma`
- `npx prisma migrate status`: FAIL
- Prisma parity diff: FAIL

`npx prisma migrate status` result:

```text
No migration found in prisma/migrations
The current database is not managed by Prisma Migrate.
```

Prisma parity diff result:

```text
Error: P4002
Cross schema references are only allowed when the target schema is listed in the schemas property of your datasource. `public.ai_opportunity_snapshots` points to `auth.users` in constraint `ai_opportunity_snapshots_created_by_fkey`. Please add `auth` to your `schemas` property and run this command again.
```

Blocking FK:

- Constraint: `ai_opportunity_snapshots_created_by_fkey`
- Source: `public.ai_opportunity_snapshots`
- Target: `auth.users`

## P0.4 pgTAP / RLS

Status: NOT RUN

Reason: stopped at first critical blocker in P0.3.

18 test suites are present under `supabase/tests`.

## P0.5 Tenant A / Tenant B

Status: NOT RUN

Reason: stopped at first critical blocker in P0.3.

## P0.6 Auth + Golden Journey

Status: NOT RUN

Reason: stopped at first critical blocker in P0.3.

## Product Preservation

- Brain: NOT MODIFIED
- AI: NOT MODIFIED
- Engines: NOT MODIFIED
- Migrations: NOT MODIFIED
- RLS: NOT MODIFIED
- Prisma schema: NOT MODIFIED
- Product logic: NOT MODIFIED

## Files Changed

- docs/audit/AUTOMATEX_LOCAL_P0_CERTIFICATION_REPORT.md

Existing unrelated worktree entries were preserved:

- docs/ROADMAP.md
- .automatex/
- existing docs/audit/* files

## Blockers Remaining

1. Prisma parity is blocked by `P4002` because Prisma datasource schema configuration does not include the `auth` schema while at least one public table has an FK to `auth.users`.
2. `npx prisma migrate status` is not compatible with the current migration ownership model because migrations live under `supabase/migrations`, not `prisma/migrations`.

## Next Action

Do not continue P0.4/P0.5/P0.6 until the Prisma certification contract is clarified.

Recommended next step: decide whether P0 accepts Supabase-owned migrations with Prisma validate/generate plus a dedicated parity check, or whether `prisma/schema.prisma` must explicitly include the `auth` schema for parity certification. This is a contract decision; no remediation was applied.
