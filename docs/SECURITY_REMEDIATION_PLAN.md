# AutomateX Security Remediation Plan

Status: **Planned**

Audit date: 2026-07-28  
Source: `npm audit --json` on
`563671934a1906c0a5faf78974ade055c6c5370f`  
Scope: dependency remediation only; no package is changed by this plan.

## Executive decision

The audit reports 13 vulnerable packages: 9 High, 4 Medium, 0 Critical and 0 Low. These are not
thirteen independent exploits:

- nine packages belong to one ESLint/minimatch/brace-expansion development-tooling chain;
- four packages belong to one Prisma development-tooling chain;
- no affected package has been demonstrated to be reachable from the deployed AutomateX request
  path;
- build and test dependencies remain part of the trusted supply chain and therefore cannot be
  ignored.

Two supported remediation tracks exist:

1. upgrade ESLint from 9.39.5 to 10.8.0, which selects `@eslint/config-array` 0.23.5 and
   `minimatch` 10.2.5 or later;
2. upgrade Prisma and `@prisma/client` together from 7.8.0 to 7.9.1, which selects
   `@prisma/dev` 0.24.17 and `valibot` 1.4.2.

The three ESLint plugins supplied by `eslint-config-next` have no newer compatible published
release at the audit date. They require a time-bounded acceptance until the Next.js toolchain
publishes a compatible corrected graph. npm's suggestion to downgrade `eslint-config-next` to
12.0.4 is rejected because it is incompatible with Next.js 16 and is not a safe remediation.

## Classification rules

- **Must Fix Before Baseline**: a supported correction exists and the package is a direct
  dependency or is eliminated through that supported parent upgrade.
- **Can Wait Until V1.1**: no compatible upstream fix exists, exposure is limited to trusted
  development/build input, and compensating controls are documented.
- **Acceptable Risk**: residual transitive finding with no independent reachable behavior after
  its parent risk is controlled. Acceptance must have an owner and expiry; it is not permanent.

## High vulnerabilities

### 1. `eslint`

| Attribute                   | Assessment                                                                                                                                                                                                                    |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Current version             | 9.39.5                                                                                                                                                                                                                        |
| Corrected version available | 10.8.0                                                                                                                                                                                                                        |
| Dependency                  | Direct development dependency                                                                                                                                                                                                 |
| Environment                 | Development, lint, test and CI build; not production runtime                                                                                                                                                                  |
| Severity                    | High                                                                                                                                                                                                                          |
| Actual AutomateX impact     | Loads the affected glob-matching chain while linting repository-controlled files. A pathological pattern could exhaust CI or developer memory.                                                                                |
| Risk without correction     | Repeatable CI denial of service, developer workstation instability and a persistent High supply-chain finding.                                                                                                                |
| Remediation strategy        | Upgrade ESLint to 10.8.0 in an isolated security PR. Confirm compatibility with `eslint-config-next`, run the entire quality matrix and inspect configuration deprecations. Never use `npm audit fix --force` without review. |
| Difficulty                  | Medium                                                                                                                                                                                                                        |
| Regression risk             | Medium to High: major-version lint behavior and configuration changes                                                                                                                                                         |
| Classification              | **Must Fix Before Baseline**                                                                                                                                                                                                  |

### 2. `@eslint/config-array`

| Attribute                   | Assessment                                                                                                                      |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| Current version             | 0.21.2                                                                                                                          |
| Corrected version available | 0.23.5                                                                                                                          |
| Dependency                  | Transitive through ESLint                                                                                                       |
| Environment                 | Development, lint and CI                                                                                                        |
| Severity                    | High                                                                                                                            |
| Actual AutomateX impact     | Uses the vulnerable minimatch chain to evaluate lint configuration/file patterns.                                               |
| Risk without correction     | Tooling memory exhaustion from pathological glob expansion.                                                                     |
| Remediation strategy        | Do not pin it independently. Upgrade ESLint to 10.8.0, which declares `@eslint/config-array ^0.23.5`, then verify the lockfile. |
| Difficulty                  | Low as part of the ESLint upgrade                                                                                               |
| Regression risk             | Low independently; Medium through the parent major upgrade                                                                      |
| Classification              | **Must Fix Before Baseline**                                                                                                    |

