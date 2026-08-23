# AutomateX Golden Journey Certification Report

Classification: **HISTORICAL SNAPSHOT / CURRENT EVIDENCE — READ WITH CURRENT STATUS CONTEXT**

Date: 2026-08-20
Branch: recover/advanced-product-flow
SHA: ee51c5e0a1de7cebfe237f989435a7876a4a5c4f
Environment: local AutomateX app + local Supabase
Mode: limited fixture / E2E certification remediation only

## Authorized remediation

Modified only E2E fixture/support/test surfaces:

- Golden Journey dataset used for certification API run.
- Playwright support for current API page shape `data.items[]`.
- Obsolete Interview E2E call changed from unsupported `GET /api/companies/{id}/interviews` to current `POST /api/companies/{id}/interviews`.
- Playwright local runner support for system Chrome and optional video disabling.

No product engine, matcher, catalog, database schema, RLS, migration, Brain, AI, ROI, Recommendation, Solution Designer, Simulator, or Automation Generator logic was modified.

## Golden Journey fixture

Scenario: realistic PME invoice-processing workflow.

Fixture signal coverage:

- invoices / invoice reception: invoices arrive by email through Gmail.
- invoice volume: 85 invoices/month.
- invoice owner: Finance manager + accounting assistant.
- invoice processing mode: manual.
- manual processing: copying between Gmail, Google Sheets, and Pennylane.
- frequency: weekly.
- human role: Finance manager, accounting assistant, approvers.
- software/tool: Gmail, Google Sheets, Pennylane.
- pain/waiting/repetition: email intake, copy-paste, approver waiting, duplicate entry risk.

Fixture realism: PASS.

Interview conditionals complete: PASS.

## Targeted flow

| Step                             | Result | Evidence                                                                                           |
| -------------------------------- | ------ | -------------------------------------------------------------------------------------------------- |
| Login                            | PASS   | Tenant A authenticated through `/login`.                                                           |
| Organization                     | PASS   | Tenant A organization membership resolved as owner.                                                |
| Company                          | PASS   | Certification company created: `Golden Invoice Certification ...`.                                 |
| Audit                            | PASS   | Existing audit flow available; downstream recommendation gate uses audit context separately.       |
| Discovery                        | PASS   | All Discovery steps saved and validated.                                                           |
| Interview                        | PASS   | Conditional finance questions answered; complete + validate passed.                                |
| Enterprise Knowledge             | PASS   | Knowledge snapshot created with status `ready`.                                                    |
| Process Map                      | PASS   | `invoice_processing` ProcessMap generated and ready for business intelligence.                     |
| Knowledge -> Process Map lineage | PASS   | ProcessMap references the KnowledgeSnapshot id and consumes invoice/finance/manual/software facts. |

Selected process pattern: `invoice_processing`.

Note: the engine also generated `order_processing` because the canonical interview question code `operations.order_channels` contains `order`. The certification selected the generated `invoice_processing` map for the invoice Golden Journey. Matcher/catalog were not changed.

## Full journey

| Step                     | Input                                                   | Output                                     | DB entity                      | Version / snapshot | Next step consumes output | Status  |
| ------------------------ | ------------------------------------------------------- | ------------------------------------------ | ------------------------------ | ------------------ | ------------------------- | ------- |
| Process Map publish      | KnowledgeSnapshot                                       | Published invoice ProcessMap               | ProcessMap                     | version 1          | Business Analysis         | PASS    |
| Business Analysis        | Published ProcessMap                                    | Published analysis                         | BusinessAnalysis               | version 1          | AI Opportunities          | PASS    |
| AI Opportunities         | Published analysis                                      | Published AI opportunity snapshot          | AIOpportunitySnapshot          | version 1          | Automation Opportunities  | PASS    |
| Automation Opportunities | AI opportunity snapshot                                 | Published automation opportunity portfolio | AutomationOpportunityPortfolio | version 1          | ROI                       | PASS    |
| ROI                      | Automation opportunity portfolio + explicit assumptions | Published ROI evaluation                   | RoiEvaluation                  | version 1          | Recommendations           | PASS    |
| Recommendations          | Audit + ROI profile                                     | Empty recommendation result                | AuditRecommendation            | n/a                | Solution Blueprint        | BLOCKED |
| Solution Blueprint       | Recommendation id                                       | Not reached                                | SolutionBlueprint              | n/a                | Automation Specification  | BLOCKED |
| Automation Specification | Solution Blueprint                                      | Not reached                                | AutomationSpecification        | n/a                | Executive Result          | BLOCKED |
| Executive Result         | Published specification                                 | Not reached                                | ExecutiveResult                | n/a                | Refresh persistence       | BLOCKED |

