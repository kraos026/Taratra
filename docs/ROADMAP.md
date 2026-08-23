# AutomateX Roadmap

Last verified: 2026-08-23.

This roadmap separates the certified product path from shadow/lab work and future architecture.
For the current P0 certification state, see
[AUTOMATEX_CURRENT_STATUS.md](AUTOMATEX_CURRENT_STATUS.md).

## Current — certified local P0 path

- Auth, tenant resolution and company access;
- audit lifecycle and evidence acquisition;
- Discovery → Interview → Enterprise Knowledge → Process Map → Business Analysis;
- AI Opportunities → Automation Opportunities → ROI Evaluation;
- Recommendation Portfolio → Solution Blueprint → Automation Specification;
- Executive Result / Decision Center;
- local Supabase certification harness, including deterministic Tenant A/B fixtures;
- local RLS / pgTAP certification and Playwright golden journey certification.

This is the current canonical release path. It does not make Brain V2, synthetic AI labs, Runtime,
Automation Generator delivery or Agents production-authoritative.

## Next — P0 release hardening

1. Run exact-SHA staging certification against an isolated non-production deployment.
2. Confirm production environment variables, Auth, RLS and Prisma configuration without exposing
   secrets.
3. Produce the release PR from the certified branch and review the full commit manifest.
4. Add production monitoring, incident response and operational acceptance checks.
5. Decide explicitly whether the certified recovery branch becomes the release baseline.

## Later — product delivery expansion

1. Public Automation Generator delivery and REST contract certification.
2. Sandbox Validation.
3. Platform-specific compilation.
4. Controlled Deployment Engine.
5. Monitoring Engine.
6. Optimization Engine.
7. Pilot Feedback System and outcome tracking.
8. Executive Report / Decision Center evolution consuming certified V2 artifacts.

## Future architecture — not production-active

- Agentic architecture, Agent Runtime and Skill Architecture;
- Runtime execution/deployment stack beyond current certified product flow;
- Enterprise Simulator as a separate internal tool, subject to its own approved implementation
  roadmap;
- broader Brain canonical promotion, if approved by a later ownership decision.

## Research / shadow track — Brain Quality Roadmap

AutomateX must evolve from a deterministic audit and recommendation pipeline into a defensible
decision-support system. Some Brain V2 and AI capabilities exist in shadow/lab form, but they are
not yet the sole production source of truth for canonical product decisions.

### Brain P1: Decision Quality Engine

The platform must eventually answer:

- what a company should automate;
- what it should not automate;
- which implementation approach or tooling should be chosen and why;
- what realistic result can be expected, with explicit confidence.

### Brain P1.1: Automation Suitability

For each candidate process, AutomateX should evaluate available evidence for repetition,
frequency, human effort, standardization, exception rate, data availability and quality, system and
API accessibility, decision complexity, process stability, business criticality, security and
privacy sensitivity, compliance constraints, expected value, implementation complexity, and
maintenance burden.

The future output classes are: `AUTOMATE`, `ASSIST`, `IMPROVE PROCESS FIRST`,
`DO NOT AUTOMATE`, and `INSUFFICIENT EVIDENCE`. Insufficient evidence must not be converted into a
forced recommendation.

### Brain P1.2: Confidence and Evidence Quality

Every important recommendation should carry confidence derived from evidence completeness,
evidence consistency, source reliability, assumptions required, missing information, and estimation
uncertainty. `UNKNOWN` must remain distinct from zero.

### Brain P1.3: Opportunity Ranking

The future canonical prioritization model should incorporate business impact, time savings,
financial impact when supportable, implementation effort, complexity, risk, confidence,
time-to-value, dependencies, reversibility, and strategic importance. Ranking must remain
explainable and should support categories such as `QUICK WIN`, `STRATEGIC`, `FOUNDATIONAL`,
`LONG TERM`, `LOW PRIORITY`, and `REJECTED`.

### Brain P1.4: Negative Recommendations

`DO NOT AUTOMATE` must become a first-class recommendation type. Reasons may include unstable
processes, process redesign required first, insufficient volume, excessive exception rate, missing
reliable data, unavailable integration, unacceptable risk, weak ROI, essential human judgment,
security/compliance constraints, or automation increasing complexity.

### Brain P2: Solution Selection Engine

For an approved opportunity, AutomateX should compare implementation strategies such as workflow
automation, native SaaS automation, integration platform, RPA, deterministic software,
AI-assisted workflow, human-in-the-loop AI, custom integration, no-code/low-code, custom
development, and not automating.

The comparison should explain capability fit, existing company stack, API availability,
implementation effort, operating cost, scalability, reliability, vendor lock-in, maintenance,
security, compliance, observability, and reversibility.

### Brain P2.1: Tool and Integration Knowledge

Future software, API, integration, automation platform, and AI-provider knowledge must live in
versioned, updateable catalogs or policies. Volatile vendor knowledge must not be hard-coded into
Domain logic.

### Brain P2.2: Architecture Recommendation

The platform should translate a business recommendation into an implementation architecture:
trigger, inputs, processing, decisions, integrations, human approvals, outputs, error handling,
and monitoring. This should ultimately feed Automation Specification.

### Brain P2.3: Dependency Reasoning

AutomateX should reason about sequencing and conflicts: opportunities that require other
opportunities, should wait for cleanup, share infrastructure, or conflict with current process
architecture.

### Brain P3: Outcome Learning

Outcome learning is deferred until real pilot usage exists. The future lifecycle is:
recommendation, implementation, expected outcome, actual outcome, variance, and learning. Metrics
may include actual hours saved, cost, adoption, failure rate, implementation duration, maintenance
burden, and realized financial impact.

Outcome learning must use privacy-preserving aggregation and must never introduce employee
surveillance.

### Brain P3.1: Calibration

Future calibration should compare predicted and observed results to improve estimates and
confidence intervals. Machine learning is not required merely because data exists.

Every Planned bounded context requires an architecture contract, ADRs, threat analysis, tests and
an explicit approval before implementation.
