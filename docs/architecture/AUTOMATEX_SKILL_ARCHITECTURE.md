# AutomateX Skill Architecture

Status: Future skill architecture blueprint — documentation only
Implementation status: Not implemented

## 1. Purpose

Skills package reusable methodology, constraints, prompt guidance, examples, policies and
evaluation expectations for agents. Skills are not business engines and do not own canonical
decisions. They guide agent behavior while preserving Evidence, Brain and deterministic engine
authority.

## 2. Skill principles

- Skills are versioned.
- Skills are composable.
- Skills are loaded by explicit version.
- Skills may provide prompts and examples but cannot override system policy.
- Skills cannot grant tool permission.
- Skills cannot access credentials.
- Skills must declare compatible agent types and risk boundaries.
- Skills must preserve tenant isolation and evidence provenance.

## 3. Skill package shape

A future skill version should define:

- `skillId`;
- `skillVersion`;
- `name`;
- `description`;
- compatible agent types;
- required input context types;
- output expectations;
- methodology;
- forbidden behavior;
- prompt fragments if applicable;
- tool permissions requested, not granted;
- evaluation fixtures;
- compatibility with Brain and engine versions;
- deprecation/supersession metadata.

## 4. Core skills

| Skill                      | Purpose                                                                         | Primary agents                          | Outputs                                     |
| -------------------------- | ------------------------------------------------------------------------------- | --------------------------------------- | ------------------------------------------- |
| AutomateX Master           | Global product boundaries, evidence discipline, tenant isolation, human control | all                                     | consistent agent operating frame            |
| Audit Methodology          | How to structure an automation audit and identify missing evidence              | AuditAgent, ConsultantAgent             | audit plan, question rationale              |
| Evidence Validation        | Evidence quality, provenance, reliability, contradiction handling               | AuditAgent, KnowledgeAgent              | evidence review, validation notes           |
| Process Analysis           | Process mapping, bottlenecks, dependencies and controls                         | AuditAgent, WorkflowArchitectAgent      | process insight, gap list                   |
| Automation Analysis        | Automation suitability and feasibility language                                 | WorkflowArchitectAgent, ConsultantAgent | automation option drafts                    |
| ROI Methodology            | ROI assumptions, ranges, missing economic evidence                              | ConsultantAgent, OptimizationAgent      | ROI explanation and assumption gaps         |
| Recommendation Methodology | Portfolio fit, decision framing, prioritization language                        | ConsultantAgent, OlympusAgent           | recommendation narrative                    |
| Solution Architecture      | Future-state solution structure and constraints                                 | WorkflowArchitectAgent, DeploymentAgent | blueprint/spec draft sections               |
| Security                   | Sensitive action policy, credential boundaries and risk language                | all                                     | security-safe tool and explanation behavior |

## 5. Industry skills

Industry skills are optional contextual overlays. They must not create a hard-coded industry
taxonomy in Domain Core and must not override evidence.

Initial reserved industry skills:

- Accounting;
- Real Estate;
- Ecommerce;
- Logistics;
- Healthcare;
- Manufacturing.

Industry skills may provide vocabulary, common process examples and likely evidence sources. They
must mark all industry priors as priors, not facts.

## 6. Composition model

Skills compose in layers:

```text
AutomateX Master
→ Security
→ task methodology skill
→ optional industry skill
→ agent-specific operating instructions
→ compact tenant/company context
```

Conflict resolution:

1. system policy wins;
2. security skill wins over methodology skill;
3. Evidence/Brain constraints win over industry priors;
4. deterministic engine outputs win over generated language;
5. lower-risk interpretation wins when ambiguous.

## 7. Skill loading event

Every skill load emits `agent.skill.loaded` with:

- skill id;
- exact version;
- checksum;
- compatible agent type;
- policy version;
- reason selected.

## 8. Skill evaluation

Each skill should have deterministic and scenario-based tests for:

- evidence discipline;
- no unsupported claims;
- no secret request;
- no cross-tenant assumptions;
- no forbidden tool escalation;
- no employee ranking;
- correct uncertainty handling;
- correct approval boundary.

## 9. Skill versioning

Published runs record exact skill versions. A later skill version cannot reinterpret a historical
agent run unless replay is explicitly requested and labelled as a new evaluation.

Version changes requiring review:

- changed forbidden behavior;
- changed tool risk expectation;
- changed methodology that affects recommendations;
- changed industry priors;
- changed prompt examples affecting sensitive behavior.

## 10. Relationship to DeepSeek Harness

DeepSeek Harness may inspire skill packaging, harness discipline and evaluation practices.
AutomateX skills must remain native AutomateX artifacts and must not require DeepSeek Harness,
Cordis or provider-specific runtime contracts.

## 11. Non-goals

This document does not implement skills, registry tables, prompt files, runtime loading, model
calls, migrations, UI or agent behavior.
