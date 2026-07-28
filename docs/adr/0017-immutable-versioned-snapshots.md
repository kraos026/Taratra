# ADR-0017 — Immutable Versioned Snapshots

Status: **Implemented**

## Context

Downstream engines require stable and auditable upstream decisions.

## Decision

Published snapshots are immutable and consumed by exact identifier/version references. Rebuild
follows the owning bounded context's explicit lineage rules and never silently mutates a published
result.

## Consequences

Storage grows by version, but historical decisions remain reproducible and explainable.
