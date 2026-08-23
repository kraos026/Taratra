# AutomateX Project Governance

## Product identity

AutomateX is an Automation Intelligence Platform for SMEs.

Core question: "What should I automate first?"

AutomateX is not:

- a generic chatbot;
- a generic workflow builder;
- an ERP;
- a CRM;
- a replacement for foundation models.

## Core principle

AI explains. Rule engines decide. User validates.

## Current canonical flow

Auth
→ Organization/Tenant
→ Company
→ Audit
→ Discovery
→ Interview
→ Enterprise Knowledge
→ Process Map
→ Business Analysis
→ AI Opportunities
→ Automation Opportunities
→ ROI Evaluation
→ Recommendation Portfolio
→ Solution Blueprint
→ Automation Specification
→ Executive Result / Decision Center

## Current architectural status

CANONICAL:

- the current certified production flow listed above.

SHADOW:

- Brain V2;
- live advanced AI unless explicitly certified otherwise;
- experimental bridges.

LEGACY:

- old ROI where superseded;
- old recommendations where superseded;
- historical questionnaire/rule paths where superseded.

PARTIAL:

- Automation Generator;

FUTURE:

- Runtime;
- Deployment;
- Monitoring;
- Optimization;
- Agents.

## Governance rules

1. Never create a parallel engine when a canonical engine exists without explicit architecture approval.
2. Never replace a canonical API contract merely to satisfy a stale test.
3. Never modify Brain/AI/engines during unrelated infrastructure work.
4. Never perform destructive staging/production operations without explicit approval.
5. Local disposable Supabase is the default certification DB.
6. Supabase migrations own database evolution.
7. Prisma is an application mapping/client, not the migration owner.
8. Every remediation must identify the proven root cause first.
9. Prefer minimal patches over broad refactors.
10. Certification evidence must distinguish: code exists, wired, tested, E2E, certified, production proven.
11. Do not call shadow/lab features production-active.
12. Do not call deterministic AI Opportunity logic a live LLM runtime.
13. Preserve tenant isolation and lineage through all canonical artifacts.
14. New features must identify their place: CANONICAL / SHADOW / LEGACY / FUTURE.
15. No production-ready claim without an exact clean Git SHA and environment certification.

## Worktree hygiene policy

- Never mix unrelated product, infrastructure, test, documentation, and experimental work in one commit.
- One mission must have one explicit scope.
- Before a new major feature begins, previous authorized work must be committed, intentionally shelved, or explicitly documented as pending.
- Required migrations must be committed with their related product change.
- Untracked required files mean the feature is not complete.
- Certification results must reference an exact Git SHA.
- Do not allow long-lived mixed dirty worktrees to become the normal development state.
- Experimental/lab artifacts must remain separate from P0/P1 release work.

## Feature closure rule

A feature is not DONE merely because it compiles. DONE requires, where applicable:

- canonical owner identified;
- architecture status identified;
- implementation complete;
- tests complete;
- persistence complete;
- migration committed;
- RLS/security impact checked;
- tenant lineage preserved;
- UI/API contract verified;
- documentation/status updated;
- coherent Git commit created;
- certification updated if product-critical.

## Root-cause-first rule

Never patch a symptom before proving root cause.

Classify the defect before remediation:

- PRODUCT BUG
- TEST BUG
- CONFIG BUG
- DATA BUG
- MIGRATION BUG
- ENVIRONMENT BUG
- UNKNOWN

If the classification is UNKNOWN, diagnose first. Never modify product logic only to make a stale test pass.

## Release discipline

- Local PASS does not imply staging PASS.
- Staging PASS does not imply production PASS.
- GREEN requires an exact clean SHA and target-environment evidence.
- No release based on a dirty worktree.
- No production-ready claim based only on source inspection.
- No destructive remote database operation without explicit approval.
- Supabase migrations are the schema source of truth.
- Prisma is the application mapping/client, not migration authority.

## Shadow / canonical promotion rule

A SHADOW capability cannot become CANONICAL merely because it exists or performs well in synthetic tests.

Promotion requires:

- defined domain ownership;
- comparison against the canonical baseline;
- pilot evidence;
- failure analysis;
- provenance;
- tenant safety;
- human override where required;
- repeatable certification.

## Repository-local skills

Repository-local AutomateX skills live under `.codex/skills/<skill-name>/SKILL.md`.

Use the relevant skill before planning or implementation:

- `automatex-project-governance`
- `automatex-readonly-audit`
- `automatex-safe-remediation`
- `automatex-certification`
- `automatex-architecture-guard`
- `automatex-database-safety`
- `automatex-release-readiness`
