# AutomateX — P0 Certification Report

Classification: **HISTORICAL SNAPSHOT — NOT CURRENT RELEASE VERDICT**

**Branch/SHA:** `recover/advanced-product-flow` / `ee51c5e0a1de7cebfe237f989435a7876a4a5c4f`
**Certification mode:** read-only verification; no remediation, merge, push or production access.

## Gate results

| Gate                               | Result                 | Evidence                                                                                                                               |
| ---------------------------------- | ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| P0.1 Database environment recovery | FAIL                   | Docker Linux engine unavailable; process env lacks DB variables; `.env.local` exists but was not exposed; local Supabase cannot start. |
| P0.2 Clean 21-migration rebuild    | BLOCKED                | `npx supabase test db` failed with `LegacyDbConnectError`; no database was reachable.                                                  |
| P0.3 Prisma certification          | PARTIAL                | `prisma validate` PASS; `prisma generate` PASS to `src/generated/prisma`; `migrate status` blocked on local DB connection.             |
| P0.4 pgTAP/RLS                     | BLOCKED                | 18 suites discovered; execution did not begin because Postgres was unreachable.                                                        |
| P0.5 Tenant A/B security           | BLOCKED                | No disposable staging database/auth session available.                                                                                 |
| P0.6 Authenticated golden journey  | BLOCKED                | Playwright harness exists; real staging DB and authenticated browser prerequisites unavailable.                                        |
| P0.7 Release branch reconciliation | PASS (analysis only)   | Merge-base and 124-commit divergence documented; Git unchanged.                                                                        |
| P0.8 npm HIGH findings             | FAIL / REVIEW REQUIRED | 7 HIGH vulnerabilities reported by `npm audit --omit=dev`; no packages changed.                                                        |

## Prisma details

- Schema validation: PASS.
- Client generation: PASS, Prisma 7.9.1, custom output `src/generated/prisma`.
- Migration status/parity: NOT VERIFIED because datasource resolved to local `127.0.0.1:54322` and no database was reachable.

## RLS and tenant isolation

Static SQL contains tenant-aware policies and 18 pgTAP files. This is not certification. Required anonymous, same-tenant, cross-tenant, role, immutable-evidence and organization/company isolation cases remain unexecuted.

## Golden journey

All steps from Signup/Login through Executive Result are **BLOCKED** for certification. No mock data was used and no success was inferred from page existence. Refresh persistence and Tenant B denial are therefore also unverified.

## npm HIGH findings

| Package                           | Current              | Advisory class                                               | Classification                                             |
| --------------------------------- | -------------------- | ------------------------------------------------------------ | ---------------------------------------------------------- |
| `@playwright/test` → `playwright` | 1.55.0               | Browser download certificate authenticity issue below 1.55.1 | MUST FIX before trusted CI/browser supply chain            |
| `playwright`                      | 1.55.0               | Same transitive advisory                                     | MUST FIX                                                   |
| `prisma`                          | 7.9.1                | Via `@prisma/config` / `deepmerge-ts`                        | NEEDS INVESTIGATION; suggested fix is a breaking downgrade |
| `@prisma/config`                  | 7.9.1                | Via `deepmerge-ts`                                           | NEEDS INVESTIGATION                                        |
| `deepmerge-ts`                    | transitive           | GHSA-ggr8-5vv4-36mx stack exhaustion                         | ACCEPT TEMPORARILY only with threat review                 |
| `fast-uri`                        | transitive 3.0–3.1.4 | GHSA-7p8r-x3mc-p8w7 host confusion                           | MUST FIX or constrain exposure                             |
| `nanoid`                          | transitive 3.3.16    | GHSA-2v37-7h3g-55p8 zero-size loop                           | ACCEPT TEMPORARILY pending dependency-owner review         |

No CVE/package update was applied. Exploitability requires a separate dependency and runtime data-flow review.

## Remaining blockers

1. Working isolated PostgreSQL/Supabase staging environment.
2. Clean migration rebuild and complete pgTAP/RLS execution.
3. Prisma live parity and query smoke tests.
4. Authenticated Tenant A/B golden journey with refresh persistence.
5. Release decision for the 124-commit branch delta.
6. Security acceptance or remediation for seven HIGH advisories.

## Verdict

**RED — NOT READY.** `ORANGE — PILOT READY` is explicitly disallowed because clean rebuild, Prisma parity, RLS, tenant isolation, authenticated E2E and refresh persistence are not all PASS.