### 3. `@eslint/eslintrc`

| Attribute                   | Assessment                                                                                                           |
| --------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| Current version             | 3.3.6                                                                                                                |
| Corrected version available | No corrected 3.x release identified; removed from the ESLint 10.8.0 dependency graph                                 |
| Dependency                  | Transitive through ESLint                                                                                            |
| Environment                 | Development, lint and CI                                                                                             |
| Severity                    | High                                                                                                                 |
| Actual AutomateX impact     | Reaches vulnerable minimatch while resolving legacy ESLint configuration patterns.                                   |
| Risk without correction     | CI/developer denial of service and continued audit failure.                                                          |
| Remediation strategy        | Eliminate the dependency through the ESLint 10.8.0 upgrade. Confirm `npm ls @eslint/eslintrc` no longer resolves it. |
| Difficulty                  | Low as part of the parent upgrade                                                                                    |
| Regression risk             | Medium because removal accompanies an ESLint major upgrade                                                           |
| Classification              | **Must Fix Before Baseline**                                                                                         |

### 4. `brace-expansion`

| Attribute                   | Assessment                                                                                                                                                                                                       |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Current version             | 1.1.16 in affected ESLint paths                                                                                                                                                                                  |
| Corrected version available | 5.0.8                                                                                                                                                                                                            |
| Dependency                  | Transitive through minimatch                                                                                                                                                                                     |
| Environment                 | Development, lint, test and CI build                                                                                                                                                                             |
| Severity                    | High                                                                                                                                                                                                             |
| Actual AutomateX impact     | GHSA-mh99-v99m-4gvg, CVSS 7.5: unbounded brace expansion can cause an out-of-memory crash. Inputs are currently repository-controlled.                                                                           |
| Risk without correction     | A malicious or accidental glob can stop quality gates and exhaust worker resources.                                                                                                                              |
| Remediation strategy        | Do not force a standalone cross-major override. Upgrade supported parents so the affected paths resolve to patched minimatch/brace-expansion versions; verify all installed paths with `npm ls brace-expansion`. |
| Difficulty                  | Medium                                                                                                                                                                                                           |
| Regression risk             | High if overridden directly; Medium through supported parent upgrades                                                                                                                                            |
| Classification              | **Must Fix Before Baseline**                                                                                                                                                                                     |

### 5. `minimatch`

| Attribute                   | Assessment                                                                                                                                                    |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Current version             | 3.1.5 in affected ESLint paths                                                                                                                                |
| Corrected version available | 10.0.3 minimum from the advisory range; 10.2.5 is required by ESLint 10.8.0 and 10.2.6 is published                                                           |
| Dependency                  | Transitive through ESLint and Next ESLint plugins                                                                                                             |
| Environment                 | Development, lint, test and CI build                                                                                                                          |
| Severity                    | High                                                                                                                                                          |
| Actual AutomateX impact     | Carries the vulnerable brace-expansion implementation in several lint paths. The application does not call it at runtime.                                     |
| Risk without correction     | Quality-pipeline denial of service and inherited findings in six parent packages.                                                                             |
| Remediation strategy        | Upgrade ESLint first. Do not override the plugin-owned minimatch 3.x ranges with 10.x until plugin compatibility is proven. Track remaining paths separately. |
| Difficulty                  | Medium to High                                                                                                                                                |
| Regression risk             | High for a forced override; Medium for supported parent upgrades                                                                                              |
| Classification              | **Must Fix Before Baseline** for the ESLint-owned paths; remaining plugin paths are governed by entries 7–9                                                   |

### 6. `eslint-config-next`

