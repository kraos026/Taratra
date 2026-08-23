# AutomateX Agent Roadmap

Status: Future roadmap — documentation only
Implementation status: Not implemented

## 1. Roadmap principle

Agentic capabilities must arrive only after P0 certification and real pilot readiness are stable.
The roadmap is dependency-gated; no phase should start before the previous phase has proven
security, auditability and product value.

## 2. Phase roadmap

### P0 — Current certification only

Goal: finish current product certification.

Allowed:

- local/staging certification;
- auth/data/RLS validation;
- paying-pilot readiness checks;
- minimal blockers directly required by certification.

Forbidden:

- agent implementation;
- new agent persistence;
- model orchestration changes;
- DeepSeek Harness dependency;
- business engine refactor.

### P1 — Real pilots

Goal: run real customer pilots with existing AutomateX product flow.

Deliverables:

- stable onboarding/auth;
- company intake;
- evidence capture;
- audit to executive result;
- customer-facing reports;
- operational runbook.

Exit criteria:

- tenant isolation verified;
- no critical P0 security blockers;
- first pilot workflow completes without manual DB intervention.

### P2 — Harness Foundation, Audit Agent, Consultant Agent, read-only only

Goal: introduce read-only agent harness without mutation.

Dependencies:

1. P0 certification complete;
2. P1 pilot evidence available;
3. agent security model accepted;
4. event/checkpoint contract reviewed;
5. context redaction policy approved.

Allowed:

- read-only `AutomateXAgentHarness`;
- `AgentRuntime` skeleton;
- `AgentSession` and read-only event logging design;
- `AuditAgent` read-only guidance;
- `ConsultantAgent` read-only explanations;
- no R3+ tools.

Exit criteria:

- agents cannot mutate;
- all context is tenant-scoped and redacted;
- every run is auditable;
- model/provider failures fall back safely.

### P3 — Skills, Context Builder, Workflow Architect

Goal: make agent behavior methodical and context-efficient.

Dependencies:

1. P2 read-only auditability stable;
2. core skill package format accepted;
3. context builder redaction tests pass;
4. Brain/Evidence retrieval contract stable.

Allowed:

- `SkillRegistry`;
- exact-version skill loading;
- `ContextBuilder`;
- `WorkflowArchitectAgent` draft-only;
- optional industry skill prototypes as configuration.

Exit criteria:

- no full-Brain blind prompts;
- no fallback latest skill;
- no industry coupling in Domain Core;
- draft outputs are non-authoritative.

### P4 — Tool Registry, Approval Gateway, Connectors, Deployment Agent

Goal: introduce governed actions.

Dependencies:

1. P3 context and skills stable;
2. tool risk levels accepted;
3. approval UX and authorization model accepted;
4. credential resolver contract approved;
5. connector safety policy aligned with existing Runtime guardrails.

Allowed:

- `ToolRegistry`;
- `ToolPolicyEngine`;
- `ApprovalGateway`;
- `CredentialResolver`;
- read/write tools behind policy;
- `DeploymentAgent` with strict approval boundaries.

Exit criteria:

- R3+ actions are audited and policy-gated;
- R4/R5 actions require explicit approval;
- credentials are never model-visible;
- live actions are idempotent or explicitly guarded.

### P5 — Monitoring, Outcomes, Optimization

Goal: close the loop from recommendations to measured outcomes.

Dependencies:

1. P4 action auditability stable;
2. outcome evidence model accepted;
3. monitoring data privacy policy accepted.

Allowed:

- `MonitoringAgent`;
- `OptimizationAgent`;
- outcome ingestion;
- anomaly summaries;
- improvement candidates.

Exit criteria:

- no automatic rule/prompt self-modification;
- recommendations are updated only through approved deterministic pathways;
- optimization preserves evidence and uncertainty.

### P6 — Controlled multi-agent orchestration

Goal: coordinate specialized agents safely.

Dependencies:

1. P2-P5 single-agent safety proven;
2. subagent context isolation proven;
3. multi-agent event ordering and checkpointing accepted;
4. escalation/approval semantics stable.

Allowed:

- `SubagentRouter`;
- bounded delegation;
- `OlympusAgent` executive orchestration;
- multi-agent checkpointing;
- conflict and outcome reconciliation.

Exit criteria:

- no cross-tenant or cross-company leakage;
- no agent approves another agent's sensitive action without human approval;
- subagent outputs remain non-authoritative until consumed by deterministic engines or approved workflows.

## 3. Exact future implementation dependency order

1. Complete P0 certification.
2. Complete P1 real pilot baseline.
3. Freeze agent security policy and risk-level definitions.
4. Define read-only `AgentSession`, `AgentRun`, `AgentEvent` contracts.
5. Implement append-only read-only event logging.
6. Implement `ContextBuilder` in read-only mode with redaction tests.
7. Implement provider-neutral `ModelRouter`.
8. Implement `AuditAgent` read-only.
9. Implement `ConsultantAgent` read-only.
10. Implement `SkillRegistry` with exact-version loading.
11. Add core skills, then optional industry skills.
12. Implement draft-only `WorkflowArchitectAgent`.
13. Implement `ToolRegistry`.
14. Implement `ToolPolicyEngine`.
15. Implement `ApprovalGateway`.
16. Implement `CredentialResolver`.
17. Introduce R3 internal mutation tools.
18. Introduce R4 external action tools only after approval UX is certified.
19. Implement `DeploymentAgent`.
20. Implement outcomes and `MonitoringAgent`.
21. Implement `OptimizationAgent`.
22. Implement `SubagentRouter`.
23. Implement `OlympusAgent`.
24. Certify controlled multi-agent orchestration.

## 4. Current AutomateX conflicts

No blocking architecture conflict was found. Deferred items before implementation:

- exact agent persistence schema;
- approval UX and role model;
- model invocation retention policy;
- skill compatibility/version migration;
- sandbox provider selection;
- connector-side effect policies.

## 5. Non-goals

This roadmap does not implement P2-P6 and does not alter current P0 certification scope.