First downstream blocker: Recommendations generation returns HTTP 200 but produces zero recommendation rows because the current Recommendation module consumes legacy audit rule matches + ROI profile, not the newly published ROI evaluation from the ProcessMap -> Analysis -> AI Opportunity -> Automation Opportunity chain. No fake recommendation was created.

## Brain / AI / V2 / Simulator visibility

### Brain

- runtime used: NO
- authoritative inputs: none observed in this certification run
- claims/evidence consumed: none observed
- output consumed downstream: none observed
- certified: NO

### AI

- provider/runtime invoked: NO
- purpose: none
- structured output: none
- validation: none
- fallback: none
- human validation: none
- certified: NO

### V2 engines

- runtime used: NO
- engine name/version: not invoked in this product path
- input: none
- deterministic output: none
- persisted version: none
- downstream consumer: none
- certified: NO

### Simulator

- invoked: NO
- scenario: none
- assumptions: none
- output: none
- persisted: none
- consumed by Executive Result: NO
- certified: NO

## Refresh persistence

| Artifact                           | Status |
| ---------------------------------- | ------ |
| Tenant A company reload            | PASS   |
| Tenant A invoice ProcessMap reload | PASS   |

Refresh persistence: PASS for reached artifacts.

Executive-result persistence remains BLOCKED because Executive Result was not reached.

## Tenant B / IDOR

| Tenant B operation using Tenant A id      | Status    |
| ----------------------------------------- | --------- |
| Read Tenant A company                     | 404, PASS |
| Read Tenant A ProcessMap                  | 404, PASS |
| Start Discovery write on Tenant A company | 404, PASS |

Tenant B read denial: PASS.

Tenant B write denial: PASS.

IDOR/BOLA: PASS for tested reached artifacts.

## Playwright

Final run command: `npm run test:e2e:pilot` with local Supabase env, system Chrome, and local video disabled.

Total: 11
Pass: 8
Fail: 3
Skip: 0

Passing:

- `protected route rejects an anonymous browser`
- `Tenant A authenticates and receives a session-backed companies response`
- `Tenant A company journey uses real API data`
- `eligible real company exposes the production decision center`
- `Discovery loads through the existing company-scoped route`
- `Interview loads through the existing company-scoped route`
- `Decision Center reload reads current persisted state`
- `Tenant A cannot use a Tenant B company identifier`

Failing:

- `Ask AutomateX remains grounded and rejects out-of-scope questions`
- `evidence request and bounded evidence submission use durable routes`
- `evidence request retry remains bounded and observable`

Failure classification: API route exposure / routing blocker, not stale `data[]` contract.

Observed evidence: authenticated calls to these existing source files return a Next 404 HTML route-not-found response before entering the handler:

- `src/app/api/companies/[id]/automation-audit/ask/route.ts`
- `src/app/api/companies/[id]/automation-audit/evidence-requests/route.ts`
- `src/app/api/companies/[id]/automation-audit/evidence/route.ts`
- `src/app/api/companies/[id]/automation-audit/results/route.ts`

These tests were not relaxed to accept 404, because that would hide a real routing/product exposure blocker.

## Verdict

Global verdict: RED — NOT READY.

Rationale:

- Targeted invoice Golden Journey now reaches and certifies Process Map with `invoice_processing`.
- Downstream deterministic chain reaches ROI.
- The product still cannot complete the full executive journey because Recommendations are not connected to the published ROI evaluation chain.
- Three advanced API routes required by existing Playwright certification still return Next route-not-found 404.

## Product preservation

Brain modified: NO.

AI modified: NO.

Engines modified: NO.

Process matcher modified: NO.

Pattern catalog modified: NO.

ROI modified: NO.

Recommendations modified: NO.

Simulator modified: NO.

Migrations modified: NO.

RLS modified: NO.

Prisma modified: NO.

Product logic modified: NO.

E2E fixtures modified: YES.

Stale Playwright tests modified: YES.

## Next action

Resolve the next real product blockers in order:

1. Investigate why nested `automation-audit/*` API routes are not exposed by Next despite route files existing.
2. Reconcile Recommendations ownership so the published ROI evaluation / automation opportunity chain can produce a recommendation artifact consumable by Solution Blueprint.
3. Re-run the full Golden Journey from Recommendations onward only after those blockers are fixed.
