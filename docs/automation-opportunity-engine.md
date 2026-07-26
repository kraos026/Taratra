# Automation Opportunity Engine

This bounded context deterministically converts a published AI Opportunity snapshot into versioned automation opportunities. It reads only the linked published Business Analysis, published Process Map, and ready Enterprise Knowledge snapshot. It never reads Discovery or Interview.

## Deterministic catalogs

- 20 versioned automation patterns.
- 20 versioned connector definitions.
- Versioned detection rules containing the pattern, connectors, trigger, actions, and matching inputs.
- Seven versioned score definitions.

Connector availability requires explicit Knowledge evidence. REST API and Webhook are never assumed. Each opportunity has one primary pattern and trigger, while actions, connectors, and optional AI links may be multiple.

## Scores

- `business_impact`: Critical 100, High 75, Medium 50, Low 25, Information 10.
- `complexity`: Very Low 20, Low 40, Medium 60, High 80, Very High 100.
- `connector_availability`: evidenced required connectors / required connectors × 100; 100 when none are required.
- `automation_coverage`: matched relevant findings / relevant findings for the selected rule × 100; 0 with no relevant fact.
- `confidence`: Findings 50%, source AI opportunity 25%, Knowledge evidence 25%. Without an individual AI link, weights normalize to Findings 2/3 and Knowledge 1/3.
- `technical_feasibility`: connector availability 35% + input readiness 25% + inverse complexity 25% + confidence 15%.
- `automation_readiness`: mean of coverage, technical feasibility, connector availability, and confidence.

Every stored score retains its formula version and inputs. These are MVP defaults and are configurable through future versioned catalog entries.

## Lifecycle and security

`draft → validated → published → archived`. Rebuild creates a new draft linked through `previous_version_id`. Optimistic locking uses `lock_version`; conflicts return HTTP 409. Published snapshots and their descendants are immutable. Consultants, admins, and owners may detect, rebuild, and validate. Only admins and owners may publish. Viewers are read-only. PostgreSQL RLS enforces tenant isolation.

## API

- `POST /api/ai-opportunities/:id/automation-opportunities`
- `POST /api/automation-opportunities/:id/rebuild`
- `POST /api/automation-opportunities/:id/validate`
- `POST /api/automation-opportunities/:id/publish`
- `GET /api/automation-opportunities/:id`
- `GET /api/companies/:id/automation-opportunities`

The explorer at `/automation-opportunities/:id` is read-only. Workflow generation, ROI, recommendations, n8n, Make, and Zapier remain out of scope.
