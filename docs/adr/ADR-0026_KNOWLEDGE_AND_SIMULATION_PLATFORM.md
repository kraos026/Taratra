# ADR-0026 — Knowledge, AI Interpretation and Simulation Lab Architecture

Status: Proposed architecture contract  
Date: 2026-08-13  
Scope: Brain V2 and future evaluation capabilities

## Context

Brain V2 (B2.1–B2.4) provides deterministic evidence, claims, uncertainty,
adaptive discovery and process/causal reasoning contracts. This ADR reserves
the boundaries required to turn those contracts into a governed Knowledge
Platform and a reproducible simulation laboratory. It does not implement any
of the modules below and does not alter production Brain, Work Intelligence,
Process Mapping, Runtime, Graph Compiler, UX, Supabase or persistence.

## 1. Canonical architecture

Real customer flow:

```text
REAL COMPANY INPUTS
  → AI INTERPRETATION (candidates only)
  → COMPANY EVIDENCE
  → BRAIN V2
  → KNOWLEDGE CONTEXT
  → DECISION / ECONOMIC INTELLIGENCE
  → CUSTOMER SIMULATION
  → RECOMMENDATION / BLUEPRINT
```

Independent evaluation flow:

```text
SYNTHETIC ENTERPRISE GENERATOR
  → HIDDEN GROUND TRUTH
  → SIMULATED ACTORS / SYSTEMS / DOCUMENTS / EVENTS
  → AUTOMATEX BRAIN
  → BRAIN EVALUATOR
  → FAILURE ANALYSIS
  → IMPROVEMENT CANDIDATE
  → REVIEW / VALIDATION
  → VERSIONED KNOWLEDGE OR RULE UPDATE
```

The customer simulation domain and the Brain-training simulation domain are
separate. They may share deterministic contracts, never hidden truth or
authority boundaries.

## 2. Knowledge Platform

The future `KnowledgeLibrary`, `KnowledgeMatcher` and `RetrievalEngine` will
organize versioned, tenant-scoped knowledge and preserve provenance. External
knowledge, customer evidence and simulation-derived knowledge must remain
distinctly labelled. A simulation result cannot become Company Evidence by
implicit conversion.

## 3. AI Interpretation Gateway

`AIInterpretationGateway` is a future adapter boundary. It may extract
candidate facts, summarize interviews, classify documents, suggest process
steps or hypotheses, map terminology and generate synthetic content. Its
output is non-authoritative candidate data requiring validation and provenance.

It cannot decide confidence, contradiction materiality, ROI, recommendation
eligibility, decision state or safety gates. No provider, model, prompt,
vector database or external API is selected by this ADR.

## 4. CustomerSimulationEngine (future)

The engine will simulate consequences of a proposed transformation using
company evidence, process/economic models, solution candidates, constraints,
uncertainty and knowledge priors. Its versioned output may contain baseline,
proposed, pessimistic, base, optimistic and stress scenarios; sensitivity;
operational, financial, capacity and risk impacts.

Scenarios may vary volume, adoption, implementation cost, failure rate,
human validation, absence, seasonality, error reduction and API cost. The
engine remains deterministic where inputs and seed/policy versions are fixed.

## 5. Synthetic Enterprise Simulation Lab

Future modules are `SyntheticEnterpriseGenerator`, `ActorSimulator`,
`SystemSimulator`, `IncidentSimulator`, `GroundTruth` and
`LongitudinalSimulator`. A generated enterprise includes sector and size,
departments, roles, systems, processes, metrics, constraints, incidents,
hidden causes, dependencies, controls and failure modes.

The generator creates a hidden GroundTruth model containing true metrics,
actual process structure, causes, dependencies, failure probabilities,
controls, economically optimal choices and forbidden actions. GroundTruth is
never included in the Brain input or exposed through ordinary evidence.

Simulated actors may have partial, stale, biased or incorrect knowledge and
role-scoped visibility. Simulated systems may emit metrics, logs, counts,
failures, latency, availability, capability and data-quality signals. Incidents
include absence, outage, cost/volume changes, corruption, approval delay,
turnover, regulation, security and supplier failure. A deterministic seed and
simulator version are mandatory for reproducibility.

