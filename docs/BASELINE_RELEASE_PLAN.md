# AutomateX Baseline Release Plan

Status: **Planned**

Prepared: 2026-07-28  
Target: `automatex-platform-v1.0.0-baseline`  
Security source: [`SECURITY_REMEDIATION_PLAN.md`](SECURITY_REMEDIATION_PLAN.md)

## Purpose

This document defines the controlled path to the first Release Candidate. It does not authorize
package changes, business changes, migrations or a merge.

The nine Must Fix findings are two atomic dependency families:

- ESLint family: `eslint`, `@eslint/config-array`, `@eslint/eslintrc`, `minimatch` and
  `brace-expansion`;
- Prisma family: `prisma`, `@prisma/dev`, `@hono/node-server` and `valibot`.

Transitive packages must be corrected through supported parent upgrades. Directly overriding a
transitive package across major versions is prohibited unless a separate compatibility review
approves it.

## Must Fix package plans

### 1. `prisma`

| Item                       | Plan                                                                                                                                                                                                                                                     |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Current version            | 7.8.0                                                                                                                                                                                                                                                    |
| Target version             | 7.9.1                                                                                                                                                                                                                                                    |
| Potential breaking changes | Patch release, but Prisma generation, engine binaries, configuration and adapter behavior can change. `prisma`, `@prisma/client` and compatible adapter packages must remain aligned. No schema regeneration result may be accepted without diff review. |
| Impact                     | Removes the affected Prisma development chain and changes generated/tooling artifacts only; no business model change is authorized.                                                                                                                      |
| Tests to rerun             | `npm ci`, `db:generate`, generated-file diff, lint, format, typecheck, 320+ Vitest tests, build, clean replay of 19 migrations, all 17 pgTAP suites, repository/transaction/outbox/idempotency tests and both CI jobs.                                   |
| Rollback                   | Revert the security commit and restore the exact previous `package.json` and lockfile. Regenerate the 7.8.0 client. No database rollback is expected because no migration is permitted.                                                                  |
| Update order               | First direct package in security update 1; update with `@prisma/client` and `@prisma/adapter-pg` compatibility verified in the same change.                                                                                                              |

### 2. `@prisma/dev`

| Item                       | Plan                                                                                                                       |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| Current version            | 0.24.3                                                                                                                     |
| Target version             | 0.24.17, selected transitively by Prisma 7.9.1                                                                             |
| Potential breaking changes | Internal Prisma package; no direct API is used by AutomateX. Direct pinning would create an unsupported graph.             |
| Impact                     | Removes the vulnerable Hono dependency from the observed graph and selects corrected Valibot.                              |
| Tests to rerun             | Prisma CLI version, client generation, schema validation, migration replay, Vitest, build, pgTAP and `npm ls @prisma/dev`. |
| Rollback                   | Roll back the parent Prisma upgrade; never modify this transitive dependency independently.                                |
| Update order               | Resolved automatically immediately after `prisma` 7.9.1.                                                                   |

### 3. `@hono/node-server`

| Item                       | Plan                                                                                                                               |
| -------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Current version            | 1.19.11                                                                                                                            |
| Target version             | Absent from the resolved graph. If retained unexpectedly, at least 2.0.5; current corrected release observed during audit: 2.0.12. |
| Potential breaking changes | Major change from 1.x to 2.x if forced directly. AutomateX must not add or pin this internal Prisma dependency.                    |
| Impact                     | Eliminates static-file middleware bypass and Windows encoded-backslash path traversal exposure from tooling.                       |
| Tests to rerun             | `npm ls @hono/node-server`, Prisma generation/schema commands on Windows and Linux CI, build and migration replay.                 |
| Rollback                   | Roll back the Prisma security commit. No standalone Hono rollback is permitted.                                                    |
| Update order               | Verify elimination after `@prisma/dev` resolves to 0.24.17.                                                                        |

### 4. `valibot`

| Item                       | Plan                                                                                                                        |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Current version            | 1.2.0                                                                                                                       |
| Target version             | 1.4.2                                                                                                                       |
| Potential breaking changes | Validation behavior may differ within the transitive tooling dependency. AutomateX does not import Valibot directly.        |
| Impact                     | Corrects the inherited-property-name failure in Prisma development validation.                                              |
| Tests to rerun             | Prisma schema validation/generation, invalid-schema failure cases where available, full Vitest, build and `npm ls valibot`. |
| Rollback                   | Roll back the Prisma security commit and lockfile as one unit.                                                              |
| Update order               | Verify the version selected by `@prisma/dev` 0.24.17 after the parent upgrade.                                              |

### 5. `eslint`

