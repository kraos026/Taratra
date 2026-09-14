# Optivos finalization — 2026-09-14

## Checkpoint 2 — feature inventory and verified remediation

Baseline commit: `e083a3467df62e1df8a4d0b35a816dc1b17b4f86`. The earlier pause is superseded. Two dedicated synthetic staging identities have now been provisioned through the authenticated CLI, after exact-SHA runtime target verification. Credentials remain in process memory only. Historical sections below are retained as history, not current blockers.

Status describes assessed product completeness, not production certification. PARTIAL includes missing fresh E2E acceptance; it does not mean the existing module is broken. UI/API/SERVICE/DB indicate existing implementation, not automatic PASS. RLS=L denotes the 237-test local baseline; T is the number of module test files (route/shared tests are additional). E2E=P/C denotes existing pilot/canonical coverage, NOT RUN for this checkpoint unless explicitly recorded below. No module is labelled DEAD/UNUSED merely because it lacks a standalone route.

| MODULE                                   | USER VALUE                      | UI                         | API                            | SERVICE                      | DB                    | RLS                         | TESTS                     | E2E              | STATUS  | BLOCKER                                    | ACTION                                |
| ---------------------------------------- | ------------------------------- | -------------------------- | ------------------------------ | ---------------------------- | --------------------- | --------------------------- | ------------------------- | ---------------- | ------- | ------------------------------------------ | ------------------------------------- |
| Authentication                           | Secure access                   | Login/signup               | Supabase Auth, callback/logout | auth-actions                 | Auth managed          | Auth + L                    | T2 + routes               | P                | PARTIAL | Recovery fixed; staging mail pending       | Certify staging callback and SMTP     |
| Password recovery                        | Regain account access           | New request/reset          | Supabase Auth                  | New recovery actions         | Auth managed          | Verified user before update | New 11 cases + callback 3 | New local runner | PARTIAL | SMTP/redirect target acceptance            | Local real-mail then staging          |
| Onboarding                               | First workspace                 | /onboarding                | organization POST              | schema + RPC                 | organizations         | L                           | Route tests               | P                | PARTIAL | Staging acceptance                         | A/B dedicated onboarding              |
| Organizations                            | Workspace ownership             | Onboarding, shells         | Scoped existing boundaries     | Existing RPC/context         | organizations         | L                           | Shared/DB                 | P                | PARTIAL | No explicit multi-workspace selection      | Verify actual intended tenant UX      |
| Memberships                              | Tenant boundary                 | Indirect                   | Claims/RPC                     | Existing context             | organization_members  | L                           | Shared/DB                 | P                | PARTIAL | Fresh adversarial acceptance               | Separate A/B contexts                 |
| Companies                                | Client dossier                  | 5 components               | CRUD/archive/restore           | CompanyService               | Prisma repositories   | L                           | T3                        | P                | PARTIAL | Fresh browser acceptance                   | CRUD/refresh/isolation                |
| Audit creation                           | Start investigation             | 3 components               | audit APIs                     | AuditService                 | audits/answers        | L                           | T3                        | P                | PARTIAL | Legacy/canonical navigation                | Verify journey bridge                 |
| Questionnaires                           | Structured answers              | Versioned editor           | questionnaire APIs             | QuestionnaireService         | versioned tables      | L                           | T3                        | P                | PARTIAL | Legacy ownership                           | Preserve until consumer proof         |
| Discovery                                | Company facts                   | Wizard                     | discovery sessions             | DiscoveryService             | sessions              | L                           | T3                        | P/C              | PARTIAL | Fresh persisted acceptance                 | Required fields/resume                |
| Interviews                               | Guided evidence                 | Interview UI               | answer/back/skip/complete      | Interview services           | sessions/answers      | L                           | T3                        | P/C              | PARTIAL | Fresh persisted acceptance                 | Adaptive path and refresh             |
| Knowledge                                | Evidence-backed knowledge       | Embedded downstream        | snapshot APIs                  | KnowledgeService             | snapshots             | L                           | T5                        | C                | PARTIAL | No dedicated exploration UI                | Verify downstream traceability        |
| Process mapping                          | Understand workflow             | Explorer                   | build/publish/validate         | Service + engine             | snapshots             | L                           | T3                        | C                | PARTIAL | Fresh acceptance                           | Lineage and publication               |
| Business analysis                        | Find inefficiencies             | 2 components               | analysis APIs                  | Service + engine             | analyses/findings     | L                           | T5                        | C                | PARTIAL | Some English labels                        | Review rendered explorer              |
| AI opportunities                         | Identify AI suitability         | 2 components               | AI opportunity APIs            | Deterministic service/engine | snapshots             | L                           | T5                        | C                | PARTIAL | Not a live LLM decision engine             | Preserve canonical ownership          |
| Automation opportunities                 | Prioritize automation           | 2 components               | scoped opportunity APIs        | Service + engine             | snapshots             | L                           | T4                        | C                | PARTIAL | Fresh safety acceptance                    | Opportunity-scoped evidence/ROI       |
| ROI evaluations                          | Economic justification          | 3 components               | ROI/revise/publish             | Service + engine             | evaluations           | L                           | T8                        | C                | PARTIAL | Fresh economics acceptance                 | Currency, missing inputs, assumptions |
| Recommendation portfolios                | Action plan                     | Roadmap/detail             | portfolio APIs                 | Service + engine             | portfolios/items      | L                           | T5                        | C                | PARTIAL | Fresh downstream acceptance                | Published ROI lineage                 |
| Solution designer                        | Blueprint                       | 2 components               | blueprint APIs                 | Service                      | blueprints            | L                           | T5                        | C                | PARTIAL | Fresh persistence acceptance               | Build/publish/refresh                 |
| Automation specification                 | Implementation contract         | Embedded, no own component | specification APIs             | Services                     | specifications        | L                           | T6                        | C                | PARTIAL | Standalone user experience limited         | Verify canonical downstream           |
| Automation generation                    | Future executable graph         | Absent                     | No public route                | Compiler explicitly deferred | Persistence stub      | Boundary tests              | T14                       | None             | PARTIAL | AG-2B compiler/persistence not implemented | Do not market executable deployment   |
| Decision Center                          | Safe business decision          | Patron view                | decision-center API            | Canonical projection         | Read model            | L                           | Company-intake T24        | P/C              | PARTIAL | Fresh UI acceptance                        | No unlinked positive recommendation   |
| Executive Result                         | Published summary               | 2 components               | result APIs                    | Executive service            | result snapshots      | L                           | T3                        | C                | PARTIAL | Fresh publish/refresh acceptance           | Scoped economics and evidence         |
| Ask AutomateX                            | Explain canonical decision      | Panel                      | ask API                        | Bounded service + validator  | Read model            | L                           | Included T24              | P                | PARTIAL | Live model not certified                   | AI must not reverse canonical state   |
| Evidence                                 | Ground claims                   | Embedded upload/list       | evidence/request APIs          | Intake evidence boundaries   | scoped records        | L                           | Included T24              | P                | PARTIAL | Fresh isolation/size acceptance            | Synthetic files only                  |
| Feedback                                 | User feedback                   | 2 components               | feedback API                   | FeedbackService              | feedback tables       | L                           | T5                        | P                | PARTIAL | Fresh browser acceptance                   | Submission/error/isolation            |
| Assisted audit                           | Orchestrate journey             | 2 components               | company automation-audit       | AssistedAuditService         | scoped repositories   | L                           | T6                        | P/C              | PARTIAL | Fresh full journey                         | Avoid parallel engine                 |
| Dashboard/navigation                     | Find next action                | Dashboard/shells           | Existing company/audit APIs    | Navigation helpers           | Read-only projections | L                           | Navigation + pilot T1     | P                | PARTIAL | Controls fixed; full UX review pending     | Verify loaded desktop/mobile states   |
| Persistence                              | Durable progress                | Refresh/relogin            | Existing APIs                  | Canonical repositories       | 24 migrations         | L                           | Across modules            | P/C              | PARTIAL | New-SHA persistence acceptance             | Full local and staging journey        |
| Tenant isolation                         | Prevent cross-customer access   | Scoped navigation          | Auth wrappers                  | user-context transactions    | tenant keys           | L                           | DB + unit tests           | P                | PARTIAL | New-SHA A/B acceptance                     | Read/mutate foreign IDs               |
| Empty states                             | Explain missing data            | Present, variable quality  | Existing responses             | N/A                          | N/A                   | N/A                         | Partial UI tests          | P                | PARTIAL | Whole-product walkthrough                  | Avoid implying fabricated metrics     |
| Loading states                           | Prevent accidental resubmit     | Pending indicators         | Existing requests              | New recovery in-flight guard | N/A                   | N/A                         | Unit + P                  | P                | PARTIAL | All forms not reviewed yet                 | Check concurrency paths               |
| Error states                             | Recover without leaking details | Present                    | Safe domain envelopes          | Existing wrappers            | N/A                   | N/A                         | Unit + P                  | P                | PARTIAL | Provider outage handling varies            | Correct confirmed failures only       |
| Legacy recommendations/reports/ROI/rules | Historical compatibility        | Mixed redirects/readers    | Existing legacy APIs           | Existing owners              | Existing tables       | L                           | T2/T4/T1/T6               | Partial          | PARTIAL | Consumers not proven absent                | No speculative deletion               |
| Work-intelligence / Brain                | Shadow research                 | No canonical UI            | Not promoted                   | Shadow services              | activity/assessments  | L                           | T5 + brain tests          | No live          | PARTIAL | Live credentials/certification             | Keep SHADOW                           |

