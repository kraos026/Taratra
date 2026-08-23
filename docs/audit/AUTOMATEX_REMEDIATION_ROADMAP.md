# AutomateX — Remediation Roadmap (Authorization Required)

Classification: **HISTORICAL ROADMAP — NOT CURRENT RELEASE VERDICT**

This roadmap is a proposal only. No remediation was performed as part of the audit.

## P0 — release blockers

1. Recover isolated staging PostgreSQL/Supabase and Docker/CI database capability.
2. Clean-rebuild all 21 migrations; run all 18 pgTAP/security files.
3. Verify Prisma schema, migration history, RLS, grants, immutable-evidence deletion rules.
4. Run authenticated browser journey with Tenant A and Tenant B through Executive Result.
5. Reconcile branch ancestry and define the release commit/PR boundary.

## P1 — security and operations

1. Review/patch or formally accept all seven high npm audit findings.
2. Remove diagnostic markers and reduce production logging to approved operational fields.
3. Add route-to-authorization contract tests covering all 96 APIs.
4. Replace Prisma local fallback with an explicit non-production-safe failure policy.
5. Define rate limiting, correlation, centralized error tracking, metrics and alerting.

## P2 — reliability and performance

1. Add migration drift gate and Prisma status check to CI.
2. Add representative query plans, pool sizing, slow-query telemetry and load tests.
3. Test backup/restore and tenant-safe disaster recovery.
4. Certify Playwright browsers and repeat the golden pilot suite on every release candidate.

## P3 — product completeness

1. Separate generated automation specifications from actual connector execution status.
2. Document Brain/production-engine ownership and convergence boundaries.
3. Complete user-facing empty/error states for unavailable backend capabilities.

## P4 — hygiene

1. Consolidate historical branches and archive obsolete benchmark scripts.
2. Keep `.env.example`, runbooks, deployment matrix and architecture docs synchronized.
3. Track technical debt and deprecation decisions with owners and dates.

## Exit criteria

P0 is complete only when database rebuild, RLS suite, authenticated E2E, tenant isolation and release ancestry are evidenced in CI or a reproducible staging run. Until then the product remains RED regardless of unit-test results.
