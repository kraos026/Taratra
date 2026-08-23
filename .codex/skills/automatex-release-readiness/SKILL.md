---
name: automatex-release-readiness
description: Determine whether a precise AutomateX version can become a pilot or release candidate. Use for release gates, P0/P1 readiness, staging certification, production readiness, exact-SHA reviews, and deciding RED/ORANGE/GREEN status.
---

# AutomateX Release Readiness

## Required evidence

- clean SHA;
- clean clone reproducibility;
- dependency install;
- format;
- lint;
- typecheck;
- tests;
- build;
- current full migration chain;
- Prisma validation/generation/status;
- RLS/pgTAP;
- Playwright;
- canonical downstream;
- tenant isolation;
- staging exact-SHA certification.

## Verdicts

- RED — NOT READY
- ORANGE — PILOT READY
- GREEN — PRODUCTION READY

Never use GREEN based only on local evidence.
GREEN requires an exact clean SHA and target-environment evidence.
Local PASS does not imply staging PASS; staging PASS does not imply production PASS.
Do not base a release on a dirty worktree or source inspection alone.

## Report discipline

Distinguish:

- code exists;
- wired;
- tested;
- E2E;
- certified;
- production proven.

## Closure checks

Before pilot/release readiness, confirm product-critical work has a coherent Git commit, required migrations committed, tenant lineage preserved, RLS/security impact checked, UI/API contract verified, and documentation/status updated where applicable.
