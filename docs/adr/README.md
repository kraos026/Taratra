# Architecture Decision Records

Status: **Implemented**

ADRs record decisions; they do not prove feature completion. Feature state is controlled by
[`PROJECT_STATE.md`](../PROJECT_STATE.md).

## Existing bounded-context decisions

ADRs 0001–0012 cover Discovery ownership, Supabase/Prisma/RLS, the independent engine chain,
Enterprise Knowledge and the V1/V2 bounded-context contracts through Solution Designer.

## Cross-cutting decisions

Current product direction: [ADR-0030 — Optivos platform, audit plugin and nodal boundary](0030-optivos-platform-and-nodal-boundary.md), requested 2026-10-16; target architecture, not a Production promotion.

| ADR                                                | Decision                  |
| -------------------------------------------------- | ------------------------- |
| [ADR-0013](0013-clean-architecture.md)             | Clean Architecture        |
| [ADR-0014](0014-cqrs-application-boundary.md)      | CQRS application boundary |
| [ADR-0015](0015-transactional-outbox.md)           | Transactional outbox      |
| [ADR-0016](0016-command-idempotency.md)            | Command idempotency       |
| [ADR-0017](0017-immutable-versioned-snapshots.md)  | Immutable snapshots       |
| [ADR-0018](0018-multi-tenancy-defense-in-depth.md) | Multi-tenant isolation    |
| [ADR-0019](0019-explainability-and-provenance.md)  | Explainability            |
| [ADR-0020](0020-explicit-composition-roots.md)     | Composition Roots         |

Planned: normalize formatting of ADRs 0001–0012 without changing their decisions.
