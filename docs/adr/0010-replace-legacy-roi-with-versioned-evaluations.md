# ADR 0010: Sprint 10 introduces versioned ROI evaluations

## Status

Accepted

## Decision

The legacy audit/recommendation ROI v1 remains unchanged for compatibility. Sprint 10 is a separate bounded context that evaluates published Automation Opportunity snapshots using versioned models and frozen assumptions. It never reads Discovery or Interview.

Each version freezes all upstream source IDs, formula and assumption versions, scenarios, metrics, contributions, and evidence. No currency conversion or implicit economic default is permitted.

## Consequences

Sprint 11 Recommendation must consume published Sprint 10 ROI snapshots. The legacy ROI module is not a valid input for the new engine chain and may only be retired through a later compatibility ADR.