| Attribute                   | Assessment                                                                                                                                                                                                                                             |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Current version             | 16.2.12                                                                                                                                                                                                                                                |
| Corrected version available | None compatible identified; 16.2.12 is the current published version at audit time                                                                                                                                                                     |
| Dependency                  | Direct development dependency                                                                                                                                                                                                                          |
| Environment                 | Development, lint and CI                                                                                                                                                                                                                               |
| Severity                    | High                                                                                                                                                                                                                                                   |
| Actual AutomateX impact     | Aggregates three plugins that still declare minimatch 3.x. It is not shipped as request-serving application code.                                                                                                                                      |
| Risk without correction     | Persistent High audit result and possible lint-time memory exhaustion from untrusted glob input.                                                                                                                                                       |
| Remediation strategy        | Reject npm's incompatible 12.0.4 downgrade. Pin current version, restrict CI to trusted repository changes, monitor Next.js releases, and upgrade as soon as a compatible corrected graph is published. Record an owner and expiry no later than V1.1. |
| Difficulty                  | High because remediation depends on upstream compatibility                                                                                                                                                                                             |
| Regression risk             | Critical if downgraded; Medium for a future supported upgrade                                                                                                                                                                                          |
| Classification              | **Can Wait Until V1.1**, with formal time-bounded risk acceptance before baseline                                                                                                                                                                      |

### 7. `eslint-plugin-import`

| Attribute                   | Assessment                                                                                                                                                       |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Current version             | 2.32.0                                                                                                                                                           |
| Corrected version available | None identified; 2.32.0 is current and declares `minimatch ^3.1.2`                                                                                               |
| Dependency                  | Transitive through `eslint-config-next`                                                                                                                          |
| Environment                 | Development, lint and CI                                                                                                                                         |
| Severity                    | High                                                                                                                                                             |
| Actual AutomateX impact     | Uses vulnerable minimatch only during import linting. Inputs are repository-controlled.                                                                          |
| Risk without correction     | Lint worker denial of service; no demonstrated production request exposure.                                                                                      |
| Remediation strategy        | Keep it managed by `eslint-config-next`; do not add a direct dependency or unsafe override. Monitor upstream and retest on the first compatible patched release. |
| Difficulty                  | High due to upstream dependency                                                                                                                                  |
| Regression risk             | High if minimatch is overridden across majors                                                                                                                    |
| Classification              | **Acceptable Risk** until V1.1 under the `eslint-config-next` acceptance                                                                                         |

### 8. `eslint-plugin-jsx-a11y`

| Attribute                   | Assessment                                                                                                                                |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Current version             | 6.10.2                                                                                                                                    |
| Corrected version available | None identified; 6.10.2 is current and declares `minimatch ^3.1.2`                                                                        |
| Dependency                  | Transitive through `eslint-config-next`                                                                                                   |
| Environment                 | Development, lint and CI                                                                                                                  |
| Severity                    | High                                                                                                                                      |
| Actual AutomateX impact     | Vulnerable glob expansion is reachable only from lint configuration/file matching.                                                        |
| Risk without correction     | Lint/CI denial of service; no demonstrated production exposure.                                                                           |
| Remediation strategy        | Track the upstream plugin/Next configuration release. Preserve accessibility linting rather than removing the plugin to hide the finding. |
| Difficulty                  | High due to upstream dependency                                                                                                           |
| Regression risk             | High if replaced or overridden incorrectly                                                                                                |
| Classification              | **Acceptable Risk** until V1.1 under the `eslint-config-next` acceptance                                                                  |

### 9. `eslint-plugin-react`

