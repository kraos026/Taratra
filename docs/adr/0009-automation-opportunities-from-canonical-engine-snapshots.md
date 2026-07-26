# ADR 0009: Automation opportunities consume canonical published snapshots

## Status

Accepted

## Decision

The Automation Opportunity bounded context consumes only a published AI Opportunity snapshot and its exact published Business Analysis, published Process Map, and ready Enterprise Knowledge snapshot. Detection is driven by immutable versioned pattern, connector, rule, and score catalogs.

Discovery and Interview are forbidden dependencies. Connector availability requires explicit Knowledge evidence. A rebuild creates a new draft; publication freezes sources, catalogs, scores, evidence, and provenance.

## Consequences

Sprint 10 ROI and Sprint 11 Recommendation can consume explainable published automation snapshots. Source evolution requires an explicit rebuild and never silently changes a published result.
