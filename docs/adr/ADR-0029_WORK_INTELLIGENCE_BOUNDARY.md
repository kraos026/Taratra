# ADR-0029 — Work Intelligence bounded context

Status: Accepted — M2 persistence contract ready

Date: 2026-08-02

Contract resolution: 2026-08-03

## Context

Audit V1 captures declared company knowledge in versioned sessions and snapshots. Continuous work
observations have a different lifecycle: append-only capture, human correction, longitudinal
patterns and qualification before any hand-off to V2. Putting this lifecycle inside Audit would
couple stable audit snapshots to an ongoing observation stream.

The initial decision deferred PostgreSQL/RLS persistence until retention, durable identity,
Enterprise Knowledge provenance and projection authorization were explicit. This ADR now freezes
those contracts without implementing persistence.

## Bounded-context decision

`work-intelligence` remains independent. It references tenant, company, process, department,
persona, tool and audit evidence by identifiers; it does not import or mutate their aggregates.

The evidence stages are explicit and irreversible in meaning:

1. **Declared work** — what an audit or human states normally happens.
2. **Observed work** — a persistence-safe activity explicitly captured or imported.
3. **Inferred pattern** — deterministic aggregation of confirmed observations only.
4. **Work automation hypothesis** — an explainable hypothesis, distinct from the canonical V1
   Automation Opportunity and never an executable automation.
5. **Automation candidate** — a qualified, traceable hypothesis intended for projection into
   Enterprise Knowledge, not for direct solution design or specification.

Enterprise Knowledge is the convergence boundary for Audit and Work Intelligence. Canonical ROI is
the economic-evaluation authority, Recommendation is the business-decision authority, and Solution
Designer is the future-state design authority. Work Intelligence never calls Solution Designer,
Automation Specification, Graph Compiler or Runtime directly.

Work Intelligence may produce only a `TimeSavingsEstimate`, never financial ROI. It may propose an
automation-governance signal, but Recommendation remains the future canonical authority. Observed
process ordering describes current work only; capabilities, connectors, future triggers and future
steps belong downstream to Solution Designer. Normalization knowledge is injected as versioned
configuration; the Domain Core contains no industry, profession, vendor or application taxonomy.

## Durable identity

Persistence uses immutable Value Objects following the repository UUID conventions:

- `WorkActivityId`: globally unique UUID identifying one immutable activity version;
- `WorkActivityLineageId`: globally unique UUID shared by all versions of one activity lineage;
- `WorkActivityVersion`: positive integer, unique with tenant and lineage;
- `supersedesActivityId`: nullable `WorkActivityId` referencing the immediately preceding version.

The exact durable identity is `WorkActivityId`; `(tenantId, lineageId, version)` is an additional
unique lineage coordinate. Tenant, company, lineage, version and supersession cannot change after
append. A supersession reference must resolve within the same tenant, company and lineage and must
target the immediately preceding version.

The current arbitrary string identifiers are a controlled breaking change for Work Intelligence
callers and fixtures. The implementation must replace them with runtime-validated UUID Value
Objects before adding persistence. The Application identity provider creates IDs before repository
write. Enterprise Knowledge never creates, substitutes or derives an activity identifier.

## Work Activity lifecycle and authority

Application-controlled capture appends a `PENDING` activity version. It is durable operational
evidence but is never canonical Enterprise Knowledge. Confirmation and correction append new
versions; no version is overwritten:

| State       | Durable                         | Projectable                     | Meaning                                           |
| ----------- | ------------------------------- | ------------------------------- | ------------------------------------------------- |
| `PENDING`   | Yes, under its retention policy | No                              | Captured but not human-authoritative              |
| `CONFIRMED` | Yes                             | Yes when current in its lineage | Human-confirmed evidence                          |
| `CORRECTED` | Yes                             | Yes when current in its lineage | Human-corrected authoritative evidence            |
| `REJECTED`  | Yes, under its retention policy | No                              | Rejected evidence retained only for audit/history |

A correction creates the next version and supersedes the prior current version. The authoritative
activity is the latest `CONFIRMED` or `CORRECTED` version not superseded by a later version.
Superseded evidence remains historical and is never selected as current input. A confirmation or
correction records the authenticated actor and timestamp in typed audit/history data; these fields
are not promoted to business facts.

## Configurable retention contract

Retention is owned at tenant level by a versioned
`WorkIntelligenceRetentionPolicyReference(policyId, version)`. The reference is captured with every
durable activity version. Durations and disposition are configuration resolved through an
Application port; they are not Work Intelligence Domain constants.

An immutable policy version defines independently for pending/rejected, confirmed/current and
superseded evidence:

- retention mode: finite duration or indefinite;
- duration value when finite;
- disposition at expiry: anonymize or delete when safe;
- metadata sanitization policy version.

No default number of days is imposed by the Domain. Policies such as 30 days, one year or
indefinite can be configured without changing Domain behavior. Changing tenant policy creates a new
policy version and does not rewrite the policy reference attached to existing evidence.

Expiry is enforced by an authorized Application operation, never by a Domain side effect. The
operation is tenant-scoped, idempotent and audited. Its rules are:

1. evidence referenced by an immutable ready Knowledge snapshot cannot be physically deleted;
2. anonymization may remove free text, person-related audit details and non-allowlisted metadata,
   but must retain the minimum UUID lineage, tenant/company scope, version, state and referential
   provenance required by that snapshot;
