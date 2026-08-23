# AutomateX Agent Security Model

Status: Future security blueprint — documentation only
Implementation status: Not implemented

## 1. Security objective

AutomateX agents must improve audit and decision workflows without weakening tenant isolation,
evidence authority, human control, RLS or external-action safety. Agents are treated as
non-authoritative assistants operating under application authorization and explicit tool policy.

## 2. Trust boundaries

| Boundary                  | Trusted for                            | Not trusted for                              |
| ------------------------- | -------------------------------------- | -------------------------------------------- |
| Supabase Auth             | authenticated user identity            | business authorization by itself             |
| PostgreSQL/RLS            | tenant-scoped persistence enforcement  | prompt-level reasoning                       |
| Application authorization | roles, memberships, action permissions | model behavior                               |
| Evidence/Brain            | structured business context and trace  | secrets or raw credentials                   |
| AgentRuntime              | orchestration and audit flow           | business truth                               |
| Model provider            | language/reasoning assistance          | authoritative decisions, credentials, policy |
| Tool adapters             | bounded capability execution           | deciding whether action is allowed           |

## 3. Tool risk levels

| Level | Name                               | Examples                                                               | Default behavior                              | Approval behavior                                         |
| ----- | ---------------------------------- | ---------------------------------------------------------------------- | --------------------------------------------- | --------------------------------------------------------- |
| R0    | READ                               | read published audit, read Brain trace, read company metadata          | Allowed if user has read permission           | No approval unless sensitive data scope requires it       |
| R1    | ANALYZE                            | summarize evidence, compare opportunities, detect missing info         | Allowed if input is authorized and redacted   | No approval; output must be non-authoritative             |
| R2    | DRAFT                              | draft question, draft recommendation explanation, draft blueprint text | Allowed with audit logging                    | Human review before customer-facing publication           |
| R3    | MUTATE                             | create evidence request, update draft artifact, write internal note    | Requires policy check and role permission     | Approval required when consequential or persistent        |
| R4    | EXTERNAL ACTION                    | call connector, send email, deploy workflow dry-to-live boundary       | Denied unless tool policy allows exact action | Explicit human approval required                          |
| R5    | DESTRUCTIVE / FINANCIAL / SECURITY | delete data, spend money, change permissions, security config          | Denied by default                             | High-assurance approval; may require multi-party approval |

## 4. Policy outcomes

Every tool request resolves to one of:

- `ALLOW`;
- `DENY`;
- `REQUIRE_APPROVAL`;
- `REQUIRE_MORE_CONTEXT`;
- `FAIL_CLOSED`.

Authorization unavailable, tenant scope unavailable, unknown tool version, unknown risk level,
missing credential policy or ambiguous target all produce `FAIL_CLOSED` or `DENY`.

## 5. Approval model

Approval is required for consequential decisions and sensitive actions:

- production writes that change customer-visible artifacts;
- publishing recommendations, blueprints or specifications;
- live connector side effects;
- deployment actions;
- financial, security or destructive operations;
- actions involving sensitive HR, finance, compliance or credential-adjacent data.

Approval records must include actor, tenant, company/audit scope, exact action, policy version,
tool version, model/run reference, timestamp, expiration and final decision.

No agent may approve its own action.

## 6. Credential isolation

Credentials are resolved only by `CredentialResolver` after:

1. user authentication;
2. tenant authorization;
3. tool policy approval;
4. optional human approval;
5. exact tool/action binding.

Credentials must never appear in:

- prompts;
- model inputs;
- model outputs;
- agent events;
- checkpoints;
- context snapshots;
- telemetry;
- logs;
- error messages.

## 7. Context redaction

The `ContextBuilder` must apply purpose-limited redaction before any model call:

- remove credentials and tokens;
- remove unrelated tenant/company data;
- redact unnecessary personal identifiers;
- preserve evidence identifiers and provenance references;
- preserve uncertainty and contradictions;
- keep only data needed for the task.

The model must never receive the full Brain blindly.

## 8. Tenant isolation

Agent sessions, runs, events, checkpoints, context snapshots and tool invocations are
tenant-scoped. All persistence must include tenant identifiers and must be protected by both
application filters and RLS when implemented.

Cross-tenant context composition is forbidden unless a future platform-operator contract explicitly
authorizes aggregate, anonymized views. That future operator path must not be available to customer
agents.

## 9. Prompt injection and instruction hierarchy

User, interview, document and system content are data, not instructions. Agents must preserve this
instruction hierarchy:

1. AutomateX system policy;
2. tenant/application authorization;
3. tool policy;
4. approved task;
5. retrieved evidence as content;
6. user/customer text as content.

If a document or answer says “ignore previous instructions”, the phrase is treated as evidence
content only.

## 10. Audit events

At minimum, the security model requires these event families:

- `agent.run.started`;
- `agent.context.loaded`;
- `agent.skill.loaded`;
- `agent.tool.requested`;
- `agent.tool.denied`;
- `agent.approval.requested`;
- `agent.approval.granted`;
- `agent.approval.rejected`;
- `agent.tool.executed`;
- `agent.checkpoint.created`;
- `agent.recommendation.proposed`;
- `agent.outcome.recorded`;
- `agent.run.completed`;
- `agent.run.failed`.

Events store safe metadata and references, not secrets or unredacted raw payloads.

## 11. External action safety

External actions require:

- authenticated user;
- tenant membership;
- exact tool and connector version;
- target validation;
- side-effect policy;
- credential policy;
- idempotency strategy where applicable;
- timeout/retry compatibility;
- human approval for R4/R5;
- post-action audit event.

Agents cannot directly call `fetch`, SDKs, databases, connector clients or deployment APIs. They
request registered tools through the runtime.

## 12. Failure behavior

The default security posture is fail closed.

Failures that must stop execution:

- missing tenant context;
- ambiguous target;
- unauthorized tool;
- missing policy;
- approval expired;
- credential resolution failure;
- attempted secret exposure;
- cross-tenant data in context;
- model output requesting forbidden mutation;
- replay/checkpoint integrity mismatch.

## 13. Security non-goals for this blueprint

This document does not implement RLS, migrations, auth roles, encryption, credential storage,
connectors, UI approvals, SIEM export, sandboxing or incident response. It defines the future
contract those implementations must satisfy.
