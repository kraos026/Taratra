# ADR-0025 — Brain Intelligence and Evidence Architecture

Status: Accepted — foundation contract

Date: 2026-08-13

## Context

AutomateX already contains a recovered advanced analysis chain from Company, Discovery, Interview,
Enterprise Knowledge, Process Mapping, Business Analysis, AI Opportunities, Automation
Opportunities, ROI, Recommendation Portfolio, Solution Blueprint, Automation Specification and
Executive Result.

Brain V2 does not replace that chain. It defines the reasoning substrate the existing modules can
progressively use to become more evidence-based, contradiction-aware, uncertainty-aware,
explainable and testable without depending on Vercel, Supabase Auth, PostgreSQL, browser UI or
HTTP.

## Decision

Brain V2 introduces canonical reasoning artifacts: `Evidence`, `Claim`, `Confidence`,
`Contradiction`, `UnknownInformation`, `ReasoningTrace` and `Decision`. These artifacts are
deterministic contracts first. Persistence, LLM orchestration, vector storage, UI and runtime
execution are out of scope for this ADR.

### Evidence

`Evidence` represents observed or supplied information only. It is never an inferred conclusion.
It contains:

- `evidenceId`;
- `sourceType`;
- `sourceReference`;
- `sourceModule`;
- `capturedAt`;
- `freshness`;
- `reliability`;
- `content`;
- optional `structuredValue`;
- `provenance`;
- tenant/company ownership boundary where relevant;
- optional tags/categories.

Allowed source types are intentionally generic: declared answers, observations, documents, metrics,
system records and interviews. A derived statement must become a `Claim`, not raw `Evidence`.

### Claim

`Claim` is a reasoning artifact derived from one or more Evidence items.

Kinds:

- `FACT`;
- `INFERENCE`;
- `HYPOTHESIS`;
- `UNKNOWN`.

Each claim contains `claimId`, `kind`, `statement`, `supportingEvidenceIds`,
`contradictingEvidenceIds`, `confidence`, `rationale`, `status`, `createdByModule`, `createdAt`
and `lastEvaluatedAt`.

`FACT` requires at least one supporting Evidence item. `UNKNOWN` is explicit information absence;
it is not equivalent to `null`, `false`, zero or an empty string.

### Confidence

Confidence is deterministic and reproducible. A free-form LLM number is never authoritative.

The canonical confidence model derives a normalized `0..1` score from explicit factors:

- number of supporting evidence items;
- average source reliability;
- source agreement;
- freshness;
- direct-vs-inferred evidence;
- contradiction penalty;
- missing-data penalty.

Every score must expose its factors and rationale. Modules may render confidence as labels, but the
canonical derivation remains numeric and explainable.

### Contradiction

Contradictions preserve both sides and are never silently resolved. They support:

- conflicting quantitative statements;
- conflicting qualitative statements;
- conflicting actor reports;
- stale-vs-current information;
- evidence-vs-assumption conflict.

Each contradiction records materiality, downstream impact and whether clarification is required.
Material contradictions block high-confidence downstream decisions until resolved or explicitly
accepted by a deterministic policy.

### Unknown / Missing Information

Unknown information is a first-class artifact containing:

- missing field or domain;
- reason unknown;
- impact;
- required-for references;
- priority;
- suggested clarification or evidence request.

Unknown remains distinguishable from false, zero, empty arrays and empty strings.

### Reasoning Trace

`ReasoningTrace` connects the chain:

Evidence → Claims → Findings → Opportunities → ROI assumptions → Decisions → Recommendations →
Blueprint → Automation Specification → Executive Result.

It must support:

- backward explanation: “Why was this recommendation produced?”;
- forward impact: “What decisions depend on this evidence?”.

Trace nodes are typed and edges record the relationship and rationale. Generated prose may
summarize the trace, but it cannot replace it.

### Decision

`Decision` is a canonical artifact with:

- `decisionId`;
- `subjectId`;
- `decisionType`;
- `rationale`;
- `supportingClaimIds`;
- `blockingUnknownIds`;
- risk references;
- `confidence`;
- `generatedByModule`.

