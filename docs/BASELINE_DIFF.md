# AutomateX Baseline Diff

Status: **Implemented**

Comparison date: 2026-07-28  
Base: `origin/main` at `c99f6d4c4f3dcd97b6f63eeacae77d77625799c0`

## Main changes since the common base

All non-integrated Automation Specification/Generator branches diverge from `main` at
`cd5027b`. `main` then received seven direct documentation commits:

1. `bbe4ec6` — create `CODEX_CONTEXT.md`;
2. `32309d6` — update `CODEX_CONTEXT.md`;
3. `ffcc40d` — update `AUTOMATEX_CODEX.md`;
4. `668bbe2` — update `README.md`;
5. `4b588c3` — update `AUTOMATEX_CODEX.md`;
6. `53621b6` — create the empty `docs/product` file;
7. `c99f6d4` — add product documents under `docs/`.

The empty `docs/product` file conflicts structurally with the documented directory
`docs/product/` on `docs/enterprise-foundation`.

## Patch-equivalence findings

`git cherry origin/main <branch>` proves that:

- `feat/discovery-engine` commit `d2369b7` is already present by patch equivalence;
- `feat/solution-designer` commits `1ef623f` and `2ff6555` are already present by patch
  equivalence;
- `revert-19-revert-18-feat/solution-designer` commit `78951a3` is already present by patch
  equivalence;
- `feat/companies-module`, `feat/process-mapping-engine` and
  `revert-18-feat/solution-designer` contain no commit absent from `main`.

These branches must not be merged into the baseline.

## Commits absent from main

### Primary cumulative stack

| Commit                                     | Change                                             | ADR/document impact                         |
| ------------------------------------------ | -------------------------------------------------- | ------------------------------------------- |
| `2ae90f134c158f8699544bb8525156b54ec346a7` | Freeze Automation Specification architecture       | Frozen contract                             |
| `e11f5a8da2b1efc5053a2175bfb96f455561c9ee` | Implement Automation Specification Engine          | ADRs 0013, 0017–0019; architecture contract |
| `e27f6f7c5d491f3cd701adcc18abe65f51c7756f` | Align lifecycle, catalog validation and provenance | ADRs 0017, 0019                             |
| `805d2b491113b8f6c11882dc3610a5dd70116c56` | Define Automation Generator architecture           | Frozen Generator contract                   |
| `da468d72662e3e96d411ca646c68bb0da0bba2a2` | Add Generator Domain                               | ADRs 0013, 0017, 0019                       |
| `286844aa3155a07d637bae65e661a5d9f267baae` | Add Generator Application layer                    | ADRs 0014–0016                              |
| `68d8884fa1a7dc2765282217ada5490f10f32970` | Add Infrastructure adapters                        | ADRs 0015, 0016, 0018                       |
| `afe6c17e4db8d37f623d2df4b9abb7475c7ac8cc` | Add Composition Root                               | ADR 0020                                    |
| `8c1ed605fffee7aa712838aef7930fb246f20332` | Establish enterprise documentation                 | ADRs 0013–0020 and documentation tree       |
| `92b4927a4d2ea497f3586e487e3a11823170f858` | Audit project and prioritize work                  | `PROJECT_AUDIT.md`, `NEXT_STEPS.md`         |

### Enterprise Simulator documentation

| Commit                                     | Change                                                           | ADR/document impact                             |
| ------------------------------------------ | ---------------------------------------------------------------- | ----------------------------------------------- |
| `5c95deaecebacd28ec18dcf9feaa76efb50821fe` | Simulator architecture and initial contracts                     | No AutomateX runtime ADR; planned tool contract |
| `d77e3dacb6d041415a34439599bf69ddc6b5f3aa` | Resolve identity, cleanup, idempotency and correlation contracts | Simulator architecture only                     |
| `e03b4d25f3e88da739cba7ee8a634cd9e9332ff3` | Add implementation roadmap                                       | Simulator documentation only                    |

## File impact

### Primary stack: 112 files

The cumulative diff modifies:

- root contracts: `AUTOMATEX_CODEX.md`, `AUTOMATION_GENERATOR_ARCHITECTURE.md`,
  `AUTOMATION_SPECIFICATION_ARCHITECTURE.md`;
- 38 enterprise documents under `docs/`, including ADRs 0013–0020, architecture, product,
  development, security, testing, API, operations, project state, audit and roadmap;
- `prisma/schema.prisma`;
- 7 Automation Specification API/integration files under `src/app/api/`;
- 16 Automation Specification domain/application/infrastructure/presentation files under
  `src/modules/automation-specifications/`;
- 34 Automation Generator domain/application/infrastructure/composition files under
  `src/modules/automation-generator/`;
- migrations `20260727190000_add_automation_specification_engine.sql` and
  `20260728110000_add_automation_generator_infrastructure.sql`;
- `supabase/tests/automation_specification_rls.test.sql`.

The exact manifest is reproducible with:

```bash
git diff --name-only origin/main...origin/docs/enterprise-foundation
```

### Intermediate stack branches

Their file sets are strict prefixes of the 112-file cumulative manifest:

| Branch                                       | Files | Scope added at its HEAD                                                                     |
| -------------------------------------------- | ----: | ------------------------------------------------------------------------------------------- |
| `feat/automation-specification-engine`       |    26 | Specification contract, Prisma, API, domain/application/infrastructure, migration and pgTAP |
| `docs/automation-generator-architecture`     |    27 | Previous scope plus Generator architecture                                                  |
| `feat/automation-generator-domain`           |    44 | Previous scope plus Generator domain and unit tests                                         |
| `feat/automation-generator-application`      |    56 | Previous scope plus commands, queries, ports and application tests                          |
| `feat/automation-generator-infrastructure`   |    67 | Previous scope plus adapters, migration and tests                                           |
| `feat/automation-generator-composition-root` |    72 | Previous scope plus composition providers and tests                                         |

### Enterprise Simulator: 14 files

`ENTERPRISE_SIMULATOR_ARCHITECTURE.md`,
`ENTERPRISE_SIMULATOR_IMPLEMENTATION_ROADMAP.md`, and twelve files under
`tools/enterprise-simulator/` covering README, test plan, proposed catalogs, public contracts,
schemas, package configuration and TypeScript configuration.

### Integrated or obsolete branches

No functional file delta remains for Companies or Process Mapping. Discovery and Solution
Designer show historical three-dot diffs because their branch points predate later merges, but
their unique commits are patch-equivalent to `main`. The revert/reapply branches are historical
and must not be treated as change sources.

## Conflict analysis

`git merge-tree --write-tree origin/main <branch>` reports:

| Branch                                 | Result       | Details                                                                                                               |
| -------------------------------------- | ------------ | --------------------------------------------------------------------------------------------------------------------- |
| Primary stack through Composition Root | Clean        | Runtime stack merges mechanically                                                                                     |
| `docs/enterprise-foundation`           | **Conflict** | Content conflict in `AUTOMATEX_CODEX.md`; file/directory conflict between `docs/product` and `docs/product/`          |
| Enterprise Simulator                   | Clean        | Still requires semantic review after baseline                                                                         |
| Discovery                              | Conflict     | Historical add/add conflicts in `docs/ARCHITECTURE.md`, `ROADMAP.md`, `VISION.md`; branch is already patch-equivalent |
| Solution Designer corrected branch     | Clean        | Already integrated by equivalent content; do not merge                                                                |
| Reapply revert branch                  | Conflict     | Prisma, Solution Designer source/tests and migration add/add conflicts; historical branch only                        |

## Validation evidence

### Current cumulative branch

Executed from a clean dependency install at `92b4927`:

| Check                       | Result                                                                                                                                                     |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `npm ci`                    | Pass; 558 packages installed                                                                                                                               |
| `npm run db:generate`       | Pass; Prisma 7.8 client generated                                                                                                                          |
| `npm run lint`              | Pass; zero warnings                                                                                                                                        |
| `npm run format:check`      | Pass                                                                                                                                                       |
| `npm run typecheck`         | Pass                                                                                                                                                       |
| `npm test`                  | Pass; 71 files, 320 tests                                                                                                                                  |
| `npm run build`             | Pass; Next.js 16.2.12                                                                                                                                      |
| Dependency rules            | Pass through TypeScript and bounded-context boundary tests; repository-wide import graph enforcement remains Planned                                       |
| ADR review                  | Pass for the cumulative stack; implementation follows ADRs 0013–0020                                                                                       |
| Product Constitution review | Pass: determinism, provenance, tenant boundaries, immutable versions, explicit rebuild, catalog/domain separation, tests and documentation are represented |

### Database validation

`supabase start` / `supabase test db` could not run because Docker Desktop's Linux engine pipe was
unavailable. This is an environment blocker, not a passing result. Historical GitHub Actions
`database-security` checks are green for every unique runtime commit and the current cumulative
HEAD, but pgTAP must be rerun on the reconciled integration commit.

### CI by unique commit

All unique commits except `2ae90f1` have successful `quality` and `database-security` checks.
`2ae90f1` has no direct check run; its exact content is included in all later green descendants.
PR #21 also has both jobs green.

### Known quality risks

- `npm ci` reports 13 dependency vulnerabilities: 4 moderate and 9 high. No automated fix was
  applied because baseline work must not change dependencies silently.
- The current verification proves the cumulative branch, not the not-yet-created reconciliation
  tree. All checks must be repeated after conflict resolution.
- Direct GitHub edits on `main` weakened review traceability even though they are documentation
  changes.

## Diff conclusion

The functional baseline content is coherent but split. The only required integration conflict is
documentation ownership. Runtime work must be integrated as one preserved stack, while obsolete
and patch-equivalent branches must be archived rather than merged.