### Audit observations beyond Auth

- Placeholder scan: broad substring search initially reported 172 hits, including `whatToDo` and `toDomain` false positives. Word-boundary review separates CSS `todo`, input hints, test fixtures, atomic temporary-file writes, synthetic Brain scenarios, safe deterministic fallbacks and deferred generator code. None is sufficient evidence for deleting a module.
- No `dangerouslySetInnerHTML` found in application source. Two unsafe raw SQL calls found; both use the constant `set local role authenticated`, not user interpolation.
- Company repository list uses `skip`/`take`. Pilot dashboard fetches all accessible companies and fans out assisted-audit reads: scaling risk remains, not proof of measured latency.
- Onboarding uses `create_first_organization` RPC with claims-derived identity, schema validation and 409 handling. No client-supplied tenant identifier is used for first-organization creation.
- Baseline headers include nosniff, frame deny, restrictive referrer/permissions policy and framing/object/base CSP. This is explicitly not a complete nonce-based script CSP.
- Ask AutomateX checks company and tenant scope before rendering and validates provider output with deterministic fallback. Live provider timeouts/retries and all AI paths remain under review; no shadow promotion is authorized.
- Dead-code removal is deferred until imports/routes/callers prove absence; frozen evidence and recovery scripts remain preserved.

### Auth remediation scope

