# Solution Designer — AutomateX V2 Sprint 1

Solution Designer transforms one published V1 Recommendation into one abstract technical
Solution Blueprint. The engine reads published pattern, capability, connector, constraint and
validation catalogs. All MVP matrices and numerical indices are seed data, not constants in
application services.

The technical cost is a relative index without currency:

`unique capability costs + connector requirement costs + complexity × 0.5 + maximal risk cost`.

Complexity is calculated from catalog-provided factors and weights. Topology dependency cycles
are blocking. Notification, logging, monitoring and authentication observations are not execution
dependencies; the dependency edge types are frozen in the selected catalog version.

Lifecycle: `draft → validated → published → archived`. Rebuild always creates a new draft.
Published snapshots are immutable. Consultants, admins and owners generate/validate; admins and
owners publish; every member may read within their organization.

Routes:

- `POST /api/recommendations/:id/solution-blueprints`
- `POST /api/solution-blueprints/:id/rebuild`
- `POST /api/solution-blueprints/:id/validate`
- `POST /api/solution-blueprints/:id/publish`
- `GET /api/solution-blueprints/:id`
- `GET /api/companies/:id/solution-blueprints`

No platform, workflow, code generation or deployment capability belongs to this context.