3. physical deletion is allowed only when the policy permits it and no immutable canonical
   snapshot or protected lineage references the record;
4. tenant deletion follows the platform organization lifecycle only when the same reference checks
   permit it.

The current platform has no approved legal-hold or exceptional-retention contract. Therefore no
administrator can silently bypass the selected policy. A future legal/admin override requires its
own authorized, audited platform contract and a new immutable policy version; it is not inferred by
this ADR.

## Enterprise Knowledge source and provenance

The canonical `KnowledgeSourceType` gains the repository-style value `work_intelligence`. It is an
extension of Enterprise Knowledge, not a parallel Knowledge system.

For an authoritative activity projection:

- `KnowledgeSource.sourceType = work_intelligence`;
- `KnowledgeSource.sourceId = WorkActivityLineageId`;
- `KnowledgeSource.sourceVersion = WorkActivityVersion`;
- `KnowledgeEvidence.sourceRecordType = work_activity_version`;
- `KnowledgeEvidence.sourceRecordId = WorkActivityId`;
- `KnowledgeEvidence.evidenceType = confirmed_work_activity` or
  `corrected_work_activity` according to the exact source version.

For a derived pattern, the Knowledge fact has one typed evidence record for every contributing
authoritative activity version. Its safe metadata records the deterministic pattern policy/version
and pattern identifier. Free-text provenance may supplement these references but never replace
them.

A new ready Knowledge snapshot may combine validated Discovery, validated Interview and confirmed
Work Intelligence sources. Each source retains its own type and exact version. Contradictory facts
are not silently merged. Because Enterprise Knowledge has no approved conflict-resolution rule,
any fact-key collision with incompatible values fails projection and requires an authorized source
correction before a new attempt.

## Projection authorization

Projection is an explicit Enterprise Knowledge Application use case named
`ProjectConfirmedWorkIntelligenceToKnowledge`. Enterprise Knowledge owns the use case and consumes
Work Intelligence through a read port; Work Intelligence never writes into Knowledge.

The use case requires:

- an authenticated `owner`, `admin` or `consultant`, matching the existing Knowledge build roles;
- an active membership in the target tenant;
- a company belonging to that tenant;
- an exact `WorkIntelligenceRetentionPolicyReference` resolvable for that tenant;
- only current `CONFIRMED` or `CORRECTED` activity versions;
- a single authenticated transaction and the existing immutable Knowledge snapshot lifecycle.

`PENDING`, `REJECTED`, unconfirmed inferred data and cross-tenant evidence are rejected before any
snapshot write. Projection creates a new `building` Knowledge snapshot, persists typed facts and
evidence, then transitions it to `ready`. Correction never mutates an older ready snapshot: a new
snapshot selects the corrected authoritative version while older snapshots preserve their exact
historical lineage.

No capture, confirmation, correction, pattern analysis or Domain event automatically triggers
projection.

## Derived artifact persistence

Work Activity versions and their human confirmation/correction history are the durable source of
truth. The default for derived artifacts is recomputation:

- `WorkPattern`: recomputed from exact authoritative versions and a versioned pattern policy;
- `WorkAutomationHypothesis`: recomputed and not a canonical Knowledge decision;
- `AutomationCandidate`: recomputed and never converted directly into Automation Opportunity;
- `TimeSavingsEstimate`: recomputed analysis evidence and never financial ROI.

No standalone production table is created for these artifacts merely because they exist. A derived
artifact is frozen only inside a canonical immutable snapshot when that snapshot consumes it and
exact reproducibility requires its value. The snapshot must then retain the derivation policy
version and typed references to every source activity version. Hypotheses and candidates remain
outside canonical Knowledge until a later approved contract explicitly consumes them.

## Privacy and tenant invariants

- Work Intelligence measures processes and activities, never employee productivity or rank.
- No productivity, disciplinary, hidden-monitoring or person-comparison score is permitted.
- Actor role may describe process responsibility; personal identity is restricted to authorized
  audit/history fields and is never projected as a business fact.
- Persisted metadata is purpose-limited and validated against a versioned allowlist. Unknown,
  secret, credential, message-content or person-sensitive fields are rejected or sanitized before
  persistence.
- Original descriptions are sensitive operational evidence and follow the referenced retention
  policy; derived normalized facts contain only the minimum required content.
- Every record is tenant-owned. Future persistence must combine authenticated context, repository
  tenant filters, tenant-qualified composite constraints and PostgreSQL RLS under ADR-0018.
- Human corrections, anonymization and retention enforcement are traceable and audited.
- Ready Knowledge snapshots and their evidence remain immutable under ADR-0017.

## Consequences

- M2 persistence may now be designed without inventing retention values, identifiers or provenance.
- Implementing durable UUID Value Objects is a controlled Work Intelligence breaking change.
- The future migration must add the typed Knowledge source/evidence values and Work Intelligence
  tenant tables together with RLS, composite integrity and pgTAP coverage.
- Existing Work Intelligence in-memory fixtures using arbitrary identifiers must migrate to UUIDs.
- Derived-storage growth is limited because only source evidence and consumed snapshot derivations
  are durable.
- No SQL, Prisma adapter, projector implementation, UI, AI, connector or downstream engine change
  is part of this contract resolution.
