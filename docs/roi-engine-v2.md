# ROI Engine — Sprint 10

The Sprint 10 ROI bounded context is separate from the legacy audit ROI v1. It consumes only a published Automation Opportunity snapshot and its exact published AI Opportunity, Business Analysis, Process Map, and ready Enterprise Knowledge snapshot.

## Inputs and scenarios

Every evaluation declares one ISO 4217 currency. Currency conversion is out of scope. Economic assumptions must be explicitly supplied or come from a published organization-specific catalog version; system definitions intentionally contain no economic default values.

Three scenarios freeze their assumptions and factors:

- Conservative: volume/time × 0.75; costs × 1.20.
- Expected: volume/time × 1; costs × 1.
- Optimistic: volume/time × 1.25; costs × 0.90.

## Versioned formulas

- `annual_hours_saved = hours_saved_per_occurrence × annual_frequency × scenario_volume × automation_coverage`
- `monthly_hours_saved = annual_hours_saved / 12`
- `annual_cost_saved = annual_hours_saved × hourly_cost`
- `annual_benefit = annual_cost_saved + avoided_error_cost`
- `initial_cost = implementation_cost + training_cost + infrastructure_cost`
- `annual_net_benefit = annual_benefit - maintenance_cost`
- `roi = ((annual_net_benefit - initial_cost) / initial_cost) × 100`
- `payback = initial_cost / monthly_net_benefit`

Positive benefit with zero initial cost is stored as `special_value = unbounded`; JSON and PostgreSQL never receive Infinity.

Confidence is Automation Opportunity confidence 50%, evidence availability 25%, and assumption completeness 25%.

## Lifecycle and access

`draft → validated → published → archived`. Rebuild always creates a new draft and reuses the prior version's frozen expected assumptions. Optimistic locking returns HTTP 409. Published snapshots, scenarios, assumptions, contributions, evidence, and metrics are immutable. Consultants, admins, and owners evaluate and validate; only admins and owners publish; viewers are read-only.

## API

- `POST /api/automation-opportunities/:id/roi`
- `POST /api/roi/:id/rebuild`
- `POST /api/roi/:id/validate`
- `POST /api/roi/:id/publish`
- `GET /api/roi/:id`
- `GET /api/companies/:id/roi`

The read-only explorer is `/roi/:id`. Prioritization and recommendations remain out of scope.
