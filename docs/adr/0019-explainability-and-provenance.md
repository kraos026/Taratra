# ADR-0019 — Explainability and Provenance

Status: **Implemented**

## Context

Enterprise decisions must be auditable from final output to source evidence.

## Decision

Engines preserve source snapshot identity, version, applied catalog rules, consumed facts,
evidence, confidence where applicable, and reasons for ignored or unsupported inputs.

## Consequences

Explainability is domain data, not generated prose. A language model may summarize it but cannot
replace or invent it.