| Item                       | Plan                                                                                                                                                                                                                                |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Current version            | 9.39.5                                                                                                                                                                                                                              |
| Target version             | 10.8.0                                                                                                                                                                                                                              |
| Potential breaking changes | Major release: Node support, flat configuration behavior, rule defaults, formatter/plugin compatibility and removed legacy APIs may change. Compatibility with `eslint-config-next` 16.2.12 must be demonstrated before acceptance. |
| Impact                     | Moves the ESLint-owned dependency paths to corrected config-array and minimatch versions. No lint rule may be disabled merely to make the upgrade pass.                                                                             |
| Tests to rerun             | Node 22 clean install, lint with zero warnings, format check, typecheck, all Vitest tests, build, boundary tests, CI and comparison of linted file scope before/after.                                                              |
| Rollback                   | Revert the isolated ESLint security commit and restore the previous lockfile/configuration. Do not retain partial configuration adaptations.                                                                                        |
| Update order               | Begin security update 2 only after the Prisma update is independently green and committed.                                                                                                                                          |

### 6. `@eslint/config-array`

| Item                       | Plan                                                                                                              |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Current version            | 0.21.2                                                                                                            |
| Target version             | 0.23.5                                                                                                            |
| Potential breaking changes | Internal configuration matching changes. Direct imports are not expected; verify none exist.                      |
| Impact                     | Corrects the vulnerable minimatch chain used by ESLint core.                                                      |
| Tests to rerun             | Lint scope comparison, ignored-file behavior, boundary tests, full quality job and `npm ls @eslint/config-array`. |
| Rollback                   | Roll back ESLint 10.8.0; do not pin config-array independently.                                                   |
| Update order               | Resolve transitively with ESLint 10.8.0, then verify.                                                             |

### 7. `@eslint/eslintrc`

| Item                       | Plan                                                                                                                                                                                 |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Current version            | 3.3.6                                                                                                                                                                                |
| Target version             | Absent from the ESLint 10.8.0 dependency graph                                                                                                                                       |
| Potential breaking changes | Removal can expose reliance on legacy eslintrc compatibility. AutomateX uses flat configuration and must confirm no direct or indirect project configuration depends on legacy APIs. |
| Impact                     | Eliminates one vulnerable minimatch path.                                                                                                                                            |
| Tests to rerun             | ESLint configuration resolution, complete lint, ignored files, plugin loading and `npm ls @eslint/eslintrc`.                                                                         |
| Rollback                   | Restore ESLint 9.39.5 and the complete prior lockfile/configuration.                                                                                                                 |
| Update order               | Verify removal immediately after ESLint upgrade.                                                                                                                                     |

### 8. `minimatch`

| Item                       | Plan                                                                                                                                      |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Current version            | 3.1.5 on affected paths                                                                                                                   |
| Target version             | 10.2.5 or later for ESLint-owned paths; 10.2.6 was current during planning                                                                |
| Potential breaking changes | Major API and glob-semantics differences. A global override from 3.x to 10.x could break Next.js ESLint plugins and is prohibited.        |
| Impact                     | Removes the vulnerable brace-expansion chain from ESLint core. Plugin-owned 3.x paths may remain under the separate V1.1 risk acceptance. |
| Tests to rerun             | `npm ls minimatch`, lint scope/ignore snapshots, all quality checks and a fresh audit distinguishing every remaining dependency path.     |
| Rollback                   | Revert the ESLint parent upgrade. Remove no individual lockfile entry manually.                                                           |
| Update order               | Verify ESLint-owned paths after ESLint 10.8.0; classify remaining Next-plugin paths against the approved exception register.              |

### 9. `brace-expansion`

| Item                       | Plan                                                                                                                        |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Current version            | 1.1.16 on affected paths                                                                                                    |
| Target version             | 5.0.8 on corrected paths                                                                                                    |
| Potential breaking changes | Cross-major behavior change if overridden directly. The target must arrive through a supported minimatch parent.            |
| Impact                     | Corrects GHSA-mh99-v99m-4gvg, the unbounded expansion memory-exhaustion root cause.                                         |
| Tests to rerun             | `npm ls brace-expansion`, lint pattern/ignore behavior, quality job, memory-safe advisory verification through `npm audit`. |
| Rollback                   | Roll back the supported parent upgrade; never force a standalone transitive downgrade or upgrade.                           |
| Update order               | Last verification in the ESLint dependency family after minimatch paths are known.                                          |

## SECURITY_UPDATE_ORDER

### Step 1 — Reconcile the baseline candidate

Create the integration branch from current `origin/main` and merge the cumulative platform branch
without squash. Resolve documentation conflicts only. Record the candidate and rollback SHAs.

No dependency update starts before the platform has one reproducible candidate SHA.

### Step 2 — Capture immutable evidence

Archive:

- `node --version`, `npm --version` and Supabase CLI version;
- `package.json`, lockfile hash and `npm ls`;
- `npm audit --json`;
- Prisma generated-client hash;
- 320-test result, build output and pgTAP result.

### Step 3 — Update the Prisma family

In one isolated security commit:

1. update Prisma package family to 7.9.1 with compatible direct packages aligned;
2. allow npm to resolve `@prisma/dev` 0.24.17 and Valibot 1.4.2;
3. verify `@hono/node-server` is absent;
4. make no schema or migration change.

### Step 4 — Validate and approve the Prisma family

