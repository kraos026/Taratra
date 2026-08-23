# AutomateX — Security Audit

Classification: **HISTORICAL SNAPSHOT — NOT CURRENT RELEASE VERDICT**

## Scope and confidence

Static source, migration, configuration and test review only. Live RLS, authenticated browser tests, dependency patch validation and production environment verification were **not possible** because Docker/PostgreSQL was unavailable.

## Findings

| ID     | Severity | Finding                                                 | Evidence / impact                                                                             |
| ------ | -------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| SEC-01 | P0       | RLS and tenant isolation uncertified                    | `npx supabase test db` stopped at `LegacyDbConnectError`; Docker Linux engine unavailable.    |
| SEC-02 | P0       | Production DB target cannot be verified from repository | Environment values are external; `.env.example` is incomplete.                                |
| SEC-03 | P1       | Branch/release boundary unclear                         | 124 commits ahead of local `main`; risk of deploying unreviewed cumulative changes.           |
| SEC-04 | P1       | Seven high npm audit findings                           | Prisma dependency chain, fast-uri, nanoid and Playwright 1.55.0 findings.                     |
| SEC-05 | P1       | Route-level authorization proof is opaque               | 96 routes; many delegate indirectly to wrappers. Requires automated coverage proof.           |
| SEC-06 | P1       | Diagnostic residue in production paths                  | `AUTOMATEX_DIAG_39709BD` marker and detailed sanitized diagnostics remain.                    |
| SEC-07 | P2       | No demonstrated global rate limiting/abuse contract     | Public API exposure risk.                                                                     |
| SEC-08 | P2       | Centralized tracing/alerting not evidenced              | Incident correlation and SLO measurement are limited.                                         |
| SEC-09 | P2       | Prisma config has local fallback URL                    | Missing `DATABASE_URL` can silently target local/default Postgres in non-production contexts. |

## Authentication and authorization

- Supabase SSR cookies and claims are used; publishable key is the browser-facing key.
- Middleware redirects anonymous users and checks organization membership before protected UI access.
- APIs resolve authenticated claims and use authenticated database transactions.
- Authorization data should remain in server-side membership tables/app claims; do not rely on mutable user metadata.
- No service-role key was found in `.env.example`; runtime environments remain unverified.

## RLS review matrix

| Resource family                   | Static RLS/policies                | Runtime test |
| --------------------------------- | ---------------------------------- | ------------ |
| Companies/organizations           | Present in migration history       | NOT VERIFIED |
| Audits/discovery/interviews       | Present                            | NOT VERIFIED |
| Knowledge/process maps            | Present                            | NOT VERIFIED |
| Opportunities/ROI/recommendations | Present                            | NOT VERIFIED |
| Solution/specification/generator  | Present                            | NOT VERIFIED |
| Durable P0.3 evidence workflow    | Present with tenant-aware policies | NOT VERIFIED |

Required certification cases: same-tenant read/write, cross-tenant read/update/delete rejection, anonymous rejection, role-specific writes, immutable evidence deletion protection.

## Threat model summary

Primary threats are BOLA/IDOR through missed tenant predicates, stale/misconfigured JWT context, accidental service-role exposure, migration drift, unbounded public API abuse, and sensitive diagnostic/log leakage. Static design addresses several of these; only the database/security test gate can establish actual protection.
