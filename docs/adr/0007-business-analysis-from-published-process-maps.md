# ADR-0007 — Business Analysis consumes published Process Maps

- Status: accepted
- Date: 2026-07-26

## Decision

Business Analysis consumes only a published Process Map and its referenced Enterprise Knowledge
snapshot. It has no dependency on Discovery or Interview. Versioned rules produce findings,
evidence, scores and health values. Rebuild always creates a new draft; optimistic locking returns
HTTP 409; publication freezes the complete snapshot.

The 19 named MVP detections use visible thresholds. Risk points are Critical 25, High 15, Medium 8,
Low 3 and Information 0. Score formulas and contributions are persisted for traceability.

## Consequences

Process Mapping remains canonical. Knowledge facts are referenced, not duplicated. Published
Analysis snapshots become the canonical input for future opportunity engines. Legacy Rules, ROI
and Recommendation modules remain separate.
