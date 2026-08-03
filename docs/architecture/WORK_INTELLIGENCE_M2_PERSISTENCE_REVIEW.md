# Work Intelligence M2 — Persistence and Enterprise Knowledge Projection Review

Status: **SAFE CHECKPOINT — ARCHITECTURE CONTRACT REQUIRED**  
Baseline: `f39aef42f3c3629e37e6e6cd563e68578983f2c7`  
Date: 2026-08-03

## Decision

Implementation must stop before migration. ADR-0029 explicitly defers PostgreSQL/RLS persistence
until an operational retention contract is approved. No later repository authority defines that
contract. Implementing durable operational evidence now would contradict the accepted ADR and the
mission's retention stop condition.

Two additional contracts must be resolved before implementation:

1. Work Activity identifiers are validated only as non-empty strings, while
   `knowledge_sources.source_id` and `knowledge_evidence.source_record_id` require UUIDs. Exact
   relational provenance cannot be guaranteed without defining durable UUID identity semantics.
2. Enterprise Knowledge currently accepts only `discovery` and `interview` in its Domain
   projection types. Adding Work Intelligence requires an explicit typed-source and evidence
   contract; using textual provenance or reusing another source type would corrupt semantics.

No migration, Prisma model, repository adapter, projector, or production code is introduced by
this review.

## Review answers

### 1. What must be persisted?

Once the blocking contracts are approved, the minimum source of truth is:

- every confirmed or corrected `WorkActivity` version;
- its stable tenant, company, lineage, version, confirmation state and supersession link;
- the original evidence and normalized representation;
- typed capture and human-confirmation provenance;
- confirmation/correction timestamps and actor references, subject to privacy policy.

Pending or rejected captures must not become canonical Knowledge. Derived patterns, hypotheses,
candidates and time-savings estimates do not need to be primary write models.

### 2. Source of truth versus derived artifacts

| Artifact                                   | Classification                 | Minimum persistence decision                                       |
| ------------------------------------------ | ------------------------------ | ------------------------------------------------------------------ |
| Confirmed/corrected Work Activity versions | Source of truth                | Durable, immutable versions                                        |
| Confirmation/correction history            | Source of truth                | Durable and linked to exact versions                               |
| Work Pattern                               | Deterministic derived analysis | Recompute by default; snapshot only when projected                 |
| Work Automation Hypothesis                 | Derived analysis               | Recompute; not canonical Knowledge by itself                       |
| Automation Candidate                       | Derived qualification          | Recompute; never becomes Automation Opportunity directly           |
| Time Savings Estimate                      | Derived analysis evidence      | Snapshot only if a Knowledge fact consumes it; never financial ROI |

An Enterprise Knowledge snapshot already freezes any selected derived output needed for exact
downstream reproducibility.

### 3. When does a Work Activity become durable?

The Domain currently creates `PENDING` captures and creates a new version for confirmation or
correction. The intended durable boundary is confirmation or correction, not raw capture. Whether
pending captures may be stored temporarily cannot be decided until the retention/privacy contract
defines purpose, access and deletion semantics.

### 4. Human corrections

Corrections are append-only versions in the same lineage. A corrected version references the
previous activity through `supersedesActivityId`; the previous version remains immutable. The
current authoritative version is the highest valid confirmed/corrected version in that lineage.
The database must enforce unique `(organization_id, lineage_id, version)` and tenant-consistent
supersession once persistence is authorized.

### 5. Provenance

Required typed lineage is:

`KnowledgeEvidence → KnowledgeSource(work_intelligence) → exact WorkActivity version`.

For a derived pattern it is:

`KnowledgeEvidence → projected WorkPattern → exact confirmed/corrected WorkActivity versions`.

Existing free-form `provenance: string[]` is useful explanatory metadata but is not sufficient as
the relational source of truth. No fake UUID or textual substitute is acceptable.

### 6. Potentially sensitive data

