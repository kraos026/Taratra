---
name: automatex-certification
description: Certify AutomateX from a clean state. Use for local, staging, pilot, P0, release, Playwright, pgTAP/RLS, migration, Prisma, tenant isolation, golden journey, or exact-SHA certification tasks.
---

# AutomateX Certification

## Gates

- G0 Git state
- G1 dependencies/build
- G2 local Supabase
- G3 migrations
- G4 Prisma validate/generate
- G5 pgTAP/RLS
- G6 auth
- G7 tenant isolation
- G8 canonical Golden Journey
- G9 downstream artifacts
- G10 refresh/persistence
- G11 Playwright stability
- G12 staging exact-SHA certification

## Canonical downstream

ROI → Recommendation Portfolio → Blueprint → Specification → Executive Result

## Certification language

Use only:

- PASS
- FAIL
- NOT RUN
- NOT CERTIFIED
- BLOCKED

Never infer PASS.

## Rules

- Local disposable Supabase is the default certification DB.
- Do not reset staging unless explicitly authorized and proven disposable.
- Do not claim production readiness from local-only evidence.
- Local PASS does not imply staging PASS.
- Staging PASS does not imply production PASS.
- Certification evidence must reference the exact Git SHA and target environment.
- Do not certify a dirty worktree as release-ready.
- Required migrations and untracked required files must be part of the coherent certified commit set.