| Attribute                   | Assessment                                                                                                        |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Current version             | 7.37.5                                                                                                            |
| Corrected version available | None identified; 7.37.5 is current and declares `minimatch ^3.1.2`                                                |
| Dependency                  | Transitive through `eslint-config-next`                                                                           |
| Environment                 | Development, lint and CI                                                                                          |
| Severity                    | High                                                                                                              |
| Actual AutomateX impact     | Affected matching occurs during React lint analysis, not application execution.                                   |
| Risk without correction     | Lint worker memory exhaustion and persistent audit noise.                                                         |
| Remediation strategy        | Upgrade only through a compatible Next.js ESLint stack or an upstream plugin release. Do not disable React rules. |
| Difficulty                  | High due to upstream dependency                                                                                   |
| Regression risk             | High for forced transitive overrides                                                                              |
| Classification              | **Acceptable Risk** until V1.1 under the `eslint-config-next` acceptance                                          |

## Medium vulnerabilities

### 10. `prisma`

| Attribute                   | Assessment                                                                                                                                                                                                       |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Current version             | 7.8.0                                                                                                                                                                                                            |
| Corrected version available | 7.9.1                                                                                                                                                                                                            |
| Dependency                  | Direct development dependency; also paired with direct `@prisma/client`                                                                                                                                          |
| Environment                 | Development, schema generation, migration, test and CI build; generated client participates in production                                                                                                        |
| Severity                    | Medium                                                                                                                                                                                                           |
| Actual AutomateX impact     | The vulnerable code is in Prisma development tooling, not the generated query client path demonstrated by the audit.                                                                                             |
| Risk without correction     | Crafted tooling inputs could trigger path handling or validation failures; audit remains unresolved.                                                                                                             |
| Remediation strategy        | Upgrade `prisma`, `@prisma/client` and `@prisma/adapter-pg` together where compatible to 7.9.1. Regenerate client; test schema, all repositories, transactions, migrations, RLS, build and deployment packaging. |
| Difficulty                  | Medium                                                                                                                                                                                                           |
| Regression risk             | Medium: ORM patch release across a large schema                                                                                                                                                                  |
| Classification              | **Must Fix Before Baseline**                                                                                                                                                                                     |

### 11. `@prisma/dev`

| Attribute                   | Assessment                                                                                              |
| --------------------------- | ------------------------------------------------------------------------------------------------------- |
| Current version             | 0.24.3                                                                                                  |
| Corrected version available | 0.24.17 through Prisma 7.9.1; 0.25.0 is also published                                                  |
| Dependency                  | Transitive through Prisma CLI                                                                           |
| Environment                 | Development, schema tooling, migration and CI                                                           |
| Severity                    | Medium                                                                                                  |
| Actual AutomateX impact     | Parent package exposing the Hono and Valibot findings during trusted Prisma tooling operations.         |
| Risk without correction     | Tooling path traversal/static-file or validation denial-of-service exposure.                            |
| Remediation strategy        | Do not pin directly. Upgrade Prisma to 7.9.1 and verify `@prisma/dev@0.24.17` or later in the lockfile. |
| Difficulty                  | Low as part of Prisma upgrade                                                                           |
| Regression risk             | Low independently; Medium through Prisma                                                                |
| Classification              | **Must Fix Before Baseline**                                                                            |

### 12. `@hono/node-server`

| Attribute                   | Assessment                                                                                                                                                                                                   |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Current version             | 1.19.11                                                                                                                                                                                                      |
| Corrected version available | 1.19.13 for repeated-slash bypass; 2.0.5 for the Windows encoded-backslash advisory; 2.0.12 is current                                                                                                       |
| Dependency                  | Transitive through `@prisma/dev`                                                                                                                                                                             |
| Environment                 | Prisma development tooling on developer/CI hosts                                                                                                                                                             |
| Severity                    | Medium                                                                                                                                                                                                       |
| Actual AutomateX impact     | GHSA-92pp-h63x-v22m and GHSA-frvp-7c67-39w9 affect static-file path handling. AutomateX does not directly instantiate this server. Prisma 7.9.1 removes it from the observed `@prisma/dev` dependency graph. |
| Risk without correction     | Local tooling path traversal or file disclosure if the affected static server is invoked with attacker-controlled paths, especially on Windows.                                                              |
| Remediation strategy        | Eliminate the package by upgrading Prisma to 7.9.1. Verify `npm ls @hono/node-server` returns no affected path.                                                                                              |
| Difficulty                  | Low as part of Prisma upgrade                                                                                                                                                                                |
| Regression risk             | Low                                                                                                                                                                                                          |
| Classification              | **Must Fix Before Baseline**                                                                                                                                                                                 |

