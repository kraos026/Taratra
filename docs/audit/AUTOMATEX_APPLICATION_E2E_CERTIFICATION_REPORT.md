# AutomateX P0.5 / P0.6 Application E2E Certification Report

Classification: **HISTORICAL SNAPSHOT — NOT CURRENT RELEASE VERDICT**

Date: 2026-08-20
Target: local AutomateX application + local Supabase
Database target: LOCAL
Supabase target: LOCAL
Production: NO
Disposable local environment: YES
Remediation performed: NO

## Executive verdict

P0.5 / P0.6 verdict: FAIL

Global verdict: RED — NOT READY

The certification cannot proceed to the Tenant A advanced journey because the authentication/protected-route gate fails first.

## Environment

The certification was executed against local Supabase and local AutomateX only. No remote staging or production database was targeted.

Required runtime variables were provided through the shell process for this local run. No `.env` file was modified.

| Variable                                         | Status  |
| ------------------------------------------------ | ------- |
| `DATABASE_URL`                                   | PRESENT |
| `DIRECT_URL`                                     | PRESENT |
| `NEXT_PUBLIC_SUPABASE_URL`                       | PRESENT |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`                  | PRESENT |
| `SUPABASE_SERVICE_ROLE_KEY`                      | PRESENT |
| `PLAYWRIGHT_BASE_URL` / `AUTOMATEX_E2E_BASE_URL` | PRESENT |

Binding:

| Check                  | Result |
| ---------------------- | ------ |
| Database target        | LOCAL  |
| Supabase target        | LOCAL  |
| Production isolation   | PASS   |
| Disposable environment | YES    |

## Local application start

| Check                      | Result | Evidence                                                                    |
| -------------------------- | ------ | --------------------------------------------------------------------------- |
| App server starts          | PASS   | Next dev server ready on `localhost:3000`                                   |
| `/login` route renders     | PASS   | HTTP 200 after route compilation                                            |
| Anonymous `/api/companies` | PASS   | HTTP 401                                                                    |
| Anonymous `/api/audits`    | PASS   | HTTP 401                                                                    |
| Local DB bound             | PASS   | Process launched with local DB URL from local Supabase status               |
| Local Auth bound           | PASS   | Process launched with local Supabase API URL/key from local Supabase status |

## Tenant A / Tenant B setup

Two local Supabase Auth users, two organizations, and two companies were created in the disposable local database for certification.

| Entity         | Result  |
| -------------- | ------- |
| User A         | CREATED |
| Organization A | CREATED |
| Company A      | CREATED |
| User B         | CREATED |
| Organization B | CREATED |
| Company B      | CREATED |

Credentials were stored only in a temporary local file for the test process and were not committed or printed.

## Authentication / authorization gate

| Check                             | Result  | Details                                                                                                     |
| --------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------- |
| Anonymous protected page redirect | FAIL    | `GET /companies` rendered page with HTTP 200 instead of redirecting to `/login`                             |
| Anonymous API rejection           | PASS    | `/api/companies` and `/api/audits` return 401                                                               |
| Login UI through harness          | FAIL    | Playwright waits for `getByLabel("email")`; login inputs have placeholders but no matching accessible label |
| Session persistence               | BLOCKED | Login harness cannot complete                                                                               |
| Logout                            | BLOCKED | Login harness cannot complete                                                                               |
| Direct authenticated API access   | BLOCKED | Login harness cannot establish browser session                                                              |
| Organization membership           | BLOCKED | Browser session not established                                                                             |
| Wrong tenant access               | BLOCKED | Browser session not established                                                                             |

Root causes observed:

1. No application `middleware.ts` / `proxy.ts` file is present to enforce protected-route redirects for `/companies`.
2. The login form fields do not expose accessible labels expected by the existing Playwright harness (`email`, `password`).

No automatic remediation was applied.

## Tenant A application flow

The Tenant A application flow is blocked at authentication. The later stages were not certified because PASS requires real data continuity from the previous step.

| Step                     | UI route                            | API used                                               | DB object created     | Status                      | Result  | Failure reason                    |
| ------------------------ | ----------------------------------- | ------------------------------------------------------ | --------------------- | --------------------------- | ------- | --------------------------------- |
| Organization             | `/onboarding` / existing membership | `create_first_organization` or seeded local membership | Organization A exists | Not reached through browser | BLOCKED | Login/protected-route gate failed |
| Company                  | `/companies`, `/companies/[id]`     | `/api/companies`                                       | Company A exists      | Not reached through browser | BLOCKED | Login/protected-route gate failed |
| Audit                    | `/audits` / company audit routes    | `/api/audits`                                          | Not certified         | Not reached                 | BLOCKED | Login/protected-route gate failed |
| Discovery                | `/companies/[id]/discovery`         | `/api/companies/[id]/discovery`                        | Not certified         | Not reached                 | BLOCKED | Login/protected-route gate failed |
| Interview                | `/companies/[id]/interview`         | `/api/companies/[id]/interviews`                       | Not certified         | Not reached                 | BLOCKED | Login/protected-route gate failed |
| Enterprise Knowledge     | company knowledge routes            | `/api/companies/[id]/knowledge-snapshots`              | Not certified         | Not reached                 | BLOCKED | Login/protected-route gate failed |
| Process Map              | company process-map routes          | `/api/companies/[id]/process-maps`                     | Not certified         | Not reached                 | BLOCKED | Login/protected-route gate failed |
| Business Analysis        | analysis routes                     | analysis APIs                                          | Not certified         | Not reached                 | BLOCKED | Login/protected-route gate failed |
| AI Opportunities         | AI opportunity routes               | AI opportunity APIs                                    | Not certified         | Not reached                 | BLOCKED | Login/protected-route gate failed |
| Automation Opportunities | automation opportunity routes       | automation opportunity APIs                            | Not certified         | Not reached                 | BLOCKED | Login/protected-route gate failed |
| ROI                      | ROI routes                          | ROI APIs                                               | Not certified         | Not reached                 | BLOCKED | Login/protected-route gate failed |
| Recommendations          | recommendation routes               | recommendation APIs                                    | Not certified         | Not reached                 | BLOCKED | Login/protected-route gate failed |
| Solution Blueprint       | solution blueprint routes           | solution blueprint APIs                                | Not certified         | Not reached                 | BLOCKED | Login/protected-route gate failed |
| Automation Specification | automation specification routes     | automation specification APIs                          | Not certified         | Not reached                 | BLOCKED | Login/protected-route gate failed |
| Executive Result         | decision center / results routes    | decision center / result APIs                          | Not certified         | Not reached                 | BLOCKED | Login/protected-route gate failed |

Executive Result reached: NO

## Refresh persistence

Refresh persistence was not certified because the authenticated Tenant A journey did not reach a persisted Executive Result.

| Check                                           | Result  |
| ----------------------------------------------- | ------- |
| Company persists after refresh                  | BLOCKED |
| Audit persists after refresh                    | BLOCKED |
| Discovery persists after refresh                | BLOCKED |
| Knowledge / Process Map persist after refresh   | BLOCKED |
| ROI / Recommendations persist after refresh     | BLOCKED |
| Executive Result remains coherent after refresh | BLOCKED |

Refresh persistence: BLOCKED

## Tenant B denial / IDOR-BOLA

Tenant B denial was not certified at the application/browser layer because Tenant A could not complete login and produce certifiable browser-session resources for direct access attempts.

Database-layer cross-tenant isolation remains certified by P0.4 pgTAP/RLS, but this P0.5/P0.6 gate requires application-layer browser/API proof.

| Check                       | Result  |
| --------------------------- | ------- |
| Tenant B read denial        | BLOCKED |
| Tenant B write denial       | BLOCKED |
| IDOR/BOLA application layer | BLOCKED |

## Playwright certification

The repository harness discovers 11 tests in 10 files.

Because the bundled Playwright Chromium browser was missing, a temporary non-repo Playwright config was used to run with system Chrome and no video/trace dependency. This did not modify the product or the committed harness.

The run was stopped after repeated auth-gate failures/timeouts; no product remediation was performed.

| Test file                  | Test name                                                               | PASS | FAIL | SKIP | Duration / outcome                               | Trace/screenshot            |
| -------------------------- | ----------------------------------------------------------------------- | ---: | ---: | ---: | ------------------------------------------------ | --------------------------- |
| `ask-automatex.spec.ts`    | Ask AutomateX remains grounded and rejects out-of-scope questions       |    0 |    1 |    0 | Timed out at login/session precondition          | Not retained in temp config |
| `auth.spec.ts`             | protected route rejects an anonymous browser                            |    0 |    1 |    0 | 17.4s; `/companies` did not redirect to `/login` | Error context available     |
| `auth.spec.ts`             | Tenant A authenticates and receives a session-backed companies response |    0 |    1 |    0 | 45.1s; `getByLabel("email")` not found           | Error context available     |
| `company.spec.ts`          | Tenant A company journey uses real API data                             |    0 |    1 |    0 | Timed out at login/session precondition          | Not retained in temp config |
| `decision-center.spec.ts`  | eligible real company exposes the production decision center            |    0 |    1 |    0 | Timed out at login/session precondition          | Not retained in temp config |
| `discovery.spec.ts`        | Discovery loads through the existing company-scoped route               |    0 |    1 |    0 | Timed out at login/session precondition          | Not retained in temp config |
| `evidence.spec.ts`         | evidence request and bounded evidence submission use durable routes     |    0 |    1 |    0 | Timed out at login/session precondition          | Not retained in temp config |
| `idempotency.spec.ts`      | evidence request retry remains bounded and observable                   |    0 |    0 |    0 | Not completed after gate failure                 | Not available               |
| `interview.spec.ts`        | Interview loads through the existing company-scoped route               |    0 |    0 |    0 | Not completed after gate failure                 | Not available               |
| `stale-state.spec.ts`      | Decision Center reload reads current persisted state                    |    0 |    0 |    0 | Not completed after gate failure                 | Not available               |
| `tenant-isolation.spec.ts` | Tenant A cannot use a Tenant B company identifier                       |    0 |    0 |    0 | Not completed after gate failure                 | Not available               |

Playwright aggregate:

- Tests discovered: 11
- Pass: 0
- Fail observed before stop: 7
- Skip: 0
- Not completed: 4

## Files modified during this gate

Audit report only:

- `docs/audit/AUTOMATEX_APPLICATION_E2E_CERTIFICATION_REPORT.md`

No product logic, migrations, RLS, Prisma schema, or Prisma config changes were made during this gate.

## Final decision

P0.5 / P0.6 verdict: FAIL

Global verdict: RED — NOT READY

Next action:

Fix the authentication/protected-route gate first, with explicit authorization:

1. Add/restore application route protection so anonymous `/companies` redirects to `/login`.
2. Make the login form accessible to the existing harness, e.g. labels or `aria-label` for email/password.
3. Rerun P0.5 auth gate before attempting the full Tenant A journey.
