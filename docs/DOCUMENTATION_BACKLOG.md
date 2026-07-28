# Documentation Backlog

Status: **In Progress**

## Implemented in the foundation lot

- primary engineering handbook;
- documentation taxonomy and navigation;
- canonical project-state matrix and roadmap;
- product vision, constitution and terminology;
- system layers and dependency rules;
- development, security and testing foundations;
- bounded-context catalog;
- ADRs for Clean Architecture, CQRS, outbox, idempotency, immutable snapshots, multi-tenancy,
  explainability and Composition Roots.

## Planned

- consolidate `docs/ARCHITECTURE.md` without changing frozen decisions;
- migrate each engine document into `docs/enterprise/` and add ownership/input/output tables;
- build a complete REST endpoint catalog and OpenAPI strategy;
- document business rules by bounded context;
- complete frontend navigation, layout, design-token and component inventories;
- add transaction, event, database and permission reference catalogs;
- create production deployment, backup/restore, incident and observability runbooks;
- normalize ADR 0001–0012 formatting without changing their decisions;
- automate documentation link and status validation in CI.