Longitudinal simulation evaluates multiple periods and retains period,
scenario, seed and version identity so changes can be compared without
rewriting history.

## 6. BrainEvaluator and scorecard

`BrainEvaluator` compares Brain outputs with GroundTruth through a decomposable
versioned scorecard. Minimum dimensions are:

- evidence discipline;
- contradiction and unknown handling;
- root-cause and bottleneck accuracy;
- opportunity precision and recall;
- unnecessary automation and missed-critical-issue rates;
- ROI error;
- risk detection and decision quality;
- traceability;
- overconfidence and unsupported-claim rate.

There is no opaque single “AI quality” score. Deterministic assertions remain
authoritative for numeric correctness, expected decisions, ROI mathematics,
hidden causes, forbidden recommendations and evidence traces. An optional AI
judge may assess semantic equivalence, explanation quality or language
completeness only as a supplementary, non-authoritative signal.

## 7. Learning and improvement pipeline

Simulation output may create versioned `SimulationOutcome`, `FailureAnalysis`,
`ImprovementCandidate`, `KnowledgeCandidate`, `RuleCandidate` and
`TestCandidate` artifacts. Their lifecycle is:

```text
GENERATED → REVIEWED → VALIDATED → ACCEPTED → VERSIONED
                         └──────────────→ REJECTED
```

No candidate automatically updates production rules, knowledge or Brain
behaviour. Repeated outcomes may produce a `CandidatePattern` only after a
declared evidence count, source/scenario diversity, validation and versioning.
Simulation-derived knowledge remains distinguishable from external knowledge
and cannot be presented as a real-world benchmark without explicit curation.

## 8. Version comparison and CI (future)

`BrainVersionEvaluation` compares Brain versions against identical seeded
simulation suites. Regression gates must detect worse root-cause accuracy,
higher false-recommendation or overconfidence rates, weaker contradiction
handling and increased ROI error. A future CI pipeline may expose
`brain:test`, `simulation:test` and `adversarial:test`; no CI integration is
implemented by this ADR.

## 9. Reserved module boundaries

The following names are reserved interfaces/modules only:

`KnowledgeLibrary`, `KnowledgeMatcher`, `RetrievalEngine`,
`AIInterpretationGateway`, `CustomerSimulationEngine`,
`SyntheticEnterpriseGenerator`, `ActorSimulator`, `SystemSimulator`,
`IncidentSimulator`, `GroundTruth`, `BrainEvaluator`, `SimulationScorecard`,
`ImprovementPipeline`, `LongitudinalSimulator`.

Each must depend on explicit contracts and must not bypass Brain evidence,
provenance, uncertainty or decision guards.

## 10. Safety invariants

1. GroundTruth is never exposed to the Brain under evaluation.
2. Simulation knowledge never silently becomes Company Evidence.
3. Synthetic data is always labelled synthetic.
4. AI-generated content is never trusted automatically.
5. Same seed plus simulator version yields the same structured scenario.
6. Production rules are never self-modified from simulation output.
7. Regression scores are immutable and versioned.
8. Simulation benchmarks cannot be represented as real-world benchmarks.
9. Human or curated validation is required before production knowledge entry.
10. Customer simulation and Brain-training simulation remain separate domains.
11. Tenant, provenance and evidence boundaries remain mandatory.

## 11. Consequences and non-goals

This architecture enables repeatable evaluation, controlled learning and
future what-if analysis while preserving explainability and safety. It adds
governance overhead, version management and fixture maintenance; it does not
promise causal truth from simulation or correlation.

This ADR does **not** add an LLM provider, external AI calls, agents, RAG,
vector storage, simulation runtime, database migrations, Supabase/Vercel/RLS
changes, Runtime or Graph Compiler changes, UX, connectors or production
Brain changes.

## Decision

Adopt the boundaries and invariants above as the architecture contract for
future Knowledge Platform, AI Interpretation and Simulation Lab work. Any
implementation must be proposed in a later scoped mission and must preserve
ADR-0025 contracts.
