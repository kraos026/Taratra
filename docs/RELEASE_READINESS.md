# AutomateX Release Readiness

Status: **Implemented**

Audit date: 2026-07-28  
Candidate branch: `docs/enterprise-foundation`  
Candidate SHA: `c5cadea33476c84f612268d0852389c484e65b75`  
Target tag: `automatex-platform-v1.0.0-baseline`  
Reference `origin/main`: `c99f6d4c4f3dcd97b6f63eeacae77d77625799c0`

## 1. Executive summary

### Verdict: NO GO

AutomateX is functionally healthy but is not yet a releasable baseline.

The candidate passes the complete GitHub Actions matrix: `quality` and `database-security` are
green on the exact SHA. A clean local install also passes Prisma generation, lint, format,
typecheck, 320 Vitest tests and the production build. The architecture is mature, deterministic,
multi-tenant and well documented.

Release is blocked because:

1. the candidate is not reconciled with `origin/main`;
2. merging it currently produces a content conflict in `AUTOMATEX_CODEX.md` and a file/directory
   conflict at `docs/product`;
3. there is no single integration SHA containing both histories;
4. test coverage is not measured and no release threshold exists;
5. `npm audit` reports 13 vulnerable packages, including 9 classified High;
6. local PostgreSQL/pgTAP reproduction is unavailable until Docker Desktop is running, although
   the same database suite passes in CI.

These are release-governance and supply-chain blockers. They do not justify changing business
behavior.

## 2. Architecture

| Area             |  Score | Assessment                                                                                                                                                                                                    |
| ---------------- | -----: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Domain           | 8.5/10 | Strong bounded contexts, aggregates, Value Objects, deterministic engines, immutable published snapshots and provenance. Some older contexts are less uniformly structured than the latest Generator context. |
| Application      |   8/10 | CQRS separation, ports, transaction orchestration and idempotency are explicit in the newest contexts. Consistency across older modules is not yet enforced repository-wide.                                  |
| Infrastructure   | 7.5/10 | Prisma adapters, Supabase/PostgreSQL, outbox and transaction adapters are separated. Database complexity and 19 sequential migrations increase operational risk.                                              |
| Composition Root |   8/10 | Generator providers have explicit construction and resolution tests. The approach is documented in ADR-0020, but is not yet uniformly applied to every older context.                                         |
| Documentation    |   8/10 | Broad enterprise documentation exists and reflects the implementation. Reconciliation conflicts and duplicate product-document locations prevent a higher score.                                              |
| ADR              | 8.5/10 | Twenty ADRs cover bounded contexts and cross-cutting decisions. The first twelve require formatting normalization, without changing their decisions.                                                          |
| Dependency Rules | 7.5/10 | TypeScript strictness and bounded-context boundary tests enforce important constraints. A repository-wide automated import graph remains Planned.                                                             |

**Architecture average: 8.0/10.**

The architecture is suitable for a baseline once the histories are reconciled and all checks run
on the resulting SHA.

## 3. Quality

| Control                          | Evidence                                            | Result                       |
| -------------------------------- | --------------------------------------------------- | ---------------------------- |
| Clean installation               | `npm ci`                                            | Pass; 558 packages installed |
| Prisma generation                | `npm run db:generate`                               | Pass; Prisma Client 7.8.0    |
| Lint                             | `npm run lint`                                      | Pass; zero warnings          |
| Format                           | `npm run format:check`                              | Pass                         |
| Typecheck                        | `npm run typecheck`                                 | Pass                         |
| Unit/component/integration tests | `npm test`                                          | Pass; 71 files, 320 tests    |
| Production build                 | `npm run build`                                     | Pass; Next.js 16.2.12        |
| GitHub Actions quality           | Exact candidate SHA                                 | Pass                         |
| Coverage                         | No script, provider, report or threshold configured | **Not measured**             |

The number of passing tests is not a substitute for coverage. Release readiness requires at least
a recorded baseline for statements, branches, functions and lines, followed by approved
thresholds. Adding measurement is a quality change, not a business feature.

