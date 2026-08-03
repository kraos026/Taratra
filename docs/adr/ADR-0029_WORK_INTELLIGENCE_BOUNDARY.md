# ADR-0029 — Work Intelligence bounded context

Status: Accepted  
Date: 2026-08-02

## Context

Audit V1 captures declared company knowledge in versioned sessions and snapshots. Continuous work
observations have a different lifecycle: append-only capture, human correction, longitudinal
patterns and qualification before any hand-off to V2. Putting this lifecycle inside Audit would
couple stable audit snapshots to an ongoing observation stream.

## Decision

Create an independent `work-intelligence` bounded context. It references tenant, company, process,
department, persona, tool and audit evidence by identifiers; it does not import or mutate their
aggregates.

The evidence stages are explicit and irreversible in meaning:

1. **Declared work** — what an audit or human states normally happens.
2. **Observed work** — a persistence-safe activity explicitly captured or imported.
3. **Inferred pattern** — deterministic aggregation of confirmed observations only.
4. **Work automation hypothesis** — an explainable hypothesis, distinct from the canonical V1
   Automation Opportunity and never an executable automation.
5. **Automation candidate** — a qualified, traceable hypothesis intended for projection into
   Enterprise Knowledge, not for direct solution design or specification.

Human correction creates a new activity version and supersedes inference for that lineage. No
employee productivity, ranking, disciplinary or hidden-monitoring score is permitted. Analysis is
limited to processes, activities, workflows and tools.

Enterprise Knowledge is the convergence boundary for Audit and Work Intelligence. Canonical ROI is
the economic-evaluation authority, Recommendation is the business-decision authority, and Solution
Designer is the future-state design authority. Work Intelligence never calls Solution Designer,
Automation Specification, Graph Compiler or Runtime directly.

Work Intelligence may produce only a `TimeSavingsEstimate`, never financial ROI. It may propose an
automation-governance signal, but Recommendation remains the future canonical authority. Observed
process ordering describes current work only; capabilities, connectors, future triggers and future
steps belong downstream to Solution Designer.
Normalization knowledge is injected as versioned configuration; the Domain Core contains no
industry, profession, vendor or application taxonomy.

## Consequences

- Audit, Enterprise Knowledge, Process Mapping and V2 remain unchanged.
- Provenance survives every projection.
- Initial persistence is an application port with an in-memory adapter; PostgreSQL/RLS is deferred
  until the operational retention contract is approved.
- Future AI classification may implement the normalization port, but cannot replace original text,
  provenance, confidence or human confirmation.
