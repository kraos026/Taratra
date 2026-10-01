# Optivos V1 — evidence integrity remediation

Scope: existing CANONICAL V1 engines and their customer projections. No V2,
live Brain promotion, dependency change or production mutation.

## Corrected contracts

- Business findings cite facts attached to the condition's source steps, or facts
  matching the evaluated text condition. An arbitrary first fact or headcount is
  not proof. Unsupported findings have zero confidence and block publication.
- Absence of a KPI term in collected sources does not prove that a business has
  no KPI. It requires more information; it cannot authorize forecasting or
  reporting automation by borrowing an unrelated fact.
- Source map confidence caps finding confidence. Reference quantity does not
  establish strong evidence or raise ROI confidence.
- Executive causes remain explicitly unknown where the published read model has
  no established cause. Recommendations and impact statements are not causes.
- Opportunity explanations use opportunity-scoped evidence. Global artifact
  lineage remains traceability, not opportunity proof.
- Missing opportunity safety/evidence/ROI appears in the uncertainty overview.
  Fail-closed decisions and human-control prerequisites remain authoritative.
- Payback is not time to value. Annual benefit is not cost of inaction. These
  unsupported aliases remain unknown.
- Results and Decision Center share the same safety projection. Dashboard audit
  state comes from the canonical read model, not the legacy audit counter.
- A validated knowledge synthesis is not a blanket guarantee of proof quality.
- Provider explanations may select grounded canonical statements or deterministic
  templates, but cannot introduce unverified factual prose, change actions,
  remove controls, or omit material uncertainty. This does not activate a provider.

## Immutable catalog versions

The additive migration `20261001102018_clarify_roi_savings_basis.sql` introduces
version 2 of the existing ROI model and finding-coverage definition. This is
catalog versioning within V1, not the V2 product roadmap.

Coverage measures matched findings among findings in affected processes. It is
not a measured share of work time. In ROI model version 2,
`hours_saved_per_occurrence` already estimates saved time and is not multiplied
by finding coverage. Zero annual frequency remains zero. Shared assumptions do
not justify summing overlapping opportunity benefits.

Version 1 rows, formulas and existing published snapshots are preserved. Legacy
savings arithmetic remains version-aware; the confidence guard for newly
computed evaluations does not inflate source confidence in either version.
Previously published customer results are not silently recalculated or repaired.

No schema or RLS policy changes are required. The migration was applied only to
the guarded local certification database. Staging/production application requires
separate environment verification and release handling. Rollback means selecting
the prior application/catalog version for new work, not deleting historical rows.

## Certification scenarios

The original local canonical sample stopped at Business Analysis after removing
the fabricated headcount-to-KPI evidence link. This negative result is retained
as evidence of the safety guard, not described as a successful journey.

The positive local runner now explicitly declares a monthly invoice-volume KPI
in its synthetic interview source, using the sample's existing 85 invoices and
45 manual hours. It does not add evidence directly to downstream tables, bypass
validation, or change client data. Unit tests separately verify that an unrelated
headcount leaves the unsupported finding blocked and that a declared KPI prevents
the missing-KPI assertion.

Local verification never implies staging or production certification. Final
release readiness requires the exact clean source SHA and target-environment
checks, including a fresh journey; preserved historical artifacts are not proof
of the corrected engine's execution.