## 4. Security

### Audit summary

`npm audit --json` reports:

| Severity                      |  Count |
| ----------------------------- | -----: |
| Critical                      |      0 |
| High                          |      9 |
| Medium                        |      4 |
| Low                           |      0 |
| **Total vulnerable packages** | **13** |

The count represents affected packages in the dependency graph, not thirteen independent
advisories. Most alerts share transitive root causes in development tooling. No automatic
`npm audit fix --force` was applied because it would introduce unreviewed major-version changes.

### Critical

No Critical vulnerability reported.

### High

| Package                         | Origin                                  | Impact                                                                                                                                             | Required remediation                                                                                                                                     |
| ------------------------------- | --------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `eslint@9.39.5`                 | Direct dev dependency                   | Pulls vulnerable `minimatch`/`brace-expansion`; crafted glob expansion can exhaust memory during lint/CI. Not shipped as application runtime code. | Validate a coordinated upgrade to ESLint 10.8.0 or a compatible patched dependency set; rerun lint and Next.js compatibility checks.                     |
| `eslint-config-next@16.2.12`    | Direct dev dependency                   | Pulls affected ESLint plugins and vulnerable glob matching. Exposure is primarily build/CI.                                                        | Do not apply npm's suggested downgrade to 12.0.4 blindly. Upgrade to a compatible patched Next/ESLint configuration after upstream compatibility review. |
| `@eslint/config-array@0.21.2`   | Transitive through ESLint               | Uses affected `minimatch`; untrusted or pathological patterns can trigger denial of service in tooling.                                            | Resolved through the coordinated ESLint upgrade.                                                                                                         |
| `@eslint/eslintrc@3.3.6`        | Transitive through ESLint               | Same glob-expansion denial-of-service chain.                                                                                                       | Resolved through the coordinated ESLint upgrade.                                                                                                         |
| `eslint-plugin-import@2.32.0`   | Transitive through `eslint-config-next` | Uses vulnerable `minimatch`; affects lint-time path matching.                                                                                      | Upgrade through a compatible `eslint-config-next` dependency set.                                                                                        |
| `eslint-plugin-jsx-a11y@6.10.2` | Transitive through `eslint-config-next` | Same lint-time glob-expansion denial-of-service exposure.                                                                                          | Upgrade through a compatible `eslint-config-next` dependency set.                                                                                        |
| `eslint-plugin-react@7.37.5`    | Transitive through `eslint-config-next` | Same lint-time glob-expansion denial-of-service exposure.                                                                                          | Upgrade to a release resolving the affected transitive dependency, coordinated with Next ESLint configuration.                                           |
| `minimatch@3.1.5`               | Transitive through ESLint and plugins   | Depends on vulnerable `brace-expansion`; pathological patterns can cause an out-of-memory crash.                                                   | Move dependency graph to patched `minimatch`/`brace-expansion` through supported parent upgrades.                                                        |
| `brace-expansion@1.1.16`        | Transitive through `minimatch`          | GHSA-mh99-v99m-4gvg, CVSS 7.5: unbounded expansion can crash the process through memory exhaustion.                                                | Upgrade parent packages so `brace-expansion` resolves to a patched line; verify lockfile with `npm audit`.                                               |

### Medium

| Package                     | Origin                                                        | Impact                                                                                                                                                                                                                   | Required remediation                                                                                                            |
| --------------------------- | ------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| `prisma@7.8.0`              | Direct dev dependency and transitive peer of `@prisma/client` | Pulls vulnerable Prisma development tooling. The reported chain does not establish exposure in the deployed Next.js runtime, but affects trusted development/build operations.                                           | Upgrade Prisma and `@prisma/client` together to 7.9.1 or later after schema generation, migration and adapter regression tests. |
| `@prisma/dev@0.24.3`        | Transitive through Prisma CLI                                 | Aggregates the Hono static-file and Valibot issues below.                                                                                                                                                                | Resolved by upgrading Prisma to 7.9.1 or later.                                                                                 |
| `@hono/node-server@1.19.11` | Transitive through `@prisma/dev`                              | GHSA-92pp-h63x-v22m and GHSA-frvp-7c67-39w9: static-file middleware bypass/path traversal, including encoded Windows backslashes. AutomateX does not directly expose this server; risk is in Prisma development tooling. | Upgrade Prisma to 7.9.1 or later, which updates the transitive dependency; confirm the old version is absent from the lockfile. |
| `valibot@1.2.0`             | Transitive through `@prisma/dev`                              | GHSA-5qjj-4xww-7phc: crafted inherited property names can make `flatten()` throw, producing a tooling denial of service.                                                                                                 | Upgrade Prisma to 7.9.1 or later and verify the resolved Valibot version.                                                       |

