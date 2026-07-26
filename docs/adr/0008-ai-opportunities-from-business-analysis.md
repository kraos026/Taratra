# ADR-0008 — AI Opportunities consume published Business Analysis

- Status: accepted
- Date: 2026-07-26

## Decision

AI Opportunity consumes a published Business Analysis snapshot, its published Process Map and the
exact Enterprise Knowledge snapshot referenced by Analysis. It never accesses Discovery or
Interview. Detection uses versioned data catalogs for capabilities, rules and score definitions;
no LLM or network call participates in a decision.

One opportunity may reference several capabilities. MVP aliases resolve to the canonical catalog:
AI Assistant to Knowledge Assistant, predictive and demand analytics to Forecasting, fraud
detection to Anomaly Detection, and CV classification to Text Classification plus Information
Extraction.

Rebuild creates a new draft. Publication freezes source versions, catalog versions, findings,
evidence, scores, prerequisites and affected entities. Optimistic locking returns HTTP 409.

## Consequences

Business Analysis remains the canonical finding source. AI Opportunity identifies and explains
possibilities but calculates no ROI and produces no recommendation or prioritization. Published
snapshots become an input for the later Automation Opportunity, ROI and Recommendation engines.