Decision types are `RECOMMEND`, `REJECT`, `DEFER`, `HUMAN_ASSISTED` and
`NEED_MORE_EVIDENCE`.

### Finding, Opportunity, Decision and Recommendation

- A `Finding` describes what has been detected in the business state.
- An `Opportunity` describes a possible value-creating improvement area.
- A `Decision` records a deterministic judgment about a subject.
- A `Recommendation` is the selected advice/action proposal after eligibility, constraints,
  portfolio fit and rationale are evaluated.

Recommendation must not duplicate Opportunity. An Opportunity can exist without being recommended.

## Compatibility with the current engine

| Module                   | May consume                                             | May produce                             | Must not do                                               |
| ------------------------ | ------------------------------------------------------- | --------------------------------------- | --------------------------------------------------------- |
| Discovery                | User/company inputs                                     | Evidence, initial FACT claims           | Infer downstream automation decisions                     |
| Interview                | Discovery facts, user answers                           | Evidence, FACT/UNKNOWN claims           | Treat missing answers as false                            |
| Enterprise Knowledge     | validated Discovery/Interview/Work Intelligence sources | canonical Evidence references and facts | Silently merge contradictions                             |
| Work Intelligence        | process/activity observations                           | Evidence, FACT/HYPOTHESIS claims        | Rank employees or call Solution Designer directly         |
| Process Mapping          | ready Knowledge snapshots                               | Findings, Claims, trace links           | Read Discovery or Interview directly                      |
| Business Analysis        | published Process Maps                                  | Findings and Claims                     | Invent ROI assumptions                                    |
| AI Opportunities         | Business Analysis and evidence facts                    | Opportunities, HYPOTHESIS claims        | Turn LLM confidence into authoritative confidence         |
| Automation Opportunities | AI Opportunities and deterministic catalogs             | Opportunities, Decisions                | Recommend without feasibility gates                       |
| ROI                      | Opportunities and explicit assumptions                  | ROI assumptions, Decisions              | Hide assumptions or use unresolved contradictions as fact |
| Recommendations V2       | ROI, opportunities, constraints, trace                  | Recommendations and Decisions           | Duplicate Opportunity as Recommendation                   |
| Solution Blueprint       | published Recommendations                               | Blueprint trace links                   | Publish with unresolved mandatory gaps                    |
| Automation Specification | published Blueprint                                     | Specification trace links               | Read Recommendation/ROI directly                          |
| Executive Result         | published upstream artifacts                            | explanation views                       | Invent source evidence                                    |

## Deterministic and AI responsibilities

AI may interpret unstructured text, summarize, classify, suggest candidate hypotheses and draft
human-readable explanations.

Deterministic application/domain logic owns canonical scoring, confidence computation,
contradiction materiality, feasibility gates, ROI math, decision state, recommendation eligibility
and portfolio constraints. No hidden LLM judgment may become an irreversible business rule.

## Persistence boundary

No persistence is implemented by this ADR. Future persistence candidates are:

- Evidence;
- Claim;
- Contradiction;
- UnknownInformation;
- Decision;
- immutable trace snapshots consumed by canonical decisions.

Short-lived projections, intermediate derivations and presentation summaries may remain ephemeral
unless they become evidence for a canonical snapshot or are required for exact reproducibility.

## Versioning

Future persisted artifacts must include versions for:

- evidence schema;
- reasoning model;
- scoring model;
- evaluation fixtures.

Version changes must be explicit. A published decision keeps the exact versions used to produce it.

## Invariants

- No recommendation without a traceable rationale.
- No `FACT` without supporting Evidence.
- Contradictory Evidence cannot be silently discarded.
- `UNKNOWN` remains distinguishable from false, zero and empty values.
- Confidence is reproducible from explicit factors.
- ROI exposes assumptions.
- Recommendation eligibility is deterministic.
- Evidence stores observed or supplied information only.
- Material contradictions generate clarification requirements or block affected decisions.
- Brain V2 never bypasses existing bounded-context ownership.

## Consequences

Brain V2 can be tested independently from SaaS infrastructure. Existing modules can migrate toward
the canonical reasoning model incrementally without being rewritten. The first implementation
should focus on contracts, deterministic fixtures and invariant tests before adding persistence or
new production scoring engines.
