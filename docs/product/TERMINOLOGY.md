# Terminology

Status: **Implemented**

| Term               | Meaning                                                                      |
| ------------------ | ---------------------------------------------------------------------------- |
| Bounded context    | autonomous domain boundary with owned language, behavior and persistence     |
| Snapshot           | immutable representation of a domain result at a specific version            |
| Lineage            | ordered identity connecting versions of the same conceptual output           |
| Rebuild            | creation or regeneration governed by the context's explicit version rules    |
| Catalog            | versioned configurable business decisions consumed by a deterministic engine |
| Provenance         | trace from an output element to consumed sources, evidence and rules         |
| Explainability     | ability to state why an output exists and which inputs contributed           |
| RLS                | PostgreSQL Row Level Security                                                |
| Optimistic locking | stale-write protection using `lock_version`                                  |
| Composition Root   | wiring layer that constructs providers and use cases without behavior        |
| Canonical graph    | provider-independent automation graph; not a deployable platform workflow    |
| Published          | immutable and eligible for downstream consumption                            |
