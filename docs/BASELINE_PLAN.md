# AutomateX Baseline Reconciliation Plan

Status: **Planned**

Target base: `origin/main` at `c99f6d4c4f3dcd97b6f63eeacae77d77625799c0`

## Decision

Create one temporary integration branch, `baseline/automatex-platform-v1`, from the then-current
`origin/main`. Merge `origin/docs/enterprise-foundation` into it with a regular non-squash merge.
This preserves the ten original commits and the frozen architecture SHA
`2ae90f134c158f8699544bb8525156b54ec346a7`.

Do not rebase, squash or cherry-pick the stack: those strategies would replace the commit identity
used as an architecture reference.

## Preconditions

1. Freeze feature development and direct writes to `main`.
2. Require pull requests and both `quality` and `database-security` checks on `main`.
3. Start Docker Desktop and verify the Supabase Linux containers can run.
4. Record the pre-integration `main` SHA and create a recoverable safety tag:
   `baseline/pre-reconciliation-2026-07-28`.
5. Confirm the documentation owner for the duplicate product documents.
6. Keep PR #21 draft and out of the runtime reconciliation.

## Merge order

### Phase 1 — Build the integration tree

1. Create `baseline/automatex-platform-v1` from the latest `origin/main`.
2. Merge `origin/docs/enterprise-foundation` using `--no-ff`.
3. Resolve `AUTOMATEX_CODEX.md` semantically: preserve the current product guidance from `main`
   and the enterprise architecture/documentation index from the branch.
4. Remove the empty `docs/product` file as part of conflict resolution and retain the
   `docs/product/` directory. Reconcile the duplicate root product documents with the canonical
   directory versions without changing business decisions.
5. Verify that the merge contains all ten stack commits as ancestors.

### Phase 2 — Validate the candidate

Run, in this order:

```bash
npm ci
npm run db:generate
npm run lint
npm run format:check
npm run typecheck
npm test
npm run build
supabase start
supabase test db
```

Also verify:

- boundary tests and forbidden-import scans;
- every migration on a fresh local database;
- RLS isolation and cross-tenant denial;
- ADR 0013–0020 compliance;
- every Product Constitution principle;
- `git diff --check`;
- no new public endpoint beyond the reviewed Automation Specification API;
- exact ancestry of frozen architecture commits.

Open a reconciliation PR to `main`; never push the merge commit directly.

### Phase 3 — Establish the baseline

After review and green CI:

1. merge the reconciliation PR without squash;
2. verify the remote merge SHA;
3. tag that exact merge commit as `automatex-platform-v1.0.0-baseline`;
4. publish release notes containing the migration list, test counts, known dependency
   vulnerabilities and deferred Simulator status;
5. retain the pre-reconciliation tag until at least one successful deployment validation.

### Phase 4 — Normalize branches

After the tag exists:

- archive/delete the intermediate Automation Specification/Generator branches;
- archive Companies, Discovery, Process Mapping, Solution Designer and revert branches already
  represented in `main`;
- update PR #21 onto the tagged baseline and review it independently;
- do not include Simulator implementation in the platform baseline.

## Why PR #21 is deferred

The Enterprise Simulator is a separate, planned internal tool. Its branch is a sibling of the
Generator stack and does not affect the AutomateX runtime. Mixing it into reconciliation would
increase scope and blur the baseline. After the tag, it may be updated and merged as a
documentation-only PR if its contracts still match the final public API.

## Risks and controls

| Risk                                              | Probability | Impact   | Control                                                                                   |
| ------------------------------------------------- | ----------- | -------- | ----------------------------------------------------------------------------------------- |
| Product documentation conflict changes a decision | High        | High     | Named owner, semantic review, no automatic conflict selection                             |
| Frozen architecture SHA lost                      | Medium      | High     | Non-squash merge and ancestry assertion                                                   |
| Migration/RLS regression                          | Medium      | Critical | Fresh Supabase start, full pgTAP, green `database-security`                               |
| Hidden dependency violation                       | Medium      | High     | Boundary tests plus manual import review; later add repository-wide graph enforcement     |
| Vulnerable dependencies                           | High        | High     | Separate reviewed dependency-hardening change after baseline; do not run forced audit fix |
| Old branch merged accidentally                    | Medium      | High     | Protect `main`, archive stale branches after tag                                          |
| Direct edits bypass review                        | Medium      | High     | Enforce PR-only writes and required checks                                                |

## Rollback

No history rewrite is permitted.

Before merge:

- delete the temporary integration branch if validation fails;
- leave `main` unchanged;
- correct the integration branch and rerun the complete matrix.

After merge but before deployment:

- revert the reconciliation merge through a reviewed PR;
- reset no shared branch;
- preserve both safety tags and migration evidence.

After database migration:

- stop rollout;
- restore using the documented database backup/point-in-time recovery procedure;
- revert application deployment to the pre-reconciliation tag;
- do not improvise destructive down migrations.

## Acceptance criteria

The official baseline may be tagged only when:

- all ten cumulative commits are ancestors of the candidate;
- the seven current `main` commits remain ancestors;
- no unresolved or semantic documentation conflict remains;
- lint, format, typecheck, 320+ Vitest tests and production build pass;
- Supabase starts from clean state and all pgTAP/RLS tests pass;
- GitHub Actions `quality` and `database-security` pass on the exact candidate SHA;
- ADR and Product Constitution review is signed off;
- no feature, unrelated refactor, endpoint or API was added during reconciliation;
- rollback artifacts and release notes exist.

## Current recommendation

**Do not declare a baseline yet.** The platform is functionally healthy on the cumulative branch,
but the official baseline remains blocked by documentation conflicts, unavailable local pgTAP
execution, dependency vulnerabilities requiring a separate review, and the absence of a single
CI-validated reconciliation SHA.
