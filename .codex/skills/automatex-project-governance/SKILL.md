---
name: automatex-project-governance
description: Apply AutomateX architecture and engineering governance before planning or implementation. Use for any AutomateX feature, fix, certification, architecture, refactor, audit, or release task to identify canonical ownership, current status, expected files, DB/security impact, test plan, duplication risk, and out-of-scope work.
---

# AutomateX Project Governance

Before planning or implementation, produce this pre-work output:

```text
MISSION:
AFFECTED DOMAIN:
CANONICAL OWNER:
CURRENT STATUS:
FILES EXPECTED:
DB IMPACT:
SECURITY IMPACT:
TEST PLAN:
OUT-OF-SCOPE:
```

## Procedure

1. Identify the requested work area.
2. Identify the canonical owner in the current flow:
   Auth → Organization/Tenant → Company → Audit → Discovery → Interview → Enterprise Knowledge → Process Map → Business Analysis → AI Opportunities → Automation Opportunities → ROI Evaluation → Recommendation Portfolio → Solution Blueprint → Automation Specification → Executive Result / Decision Center.
3. Classify the feature status as CANONICAL, SHADOW, LEGACY, PARTIAL, or FUTURE.
4. Check for an existing equivalent implementation before creating anything new.
5. Detect V1/V2 duplication risk.
6. Identify affected routes, services, tables, and tests.
7. State whether product logic modification is necessary.
8. Avoid unrelated scope expansion.

## Core rules

- AI explains. Rule engines decide. User validates.
- Do not create a parallel engine without explicit architecture approval.
- Do not call shadow/lab features production-active.
- Do not claim production readiness without a clean SHA and environment certification.
- Keep worktree scope explicit: one mission, one coherent commit scope.
- A feature is not DONE merely because it compiles; verify ownership, implementation, tests, persistence, migrations, security, UI/API contract, documentation, commit, and certification where applicable.
- SHADOW capabilities, including Brain/AI/lab work, require defined ownership, baseline comparison, pilot evidence, provenance, tenant safety, human override where required, and repeatable certification before becoming CANONICAL.
