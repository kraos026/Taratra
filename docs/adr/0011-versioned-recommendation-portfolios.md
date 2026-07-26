# ADR 0011: Versioned Recommendation Portfolios

## Status

Accepted

## Decision

Sprint 11 introduces a bounded context separate from legacy Recommendation v1. It consumes published Sprint 10 ROI metrics without recalculation and freezes rules, priority definitions, source versions, contributions, evidence, dependencies, and roadmap phases.

## Consequences

This is the final business decision engine for AutomateX v1. Executive Report v2 may project published portfolios but must not recompute their decisions.
