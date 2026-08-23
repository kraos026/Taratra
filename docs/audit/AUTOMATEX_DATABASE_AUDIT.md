# AutomateX — Database and Persistence Audit

Classification: **HISTORICAL SNAPSHOT — NOT CURRENT RELEASE VERDICT**

## Inventory

- Supabase migrations: **21**, from `0001_foundations.sql` through `20260817193000_add_durable_audit_evidence_workflow.sql`.
- Prisma schema: `prisma/schema.prisma`; Prisma 7.9.1 with custom generated output under `src/generated/prisma` (ignored and generated at install/build).
- Prisma config: `prisma.config.ts`; datasource uses `DATABASE_URL` and falls back to a local `127.0.0.1:54322` URL when absent.
- pgTAP/security SQL tests: **18** files under `supabase/tests`.
- Static SQL inventory: approximately 123 public tables, 32 RLS-enabling statements and 155 policy statements (including dynamic blocks; counts are indicative, not a schema query).

## Migration chain

The repository contains the expected ordered chain, including:

1. foundations and companies
2. audit/questionnaire/rule engines
3. discovery/interview/knowledge/process mapping
4. analysis/opportunity/ROI/recommendations
5. solution designer/specification/generator
6. Work Intelligence (`20260809014412_add_work_intelligence_persistence.sql`)
7. durable audit evidence workflow (`20260817193000_add_durable_audit_evidence_workflow.sql`)

**Clean rebuild: NOT VERIFIED.** Docker/Postgres was unavailable and `npx supabase test db` failed before executing tests. `npx prisma migrate status` could not establish the configured database connection.

## Prisma compatibility

Static generation/build configuration is reproducible (`postinstall` and `build` run `prisma generate`). The generated client is intentionally not committed. Actual Prisma-to-Postgres schema compatibility and query execution remain unverified.

## P0.3 durable evidence tables

The latest durable workflow migration defines six audit/evidence tables with tenant-aware policies: discovery loops, action executions, response processings, acquisition requests, production evidence sources and production evidence records. Their constraints, RLS and delete protection require live pgTAP confirmation.

## Drift/performance risks

- No live migration history or `prisma migrate diff` result is available.
- No production query plans, index hit rates, connection pool metrics or backup restore test were available.
- Prisma local fallback should be treated as a release configuration hazard.
- Supabase Data API exposure/grants and view security cannot be verified without the project.

## Required database gate

Provision an isolated staging project, apply all existing migrations from zero, run all pgTAP/RLS tests, run Prisma validation/status, execute authenticated tenant tests, and perform a restore drill before production sign-off.