Run the complete application and database matrix. Review generated diffs and dependency graph.
Open a security-only PR. Do not proceed to ESLint until it is green and independently approved.

### Step 5 — Update ESLint core

In a second isolated security commit:

1. update ESLint to 10.8.0;
2. perform only required configuration compatibility changes;
3. keep every lint rule active;
4. verify config-array 0.23.5 and removal of eslintrc;
5. inspect minimatch and brace-expansion by dependency path.

### Step 6 — Validate and approve ESLint

Run lint with zero warnings and the complete quality matrix. Compare lint scope before and after.
Reject unsafe overrides or an incompatible `eslint-config-next` downgrade.

### Step 7 — Resolve the remaining audit status

Run a fresh `npm audit --json`.

If Next.js plugin findings remain because no compatible fixed release exists:

- record each approved exception, owner, controls and expiry;
- explicitly state that the audit is not literally clean;
- keep the Release Candidate blocked if governance requires zero findings.

The phrase “npm audit clean” must never be checked when the command still reports findings.

### Step 8 — Execute Release Candidate validation

From a clean checkout of the exact candidate SHA, run:

```bash
npm ci
npm audit --json
npm run db:generate
npm run lint
npm run format:check
npm run typecheck
npm test
npm run build
supabase start
supabase test db
```

GitHub Actions must repeat both jobs on the same SHA.

### Step 9 — Synchronize release documentation

Update only release artifacts: security audit result, project state, roadmap, ADR index if a
decision changed, changelog and release notes. Dependency changes that do not alter architecture
do not require a new ADR; a deviation or permanent risk acceptance does.

### Step 10 — Sign and tag

After independent approval:

1. record the final commit and tree hash;
2. sign the baseline attestation;
3. create an annotated, signed tag `automatex-platform-v1.0.0-baseline`;
4. verify the remote tag and published release notes;
5. retain the pre-release rollback tag.

## BASELINE_RELEASE_CHECKLIST

### Source and scope

- [ ] Development freeze remains active.
- [ ] One reconciled baseline branch exists.
- [ ] `origin/main` and the cumulative platform history are both ancestors.
- [ ] No business behavior, endpoint or migration changed during security remediation.
- [ ] Exact pre-update and rollback SHAs are recorded.

### Dependency security

- [ ] Prisma family updated and reviewed independently.
- [ ] ESLint core updated and reviewed independently.
- [ ] All nine Must Fix package paths are corrected or eliminated.
- [ ] `npm audit` is clean with zero findings.
- [ ] If zero findings are impossible because of upstream Next.js packages, the checkbox above
      remains open and Release Management explicitly decides whether the baseline stays blocked.
- [ ] No `npm audit fix --force` or unsafe transitive override was used.
- [ ] Lockfile is committed and reproducible with `npm ci`.
- [ ] Software composition evidence and exception register are archived.

### Quality

- [ ] Build passes.
- [ ] Lint passes with zero warnings.
- [ ] Format check passes.
- [ ] Typecheck passes.
- [ ] Vitest passes with no removed or disabled test.
- [ ] Coverage report is generated and thresholds are approved.
- [ ] Dependency boundary tests pass.
- [ ] Generated Prisma diff is reviewed.

### Database and security

- [ ] Docker/Supabase starts from a clean environment.
- [ ] All 19 migrations replay successfully.
- [ ] All 17 pgTAP suites pass.
- [ ] RLS tenant isolation passes.
- [ ] Transaction, outbox, idempotency and optimistic-locking tests pass.
- [ ] No new schema or migration was introduced by package remediation.

### CI and review

- [ ] GitHub Actions `quality` passes on the exact candidate SHA.
- [ ] GitHub Actions `database-security` passes on the exact candidate SHA.
- [ ] Security review approves the dependency graph.
- [ ] Architecture review confirms no boundary or contract changed.
- [ ] Release Manager approves the evidence bundle.

### Documentation and governance

- [ ] Documentation is synchronized.
- [ ] Relative links pass validation.
- [ ] ADRs and ADR index are synchronized.
- [ ] Roadmap is synchronized.
- [ ] Product Constitution remains satisfied.
- [ ] `PROJECT_STATE.md` reflects the exact implementation state.
- [ ] Release notes are approved.
- [ ] Changelog is approved.
- [ ] Known risks and accepted exceptions include owner and expiry.

### Release

- [ ] Final baseline SHA and tree hash are recorded.
- [ ] Rollback procedure is rehearsed or independently reviewed.
- [ ] Baseline attestation is signed.
- [ ] Annotated tag `automatex-platform-v1.0.0-baseline` is signed.
- [ ] Tag signature and remote tag are verified.
- [ ] Release notes and evidence reference the same SHA.

## Release gate

The Release Candidate is **not authorized** by this plan. Authorization requires every mandatory
checkbox to be closed. If Release Management retains a literal zero-finding `npm audit clean`
policy, the current unresolved Next.js plugin chain can keep the baseline blocked until compatible
upstream releases exist. The status must not be represented as clean through suppression,
downgrade or removal of quality controls.
