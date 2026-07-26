# ADR 0012: Solution Designer as the first V2 bounded context

## Status

Accepted

## Decision

Solution Designer consumes only a published Recommendation and its exact published ROI and
Automation Opportunity sources. It produces one versioned, explainable Solution Blueprint per
Recommendation. Pattern selection, topology, capabilities, connectors, constraints, risks,
complexity and relative technical cost are read from published versioned catalogs.

The blueprint is platform-agnostic. It does not generate code or workflows, select a platform,
deploy, or modify a V1 aggregate.

## Consequences

Published blueprints and catalog versions are immutable. Rebuild creates a new draft. RLS,
tenant-scoped composite references and optimistic locking protect every lifecycle operation.