Canonical owner: Auth. Proven defects: unsupported password recovery, false confirmation-delivery claim, failed recovery callback routed to signup. Added public recovery request, authenticated reset page, provider-backed verified-user update, neutral account messages, rate-limit/network feedback and duplicate-submit guard. No migration or production Auth configuration change.

Local real-mail testing also proved a configuration defect: the runner binds `localhost`, but the existing local Auth redirect list omits its callback and falls back to `127.0.0.1`. Only local `supabase/config.toml` callback entries are added; local containers restart with data volumes retained, without reset. Staging/production redirect and SMTP readiness must be assessed independently.

Auth checkpoint tests: full Vitest 1203/1203, 194 files; lint/typecheck PASS; build 26/26 pages. Real-mail runner PASS: local Mailpit delivery, same-browser recovery callback, password update, old-password rejection, new-password login, anonymous reset rejection and synthetic local-user cleanup. Test-hook correction: `beforeEach` must not return a mock function, which Vitest treats as cleanup. This explained the new network-error test's initial failure.

References: [Supabase password flow](https://supabase.com/docs/guides/auth/passwords), [signup API](https://supabase.com/docs/reference/javascript/auth-signup). No generic “email sent” claim is made when the provider deliberately hides account existence. Mail delivery, SMTP readiness and redirect allowlists are environment requirements, not established by unit tests.

### Checkpoint 2 change ledger and evidence limits

| SHA                                        | Finding/change                                                                                                             | Tests/evidence                                                                        | Risk                        | Remaining dependency                           |
| ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- | --------------------------- | ---------------------------------------------- |
| `99fafd234c88dac24e8dd6d4a99f784458142586` | Missing recovery and misleading signup delivery claim; canonical Auth UI/actions/callback and local redirect configuration | 11 recovery + 3 callback cases; 1203 full tests; local real-mail browser PASS         | MEDIUM: authentication flow | Staging SMTP and callback allowlist acceptance |
| `4bb7041c9bd47c5a413de77a35e1e2f2f6275f5a` | Dashboard inactive controls and permanent placeholder metrics replaced with real scoped navigation                         | 8 navigation tests; lint                                                              | LOW                         | Full loaded-state/mobile review                |
| `87afbc7a3060dab793f170979512e1a018ffb4fd` | Read-only target diagnostic restricted to Preview + exact Astra branch, 404 otherwise                                      | 8 tests; verified exact deployed SHA and all three STAGING targets                    | LOW, temporary diagnostic   | Remove diagnostic before production candidate  |
| `da7902e7e79a6c52bcad9626edaaa533f5004de0` | Malformed evidence/request JSON threw SyntaxError/500; now safe 400 after auth/tenant checks                               | Reproduced 2 failures; fixed 6/6 including anonymous401 and foreign404; full1217/1217 | LOW                         | Final Preview acceptance                       |

- Local canonical journey: exit0, 12/12 stages, run `run-20260914090319-1c78416a`, complete Executive Result READY, 4 recommendations, refresh persistence and authenticated tenant-B denial PASS. Timing file retained unchanged. Executed with HEAD `87afbc7...` and pending non-canonical runner/docs work; **not** a clean final-release certification and not evidence for later source changes. Migration inventory24/24. Build26/26.
- Local pilot lifecycle defect: all assertions passed but the runner retained its live app child after printing PASS. Root cause: exit hook cannot fire while the child keeps the event loop alive. Minimal runner fix stops its owned child before success. Earlier canonical attempt failed because this child occupied port3000; only the positively identified local runner process tree was stopped. No data reset.
- Latest full Vitest after evidence fix: **1217/1217**, **196 files**, exit0,55.65s. Future Vite native-loader warning remains non-blocking; no dependency change.
- Exact staging Preview tested: `dpl_FgfoJm1ZnG6znG8oayPCftaDQ5v9`, `https://taratra-hbpulboc9-optivos.vercel.app`, SHA `87afbc7...`, Astra branch. Runtime reports preview/STAGING for DATABASE_URL, DIRECT_URL and public Supabase URL. No URL/credential connection values exposed.
- Dedicated identities: A `529d511e-ef40-43e7-a285-a981f36f8387`, B `0414e443-05c0-4ad6-93f7-9097d2ce8a84`. Separate workspace onboarding PASS. Resumption validates synthetic metadata/email pattern before password rotation; never resets a real account. Synthetic data retained for traceability; no plaintext credential file exists.
- Staging run `CERT-STAGING-1789393665869-7f0813f9`: scoped Auth/company/discovery/refresh PASS, five foreign read/write requests returned404. This does **not** certify the full canonical staging journey. Initial login/dashboard timeouts remain intermittent observations with UNKNOWN cause, not proof of a code defect. One earlier evidence GET test was a harness mistake (route supports POST), corrected without changing product contract.
- Expanded isolation initially expected404 for collection APIs but observed200 for analysis. Source confirms authenticated organization+company filtering returning empty pages. Harness must assert items=[] and total=0, not mislabel all200 as leaks. Populated artifact-ID access remains to certify after full staging journey.
- Staging Auth read-only settings: signup enabled, email enabled, confirmation required. SMTP delivery and Preview callback allowlist **NOT_PROVEN**. Synthetic `example.invalid` identities intentionally cannot establish real mail delivery. Local mail PASS must not be promoted to staging mail PASS.
- Production/main/frozen release branches remain out of scope. No production deployment, promotion, Auth configuration, DB schema or dependency change. Live Brain remains SHADOW; no live provider invocation.

### Current remaining release work

Final mobile follow-up:

- Final exact source-SHA Preview: `cc20d1af250293c1f057d7082addee15529b145b`, deployment `dpl_FxFEFvk8fxLmnySQ5UMjz8gH7hs3`, `https://taratra-46nunmoan-optivos.vercel.app`, READY/Preview, all three runtime targets STAGING. Run `CERT-STAGING-1789394403757-def7a14d` **PASS**, exit0, including actual390px logout click, anonymous401 afterward, re-login and persisted company200. Sanitized evidence retained in `evidence/staging-auth-boundary-cc20d1a.json`. Any following documentation/evidence-only commit is not a new full canonical certification.

- `97ea8c2fd14ecaf7d8a2ad71c4a8cadb44ca37d2`: inventory/evidence checkpoint only, no engine change. Exact Preview `dpl_4Q9RNNchSetQycQmqpYMSkr3enYR` READY and scoped staging run `CERT-STAGING-1789394203584-eb711535` PASS, including refresh/re-login and authenticated isolation. Full canonical staging still NOT_RUN.
- `cc20d1af250293c1f057d7082addee15529b145b`: confirmed mobile accessibility defect. Existing CSS hid the logout form below760px, and icon-only navigation lost visible text. Keep a44px labelled logout button visible; label navigation links; focus outline retained. 9 navigation tests PASS, scoped lint/typecheck PASS; full **1218/1218**,196 files,52.70s; full format/lint PASS. Risk LOW, presentation-only; no Auth service change. Runner now verifies actual mobile logout rather than only posting the endpoint.
- Browser network guard deliberately permits only the Preview and staging Auth origins. External Google Font requests are blocked; these captures prove bounded layout and interaction under fallback fonts, not final brand typography.

Checkpoint consolidation on 2026-09-14:

- `b298e35c9263be274ff08f65ae55a4541ed3093a`: local runner lifecycle fix. Rerun completed **25/25 pilot tests, 13 files, exit0**; build26/26 and migration24/24. LOW risk, runner-only, owned process cleanup verified.
- `259e8cfdca78458068fff813590776b2638aedc1`: reusable strictly staging-scoped browser runner. PASS run `CERT-STAGING-1789393904839-bd2d7639` against exact87afbc7 Preview. Adds authenticated B control request, seven foreign direct/read/write404 checks, four strictly empty collection checks, discovery creation, loaded dashboard/390px overflow, logout401, re-login200 and persisted company. MEDIUM operational risk: synthetic Auth/data writes only after runtime/branch/SHA guards; no app-engine change. Full canonical staging artifacts remain untested.
- Browser screenshots were inspected at390px and1440px after waiting for actual company rendering and fonts. Long synthetic names wrap; no horizontal overflow. Mobile layout is dense but core navigation remains present. This is dashboard coverage, not all-product UX acceptance. Screenshots remain local temporary diagnostic artifacts; sanitized JSON evidence is versioned separately.
- Gates: format PASS, lint PASS (zero-warning gate, final runner scoped recheck), typecheck PASS after removal of generated Next root-params import, full1217 tests PASS, targeted Decision Safety **40/40** PASS. The historical42 baseline is not forced.
- No dependency files changed. No production mutation, migration, PR or branch merge. Latest staging smoke certifies87afbc7 only; later evidence JSON error handling has local acceptance and needs fresh Preview acceptance.

1. Full exact-final-SHA staging canonical journey with populated artifacts, refresh/re-login and ID-specific B read/write denial; scoped company smoke is insufficient.
2. Staging email delivery and exact Preview recovery callback acceptance (configuration/operational dependency, not missing implementation).
3. Complete loaded-state UX, error/loading/concurrency review across the inventory; generator remains explicitly PARTIAL and execution/runtime FUTURE.
4. Final diagnostic removal, clean-SHA/clean-clone checks, production compatibility/backup/rollback review and separate production authorization.

Verdict: **NOT_READY_FOR_PRODUCTION**. Identity provisioning is no longer a blocker; certification coverage remains incomplete.

## Historical checkpoint 1 — mission and immutable baseline

MISSION: audit, remediate proven defects, verify, and prepare a release without changing production.

- Working branch: `astra/optivos-finalization-20260914`.
- Base: `e4f01ad59ff70e01a2835fa80d847628ef7f5e57` (certified historical RC).
- Diagnostic branch is preserved, not used as the implementation base.
- Initial local status was clean. Frozen release, evidence, recovery, security and diagnostic refs were inspected alongside remote heads; no ref was rewritten.
- Production and `main` must not be deployed, merged or updated by this mission.
- Current verdict: **NOT_READY_FOR_PRODUCTION**. This is an ongoing audit, not a completed A–Z certification.

## Initial product/architecture gap matrix

Evidence: `AGENTS.md`, `docs/architecture/SYSTEM_ARCHITECTURE.md`, module and route inventories, production projections, infrastructure and certification scripts. “Exists” and “wired” do not establish current E2E certification.

| Area / owner                                                  | Observed status                                                                                                  | Remaining evidence / gap                                                          |
| ------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| Auth, onboarding, companies, audits                           | Canonical modules and routes exist; callback return URL validation and authenticated database boundary inspected | Fresh A/B tenant isolation, signup, persistence and staging acceptance            |
| Discovery, interviews, knowledge, process-mapping             | Canonical pipeline, represented in the 12-stage runner                                                           | Fresh local and staging journeys                                                  |
| Business-analysis, ai-opportunities, automation-opportunities | Canonical deterministic pipeline exists                                                                          | Fresh persisted lineage and failure-path acceptance                               |
| ROI-evaluations, recommendation-portfolios                    | Canonical economics and prioritization modules exist                                                             | Opportunity-scoped ROI and currency contract acceptance                           |
| Solution-designer, automation-specifications                  | Canonical blueprint/specification owners exist                                                                   | Downstream persistence and refresh acceptance                                     |
| Executive-results, company-intake                             | Canonical executive projection and Ask AutomateX wiring exist                                                    | Fresh browser acceptance and evidence rendering                                   |
| Assisted-audit, pilot-dashboard, pilot-feedback               | Supporting services/UI exist                                                                                     | Full interaction and error-state audit remains                                    |
| Work-intelligence / Brain                                     | SHADOW, not a canonical decision maker                                                                           | Live benchmark not run; external model credentials absent from current process    |
| Automation-generator                                          | PARTIAL by explicit contract; compiler and persistence intentionally reject deferred execution                   | Do not claim executable automation delivery or invent an execution platform       |
| Questionnaires, rules, recommendations, reports, old ROI      | LEGACY per governance                                                                                            | Verify all user-facing paths consistently use canonical ownership                 |
| Execution runtime, deploy automation, monitoring agents       | FUTURE                                                                                                           | Not implemented; not marketed as currently executable functionality               |
| Main dashboard                                                | Company/audit fetches wired; opportunities/hours widgets use dashes, date filter and prepared action disabled    | Incomplete widgets, not proven fabricated metrics; UX completion decision remains |
| Pilot dashboard loading                                       | Per-company assisted-audit reads in parallel                                                                     | Potential N+1; no measured performance defect yet, so no speculative rewrite      |

## Findings and corrections

### F-001 — database diagnostic logging minimization

- Classification: infrastructure privacy defect.
- Affected domain / canonical owner: authenticated database infrastructure.
- Before: initialization logged database host, port, decoded database username and project identity. Routine transaction stages logged user IDs on every call.
- Fix: retain only a connection-mode enum at initialization; remove routine transaction identity traces and explicit user ID from failure metadata.
- Files: `src/infrastructure/database/prisma.ts`, `src/infrastructure/database/with-authenticated-database.ts`, adjacent new tests.
- No dependency, schema, query, role, tenant scope or business-decision change.
- Security invariant: parameterized transaction-local JWT subject is established before `SET LOCAL ROLE authenticated`, before application operations.
- Tests verify original connection string reaches the adapter without being logged, missing URL rejects, RLS setup precedes operations, and failed context setup prevents operations.
- Risk: LOW for logging-only production diff; operational log detail is intentionally reduced. Real database certification is still required.
- Out of scope for this fix: AI engines, opportunity scoring, migrations, remote configuration.

### F-002 — historical evidence must not be overinterpreted

- Vercel sensitive environment values may be redacted. Empty CLI output alone does not prove an empty runtime value or branch override.
- The existing diagnostic Preview's STAGING classifications do not certify the finalization SHA.
- A diagnostic path identifying the project from the URI does not prove a SQL query was performed.
- Selecting the globally newest auth user does not prove that it is the intended manually created test user. Staging acceptance needs an explicitly identified test account and tenant.

### F-003 — suspected unlinked recommendation bypass not reproduced

`recommendationStateFor()` returns `NEEDS_MORE_EVIDENCE` for unlinked positive recommendations; opportunity decisions use scoped safety. No relaxation or speculative change applied. This inspection is not a substitute for all-case business acceptance.

## Historical checkpoint 1 — execution evidence

These runs cover the working changes, not a final clean release SHA.

| Gate                                 | Result                                                                           |
| ------------------------------------ | -------------------------------------------------------------------------------- |
| New initialization privacy tests     | PASS — 2/2                                                                       |
| Full Vitest                          | PASS — 1189/1189, 193/193 files, 37.77 s; includes four new infrastructure tests |
| Initial scoped ESLint and typecheck  | PASS before the second test file was added                                       |
| Full format, lint, typecheck         | PASS — exit 0; lint uses zero-warning gate                                       |
| Build                                | PASS — exit 0, 24/24 static pages; not a staging-configured build                |
| Local migration history              | PASS — repository 24, applied 24; no missing/extra/renamed migrations            |
| Local Prisma validate/generate       | PASS — Client 7.9.1                                                              |
| Local DB/RLS                         | PASS — 237 tests, 18 files, exit 0                                               |
| Pilot and canonical browser journeys | NOT RUN in this takeover                                                         |
| Staging exact-SHA acceptance         | BLOCKED pending verified test identities/access                                  |
| Brain/Kimi live                      | NOT RUN; model credentials not present in current process                        |

Vite reports a future native config-loader compatibility warning for the current TypeScript/CommonJS configuration. The present suite succeeds; no suppression or toolchain change applied.

## Historical checkpoint 1 — environment and release blockers (superseded above)

- Docker daemon was initially unavailable; Docker Desktop started successfully (engine 29.6.2). Existing local Supabase and its complete migration history were used. No reset, migration application or remote DB operation performed.
- Staging A/B test credentials and Preview bypass credential are absent from the current process. User confirmed the dedicated accounts are no longer available. Exact-SHA staging acceptance is BLOCKED; restoring access or provisioning new dedicated accounts through an authorized administrative channel is required. No account was guessed, reset or created remotely.
- No finalization Preview has been deployed; no staging acceptance can be attributed to this working tree.
- Fresh npm audit: 0 critical, 4 high, 0 moderate/low (`prisma`, `@prisma/config`, `deepmerge-ts`, `mysql2`). No dependency change. Historical tooling-risk acceptance does not mean these advisories are resolved; release reachability/acceptance review remains required.
- Clean-SHA/clean-clone reproducibility, full UX acceptance, remaining security review and production migration compatibility remain unverified.
- Build regenerated the `root-params.d.ts` import in `next-env.d.ts`; only that generated import was reverted to preserve the source baseline. It is not part of the privacy patch. Final typecheck is rerun afterward.
- This checkpoint pauses at the user-confirmed external-access blocker, not at completion of the A–Z work. No push, Preview deployment or production operation has occurred.

## Release safeguards and provisional rollback plan

- No new migration or dependency change in the current patch.
- Production diff is not yet fully audited; no final production migration plan is approved.
- Before any production release, record current production deployment, exact candidate SHA, applied migration inventory and compatibility, backup/restore readiness, and a tested rollback target.
- Rollback must use a previously verified deployment only if its schema remains compatible; never assume an application rollback reverses a migration.
- Production deployment requires separate explicit user authorization. No release-ready claim until exact-SHA staging evidence and all required gates exist.