### Security interpretation

- There are no reported Critical packages.
- The nine High entries are concentrated in the lint toolchain and largely derive from one
  `brace-expansion` denial-of-service advisory.
- The four Medium entries are concentrated in Prisma development tooling.
- “Development-only” reduces production exploitability but does not remove supply-chain or CI
  risk. A baseline must record an explicit accept/fix decision for every finding.
- RLS, tenant checks and PostgreSQL tests pass in the exact-SHA GitHub Actions
  `database-security` job.

## 5. Database

| Area         | Assessment                                                                                                                          | Result                                                                        |
| ------------ | ----------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Prisma       | Strict schema and generated client; server adapters are separated from domain/application                                           | Ready with condition: upgrade path for Prisma audit findings must be reviewed |
| Migrations   | 19 ordered SQL migrations; no manual schema change is part of this audit                                                            | Structurally ready; full fresh replay required on reconciliation SHA          |
| RLS          | 33 explicit `ENABLE ROW LEVEL SECURITY` occurrences and 149 policies across migrations; tenant isolation has dedicated pgTAP suites | Ready based on static review and green CI                                     |
| Transactions | Transaction boundaries exist in services/adapters and PostgreSQL lifecycle functions/triggers                                       | Ready; integration SHA must be retested                                       |
| pgTAP        | 17 database test files; GitHub Actions `database-security` passes on candidate SHA                                                  | CI ready; local reproduction currently blocked                                |
| Docker       | Docker Desktop Linux engine pipe unavailable during local audit                                                                     | **Condition not met locally**                                                 |

The failed local `supabase start` is not classified as a test failure because CI ran the complete
database job successfully on Linux. It remains a reproducibility condition for the release
workstation and for validating the future reconciliation SHA.

## 6. Documentation

| Area         |  Score | Assessment                                                                                                                                                                                         |
| ------------ | -----: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Completeness |   8/10 | 76 Markdown documents cover product, architecture, development, security, testing, API, operations, bounded contexts and reference material. Several area READMEs remain intentionally high-level. |
| Coherence    | 6.5/10 | The candidate is coherent internally, but conflicts with direct documentation changes on `main`. Product documents exist in competing root and canonical-directory locations.                      |
| Links        |  10/10 | Automated relative-link scan found zero broken local links.                                                                                                                                        |
| ADR          | 8.5/10 | 20 ADR files plus index; decisions are traceable. Older ADR formatting normalization remains Planned.                                                                                              |
| Roadmap      |   8/10 | Current engine direction and planned work are documented; reconciliation must select one canonical version.                                                                                        |
| Constitution |   9/10 | Determinism, explainability, multi-tenancy, immutability, bounded-context ownership and human publication controls are explicit.                                                                   |

**Documentation average: 8.3/10.**

Documentation is release-grade only after resolving `AUTOMATEX_CODEX.md`, replacing the empty
`docs/product` file with the canonical directory, and reconciling duplicate product documents.

## 7. Remaining risks

### Critical

| Risk                              | Impact                                                                                                     | Required action                                                            |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| No unique reconciled baseline SHA | A tag today would omit either current `main` documentation or the Automation Specification/Generator stack | Create and validate the integration branch described in `BASELINE_PLAN.md` |

### High

