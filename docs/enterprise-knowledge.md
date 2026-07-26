# Enterprise Knowledge

Enterprise Knowledge is an internal bounded context between data-collection engines and future
intelligence engines. It does not replace Discovery or Interview and is not exposed through UI or
a public REST API.

## Input and output

The internal projection service accepts the latest validated Discovery and, when available, the
latest validated Interview for one company. It emits a new immutable, versioned snapshot:

- `knowledge_sources` identifies exact source sessions and versions;
- `knowledge_nodes` represents typed company, department, role, software, and process concepts;
- `knowledge_facts` stores normalized typed values;
- `knowledge_relationships` connects nodes;
- `knowledge_evidence` links every fact to a source and source record.

Nodes referencing existing Discovery entities retain `canonical_entity_type` and
`canonical_entity_id`. Facts are a derived projection, not an alternative write model. Enterprise
Knowledge never updates Discovery or Interview.

## Confidence and provenance

Validated Discovery entities project at 100% confidence. Confirmed or validated Interview answers
project at 100%; uncertain answers project at 50%; missing answers do not become facts. Confidence
belongs to each knowledge fact and evidence record independently from the source engine.

Sources already model future connectors, manual validation, and AI inference. These source types
are reserved contracts only; no connector, manual workflow, or inference behavior is implemented.

## Versioning and immutability

Snapshots are serialized per organization/company with a PostgreSQL advisory transaction lock.
Each successful build increments the version and transitions `building → ready`. Ready snapshots
and their child records are immutable. New source data creates a new snapshot rather than mutating
history.

## Consumption

No current engine consumes Enterprise Knowledge. Sprint 6 Process Mapping and subsequent engines
will receive a dedicated read port over ready snapshots. Adding that consumer contract is deferred
until each engine specification is approved.
