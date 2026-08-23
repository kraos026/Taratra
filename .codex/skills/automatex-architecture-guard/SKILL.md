---
name: automatex-architecture-guard
description: Prevent AutomateX architectural drift. Use before implementation or refactor to detect duplicate modules, old-vs-new ownership conflicts, legacy routes, duplicate persistence, UI/API mismatch, Brain vs deterministic engine ownership issues, and broken canonical lineage.
---

# AutomateX Architecture Guard

Before implementation, check:

- Does an equivalent module already exist?
- Who owns the capability now: old module or canonical module?
- Is the requested route/API legacy?
- Would this create duplicate persistence?
- Is there a UI/API contract mismatch?
- Is Brain being confused with deterministic engine ownership?
- Is canonical lineage preserved?
- Is the capability being promoted from SHADOW to CANONICAL without baseline comparison, pilot evidence, failure analysis, provenance, tenant safety, human override where required, and repeatable certification?
- Is the implementation status explicitly CANONICAL, SHADOW, LEGACY, PARTIAL, or FUTURE?

## Blockers

Block accidental new parallel stacks. Require explicit architecture approval before:

- adding a second engine for a canonical capability;
- replacing canonical API contracts;
- bypassing tenant isolation;
- promoting Brain/lab output to production truth;
- writing directly into downstream artifacts without approved service boundaries.

## Promotion rule

SHADOW capabilities cannot become CANONICAL merely because they exist or perform well in synthetic tests. Require explicit ownership, comparison against the canonical baseline, pilot evidence, failure analysis, provenance, tenant safety, human override where required, and repeatable certification.