| Risk                                                | Impact                                                         | Required action                                              |
| --------------------------------------------------- | -------------------------------------------------------------- | ------------------------------------------------------------ |
| Documentation merge conflicts                       | Silent loss or contradiction of product and architecture rules | Semantic owner review; no automatic “ours/theirs” resolution |
| Nine High npm package findings                      | CI denial of service and unapproved vulnerable supply chain    | Fix or formally accept each finding with expiry and owner    |
| Coverage not measured                               | Unknown untested behavior despite 320 passing tests            | Produce coverage baseline and approve thresholds             |
| Fresh database replay not yet run on reconciled SHA | Migration or RLS regression may appear only after integration  | Run clean Supabase start and all pgTAP tests                 |

### Medium

| Risk                                                    | Impact                                                | Required action                                                      |
| ------------------------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------- |
| Four Medium Prisma-tooling findings                     | Development/build exposure                            | Coordinated Prisma 7.9.1+ upgrade and regression suite               |
| Repository-wide dependency graph enforcement is Planned | Cross-context imports may escape local boundary tests | Add an architecture-wide check in a separate approved quality change |
| Nineteen migrations increase recovery complexity        | Longer replay and greater rollback risk               | Verify backup/PITR and fresh migration replay                        |
| Direct documentation commits on `main`                  | Reduced review traceability                           | Require PR-only changes and mandatory checks                         |

### Low

| Risk                               | Impact                                 | Required action                                     |
| ---------------------------------- | -------------------------------------- | --------------------------------------------------- |
| Stale remote branches              | Accidental merge or operator confusion | Archive only after baseline tag                     |
| Older ADR formatting inconsistency | Slower navigation, no behavior impact  | Normalize after baseline without changing decisions |

## 8. Release conditions

### Mandatory checklist

- [ ] Create `baseline/automatex-platform-v1` from the latest `origin/main`.
- [ ] Merge `docs/enterprise-foundation` without squash or history rewrite.
- [ ] Resolve `AUTOMATEX_CODEX.md` semantically.
- [ ] Resolve the `docs/product` file/directory conflict.
- [ ] Reconcile duplicate root and canonical product documentation.
- [ ] Confirm the frozen architecture SHA `2ae90f134c158f8699544bb8525156b54ec346a7`
      remains an ancestor.
- [ ] Run `npm ci`, Prisma generation, lint, format check, typecheck, tests and build on the exact
      reconciliation SHA.
- [ ] Start Supabase from a clean Docker environment.
- [ ] Replay all 19 migrations.
- [ ] Pass all 17 pgTAP suites on the exact reconciliation SHA.
- [ ] Obtain green GitHub Actions `quality` and `database-security`.
- [ ] Generate a test coverage report and approve release thresholds.
- [ ] Resolve or formally accept all 13 npm findings; no Critical finding may remain.
- [ ] Synchronize documentation, ADR index, roadmap and Product Constitution.
- [ ] Verify one unique baseline SHA and record rollback SHA.
- [ ] Create the tag `automatex-platform-v1.0.0-baseline` only after approval.

### Already satisfied on the current candidate

- [x] Build succeeds.
- [x] Lint succeeds with zero warnings.
- [x] Typecheck succeeds.
- [x] 320 Vitest tests pass.
- [x] GitHub Actions `quality` passes.
- [x] GitHub Actions `database-security` passes.
- [x] No Critical npm vulnerability is reported.
- [x] Relative documentation links are valid.
- [x] Architecture and Product Constitution have been reviewed.

## 9. Final decision

# NO GO

AutomateX has sufficient functional and architectural maturity for a baseline candidate, but not
for the official baseline tag today. The decisive blocker is the absence of one reconciled,
reviewed and fully validated SHA. Tagging either current branch would create an incomplete source
of truth.

The decision can become **GO WITH CONDITIONS** only after reconciliation, exact-SHA CI and fresh
database validation succeed, coverage is measured, and every npm finding has a documented
remediation or time-bounded acceptance. It becomes **GO** when all mandatory checklist items are
closed and the approved integration SHA is tagged without rewriting history.