### 13. `valibot`

| Attribute                   | Assessment                                                                                                                            |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Current version             | 1.2.0                                                                                                                                 |
| Corrected version available | 1.4.2                                                                                                                                 |
| Dependency                  | Transitive through `@prisma/dev`                                                                                                      |
| Environment                 | Prisma development, validation and CI tooling                                                                                         |
| Severity                    | Medium                                                                                                                                |
| Actual AutomateX impact     | GHSA-5qjj-4xww-7phc: inherited object-property names can make `flatten()` throw. It is not an AutomateX domain validation dependency. |
| Risk without correction     | Crafted tooling data can terminate a Prisma validation operation.                                                                     |
| Remediation strategy        | Upgrade Prisma to 7.9.1, whose `@prisma/dev@0.24.17` requires `valibot@1.4.2`; verify the resolved lockfile.                          |
| Difficulty                  | Low as part of Prisma upgrade                                                                                                         |
| Regression risk             | Low                                                                                                                                   |
| Classification              | **Must Fix Before Baseline**                                                                                                          |

## Final classification

| Classification               | Packages                                                                                                                                                         | Count |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----: |
| **Must Fix Before Baseline** | `eslint`, `@eslint/config-array`, `@eslint/eslintrc`, `brace-expansion`, ESLint-owned `minimatch` paths, `prisma`, `@prisma/dev`, `@hono/node-server`, `valibot` |     9 |
| **Can Wait Until V1.1**      | `eslint-config-next`                                                                                                                                             |     1 |
| **Acceptable Risk**          | `eslint-plugin-import`, `eslint-plugin-jsx-a11y`, `eslint-plugin-react` under the same time-bounded Next.js toolchain acceptance                                 |     3 |

The classification of `minimatch` is path-sensitive: paths owned by ESLint must be corrected
before baseline; paths still owned by the current Next.js plugins remain part of the documented
V1.1 acceptance. The audit may therefore continue to display `minimatch` until upstream plugin
releases are available, even after the supported ESLint upgrade.

## Remediation sequence

### Security change 1 — Prisma tooling

1. Create a dedicated security branch from the reconciled baseline candidate.
2. Upgrade the Prisma package family to 7.9.1 without schema changes.
3. Run Prisma generation, migration replay, repository tests, Vitest, build and pgTAP.
4. Confirm `@hono/node-server` is absent and Valibot is 1.4.2 or later.
5. Commit the lockfile and record the post-change audit.

### Security change 2 — ESLint core

1. Create a separate security branch.
2. Upgrade ESLint to 10.8.0 without disabling rules.
3. Adapt configuration only where required by the major release.
4. Run lint with zero warnings, typecheck, all tests and build.
5. Confirm safe `@eslint/config-array`, minimatch and brace-expansion paths.

### Risk acceptance — Next.js ESLint plugins

The Release Manager must record:

- an accountable owner;
- an expiry no later than the V1.1 release;
- monthly `npm audit` review;
- trusted-only changes to lint configuration and glob inputs;
- no arbitrary external input in lint jobs;
- a prohibition on disabling lint or removing accessibility/React rules;
- immediate upgrade when a compatible corrected Next.js toolchain is published.

## Acceptance criteria

- No package is corrected by this document.
- Each remediation is isolated from business changes.
- `npm audit --json` is archived before and after each security PR.
- `npm ci`, Prisma generation, lint, format, typecheck, 320+ tests, build and pgTAP pass.
- GitHub Actions `quality` and `database-security` pass on each exact security SHA.
- No forced major transitive override is accepted without compatibility tests.
- Any remaining finding has an owner, justification, compensating controls and expiry.