Potentially sensitive fields include actor role, free-text descriptions, timestamps, department,
tools, recurrence hints and arbitrary metadata. The system must not persist employee identity,
productivity ranking, disciplinary inference, hidden-monitoring data or secrets. Metadata needs a
persistence-safe allowlist/redaction contract before production storage.

### 7. Retention and deletion

The repository has no approved operational retention authority. ADR-0029 explicitly makes its
approval a prerequisite. Therefore:

- no arbitrary retention period is selected;
- historical versions cannot yet be assigned deletion or archival behavior;
- tenant deletion may continue to use established organization cascades only after the evidence
  retention contract decides whether legal/audit holds apply;
- configurable retention is a possible implementation mechanism, but its ownership, defaults and
  permitted ranges require approval first.

### 8. Tenant isolation

The future persistence must carry `organization_id` on every table, use tenant-qualified composite
foreign keys, enable RLS, deny anonymous access, and authorize authenticated reads/writes through
existing organization-role helpers. Repository queries must also filter by organization as defense
in depth. Projection must validate that company, activities, sources and target snapshot all belong
to the same tenant.

### 9. Can Enterprise Knowledge accept the source without fabricated facts?

Conceptually yes: its immutable snapshot/source/fact/evidence model can represent observed work.
The current implementation cannot yet do so because its Domain source union is limited to
Discovery/Interview and its service requires validated Discovery input. A minimal approved
extension can add Work Intelligence as a typed source and project only confirmed/corrected evidence
that actually exists. It must not infer missing process, tool, actor or automation facts.

### 10. Can existing provenance represent Work Intelligence origins?

The database shape can represent exact origins once Work Activity records have durable UUIDs and a
typed source/evidence value is added. The current TypeScript contract cannot: it permits only
`discovery | interview` sources and only `validated_entity | validated_answer` evidence. Reusing
either value would be semantically false.

## Required minimal contract decisions

Before implementation, approve only these decisions:

1. **Retention and privacy:** owner, configurable policy semantics, deletion/archival behavior,
   legal hold behavior, and a persistence-safe metadata allowlist.
2. **Durable identity:** UUID contract for Work Activity, lineage and supersession references,
   including compatibility with existing in-memory/test identifiers.
3. **Knowledge source vocabulary:** exact `KnowledgeSourceType` and evidence type for Work
   Intelligence, plus whether a Knowledge snapshot may combine Discovery, Interview and Work
   Intelligence sources in one version.
4. **Projection trigger:** authorized actor/use case that creates a new Knowledge snapshot and the
   rule for selecting authoritative activity versions.
5. **Derived reproducibility:** confirm that patterns are recomputed and become durable only as
   immutable Knowledge snapshot facts with their rule version and complete activity lineage.

## Readiness against acceptance scenarios

| Scenario                       | Current result | Reason                                                   |
| ------------------------------ | -------------- | -------------------------------------------------------- |
| Confirmed activity → Knowledge | BLOCKED        | No approved persistence/typed source contract            |
| Unconfirmed activity blocked   | Domain-ready   | Pattern engine already excludes pending evidence         |
| Human correction lineage       | Domain-ready   | Version and supersession exist; DB constraints absent    |
| Exact provenance               | BLOCKED        | Work Activity identity is not contractually UUID         |
| Tenant isolation               | BLOCKED        | No Work Intelligence persistence/RLS exists              |
| Derived pattern                | Domain-ready   | Deterministic pattern exists; projection contract absent |
| No fake financial ROI          | PASS           | Only `TimeSavingsEstimate` is allowed                    |
| Multi-sector/sector agnostic   | PASS           | Core uses generic work concepts and fixtures             |

## Invariants preserved

- No employee productivity scoring.
- No direct Work Intelligence → Solution Designer dependency.
- No direct Work Intelligence → Automation Specification dependency.
- No direct Work Intelligence → Runtime dependency.
- No parallel Knowledge engine.
- No fabricated fact, identifier or provenance reference.

## Final decision

**SAFE CHECKPOINT — ARCHITECTURE CONTRACT REQUIRED**

Approve the five minimal contract decisions above before creating any Work Intelligence migration
or production adapter.
