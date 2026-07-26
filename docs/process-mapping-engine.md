# Business Process Intelligence — Process Mapping

Process Mapping consumes only immutable Enterprise Knowledge snapshots with status `ready`. It
never reads Discovery or Interview. The engine deterministically selects versioned process
patterns, reconstructs directed graphs and persists explainable, versioned process maps.

## Patterns and provenance

`process_patterns` contains code, version, lifecycle, industry scope, weighted required and
optional facts, a graph template and validation rules. Five system patterns cover invoice
processing, recruitment, customer support, stock management and order processing.

Every map freezes its knowledge snapshot, pattern id/version, graph, validations, scores and
provenance. `process_map_fact_usage` records every consumed fact and every ignored fact with its
reason and importance weight. Rebuild always creates a new draft linked through
`previous_version_id`; it never modifies an existing version.

## Scores and validation

Completeness weights start 15%, end 15%, connectivity 20%, ownership 15%, actors 10%, systems 10%,
inputs/outputs 10% and documentation 5%. Coverage uses only facts relevant to the selected pattern;
no relevant fact means 0%. Confidence is weighted by the pattern importance of each consumed fact.

Validation severities are error, warning and information. Missing start/end, disconnected
activities, missing owners and missing actors are errors. Cycles, duplicate activities and missing
systems are warnings. Business Intelligence readiness requires no error, completeness >= 80%,
confidence >= 80% and coverage >= 70%.

## Lifecycle and API

Maps follow `draft → validated → published → archived`. Consultants may build, rebuild and
validate. Owners/admins publish. Viewers read. Published versions and all child graph/provenance
records are immutable. Mutations use `lock_version` and stale requests return HTTP 409.

- `POST /api/knowledge-snapshots/:id/process-maps`
- `GET /api/companies/:id/process-maps`
- `GET /api/process-maps/:id`
- `POST /api/process-maps/:id/rebuild`
- `POST /api/process-maps/:id/validate`
- `POST /api/process-maps/:id/publish`
- `/companies/:id/process-maps`
- `/process-maps/:id`
