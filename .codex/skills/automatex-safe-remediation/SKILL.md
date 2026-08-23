---
name: automatex-safe-remediation
description: Correct proven AutomateX defects with minimal blast radius. Use for bug fixes, failing tests, runtime failures, certification blockers, config defects, data defects, migration defects, or environment blockers where a root cause must be proven before patching.
---

# AutomateX Safe Remediation

## Workflow

1. Reproduce the defect.
2. Capture evidence.
3. Identify the root cause.
4. Classify the defect:
   - PRODUCT BUG
   - TEST BUG
   - CONFIG BUG
   - DATA BUG
   - MIGRATION BUG
   - ENVIRONMENT BUG
   - UNKNOWN
5. Identify the canonical contract.
6. Propose the minimal patch.
7. Implement only the authorized scope.
8. Run targeted tests.
9. Run appropriate regression tests.
10. Report exact files changed.

## Rules

- Never change product behavior solely to satisfy a stale test.
- Never patch a symptom before proving root cause; if classification is UNKNOWN, diagnose first.
- Prefer minimal patches over broad refactors.
- Do not modify Brain/AI/engines during unrelated infrastructure work.
- Preserve tenant isolation and lineage through all canonical artifacts.
- Keep remediation commits scoped; do not mix product, infrastructure, tests, docs, and lab work unless the mission explicitly authorizes that combined scope.
