# AutomateX — Staging P0 Certification Report

Classification: **HISTORICAL SNAPSHOT — NOT CURRENT RELEASE VERDICT**

**Mode:** read-only environment recovery and certification
**Branch:** `recover/advanced-product-flow`
**SHA before/after:** `ee51c5e0a1de7cebfe237f989435a7876a4a5c4f` (unchanged)

## Executive summary

Certification remains **RED — NOT READY**. The repository tools and Prisma schema are available, but no safe, reachable PostgreSQL/Supabase certification target exists in this environment. Docker Desktop's Linux engine is unavailable, `psql` is not installed, local Supabase cannot connect, and no staging database was accessed. Consequently the migration rebuild, live Prisma parity, pgTAP/RLS, tenant isolation and authenticated golden journey were not run.

## Environment matrix

| Environment | DB known                                            | Supabase/auth              | Browser URL    | Isolation               | Certification |
| ----------- | --------------------------------------------------- | -------------------------- | -------------- | ----------------------- | ------------- |
| Local       | Expected local `127.0.0.1:54322`, unreachable       | Local Supabase unavailable | Not configured | Disposable in principle | NOT USABLE    |
| Test        | `.env.test` missing                                 | Unknown                    | Unknown        | Unknown                 | NOT USABLE    |
| Staging     | No safe credentials/connection verified             | Unknown                    | Unknown        | Unknown                 | NOT USABLE    |
| Preview     | External Vercel configuration, not inspectable here | Unknown                    | Unknown        | Unknown                 | NOT USABLE    |
| Production  | Intentionally not accessed                          | Unknown                    | Unknown        | Unknown                 | FORBIDDEN     |

`.env.local` exists but contains only AI-provider variables; the required staging database/Supabase variables are absent. Its secret values were not displayed or used. `.env.example` contains public Supabase names, `DATABASE_URL` and `OPENAI_API_KEY` names only. The repository's Supabase config is local-only (`project_id = "automatex"`, ports 54321/54322); it does not identify the remote `automatex-staging` project.

### Variable presence (value-free)

| Variable                        | Result                  |
| ------------------------------- | ----------------------- |
| `DATABASE_URL`                  | MISSING in `.env.local` |
| `DIRECT_URL`                    | MISSING                 |
| `NEXT_PUBLIC_SUPABASE_URL`      | MISSING in `.env.local` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | MISSING                 |
| `SUPABASE_SERVICE_ROLE_KEY`     | MISSING                 |
| `SUPABASE_PROJECT_REF`          | MISSING                 |
| `PLAYWRIGHT_BASE_URL`           | MISSING                 |
| `.env.staging` / `.env.test`    | MISSING                 |

## Tool and target discovery

- Node: `v24.16.0`.
- npm: `11.13.0`.
- Prisma: `7.9.1`.
- Supabase CLI: `2.109.1`.
- `psql`: MISSING.
- Docker API: unavailable at `dockerDesktopLinuxEngine`; Docker/Supabase status cannot inspect containers.
- `vercel.json`: MISSING; deployment settings are external.
- Certification scripts and Playwright/Vitest configs are present.

### Certification target decision

```text
Environment: local Supabase expected, but unreachable
Host class: local Docker/PostgreSQL
Production risk: none if it were disposable; currently not reachable
Disposable: intended, not verified
Safe to reset: NO — target cannot be verified
Decision: UNSAFE / STOP DB certification
```

The immediate blocker is **missing staging connection configuration**, not a proven database credential, DNS, SSL or schema failure. Because `DATABASE_URL` is absent from the process, `prisma.config.ts` would resolve its local fallback `127.0.0.1:54322`; that fallback is explicitly not an acceptable staging certification target.

No reset, migration apply, seed, destructive test or production connection was attempted.

## P0 gates

| Gate                         | Result  | Evidence                                                                      |
| ---------------------------- | ------- | ----------------------------------------------------------------------------- |
| Database environment         | FAIL    | Docker engine unavailable; no `psql`; no reachable staging target.            |
| Clean migration rebuild (21) | BLOCKED | Cannot start local Postgres/Supabase; no migration was applied.               |
| Database structure           | BLOCKED | No live catalog to inspect tables, constraints, indexes, grants or functions. |
| Prisma validate              | PASS    | Schema validates locally.                                                     |
| Prisma generate              | PASS    | Client generated to `src/generated/prisma`.                                   |
| Prisma migrate status        | BLOCKED | Datasource resolves to unreachable local Postgres.                            |
| Prisma parity                | BLOCKED | No live database for comparison/query smoke test.                             |
| pgTAP (18 suites)            | BLOCKED | `LegacyDbConnectError` before test execution.                                 |
| RLS certification            | BLOCKED | No real policy execution.                                                     |
| Tenant A/B isolation         | BLOCKED | No disposable auth/database target.                                           |
| Authentication/authorization | BLOCKED | No staging browser/session target in this run.                                |
| Golden Journey               | BLOCKED | Real data/auth prerequisites unavailable.                                     |
| Refresh persistence          | BLOCKED | Journey did not reach persisted data.                                         |

## Existing SQL and policy review

The repository contains 21 migrations and 18 pgTAP/security files. Static presence of policies is not treated as a PASS. The required anonymous, same-tenant, cross-tenant, role, organization/company and immutable evidence cases remain unexecuted.

## npm HIGH review

`npm audit --omit=dev` reports **7 HIGH** findings. No package was changed.

| Package                           | Directness          |         Current | Decision                                       |
| --------------------------------- | ------------------- | --------------: | ---------------------------------------------- |
| `@playwright/test` / `playwright` | Direct + transitive |          1.55.0 | MUST FIX before trusted browser CI             |
| `prisma` / `@prisma/config`       | Direct + transitive |           7.9.1 | NEEDS INVESTIGATION; suggested fix is breaking |
| `deepmerge-ts`                    | Transitive          |        <8 range | TEMPORARY ACCEPTANCE only after threat review  |
| `fast-uri`                        | Transitive          | 3.0–3.1.4 range | MUST FIX or constrain exposure                 |
| `nanoid`                          | Transitive          |          3.3.16 | NEEDS INVESTIGATION                            |

The audit reports seven vulnerability records because Playwright and Prisma chains appear both as direct and transitive records. No exploitability claim is made without a runtime data-flow review.

## Product preservation

```text
PRODUCT LOGIC MODIFIED: NO
BRAIN MODIFIED: NO
AI MODIFIED: NO
RULE/ROI/RECOMMENDATION ENGINES MODIFIED: NO
SOLUTION DESIGNER MODIFIED: NO
AUTOMATION GENERATOR MODIFIED: NO
RLS POLICIES MODIFIED: NO
MIGRATIONS MODIFIED: NO
PRISMA SCHEMA MODIFIED: NO
```

Git operations performed: no merge, rebase, cherry-pick, reset, push or deploy.

## Remaining blockers and next action

1. Start Docker Desktop Linux Engine or provide a disposable isolated staging Supabase/Postgres target.
2. Prove the target is non-production before any database command.
3. Re-run the 21-migration clean rebuild and all 18 pgTAP/RLS suites.
4. Execute live Prisma parity and tenant-scoped smoke queries.
5. Run the authenticated Playwright golden journey and refresh/Tenant B checks.

No remediation is authorized or performed by this report.

## Final verdict

**RED — NOT READY**
