# AutomateX Auth Gate Certification Report

Classification: **HISTORICAL SNAPSHOT / CURRENT EVIDENCE — NOT CURRENT RELEASE VERDICT**

## Scope

P0 Auth Gate remediation only.

No Brain, AI, Rule Engine, ROI Engine, Recommendation Engine, Solution Designer, Automation Generator, Work Intelligence, Executive Decision Center, migrations, RLS, Prisma schema, database schema, Git history, remote deployment, or production environment changes were made.

## Root Cause

### Protected routes

The Supabase SSR session protection logic already existed in `src/infrastructure/supabase/proxy.ts`, but no Next.js convention file (`src/proxy.ts`) was present to execute it. As a result, anonymous browser navigation to protected application pages such as `/companies` rendered the page instead of redirecting to `/login`.

### Login inputs

The login form inputs had stable `name` attributes but no accessible label or `aria-label`, so the Playwright auth helper could not reliably locate the email and password fields via `getByLabel`.

### Login hydration safety

During local dev validation, the harness initially used `127.0.0.1` while Next.js served dev assets from `localhost`, causing Next.js 16 dev-origin protection to block client hydration. When clicked before hydration, the form could fall back to native submission. The remediation keeps the submit button disabled until client hydration and sets the form method to `post` so credentials are not serialized into the URL if a pre-hydration submission occurs.

## Patch Applied

- Added `src/proxy.ts` to connect the existing `updateSession` function to Next.js proxy execution for protected application routes.
- Added accessible labels via `aria-label` on login email/password inputs.
- Added login form `method="post"`.
- Disabled the login submit button until client hydration using `useSyncExternalStore`, avoiding synchronous effect state updates.

## Auth Gate Results

- Anonymous browser `/companies`: PASS — redirected to `/login`.
- Login page form accessibility: PASS — email/password fields are accessible through labels.
- Tenant A authentication: PASS.
- Session-backed `/api/companies`: PASS — HTTP 200.
- Session-backed `/api/audits`: PASS — HTTP 200.
- Session after refresh: PASS — authenticated route survived reload.
- Logout: PASS — `POST /auth/logout` returned 200 and subsequent `/companies` navigation redirected to `/login`.
- Membership/onboarding guard: PASS — authenticated Tenant A reached `/` rather than `/onboarding`.
- Tenant isolation: PASS — Tenant B list excluded Tenant A company and direct Tenant A company access returned 404.

## Validation Notes

The official Playwright browser bundle is not currently installed completely in this Windows environment. Targeted browser validation used the installed system Chrome executable through a temporary Playwright config outside the repository.

The local Next.js dev server must be accessed as `http://localhost:3000` rather than `http://127.0.0.1:3000`, otherwise Next.js 16 blocks dev-origin client resources by design.

## Commands Executed

- `npm run typecheck` — PASS.
- `npm run lint` — PASS.
- `npm run build` — PASS.
- `npm test -- src/app/auth/logout/route.test.ts src/modules/auth/presentation/auth-actions.test.ts` — PASS, 5 tests.
- Targeted Playwright auth slice `tests/e2e/pilot/auth.spec.ts` — PASS, 2 tests.
- Targeted auth/data script — PASS for `/api/companies`, `/api/audits`, refresh, logout, and Tenant B isolation.

## Format

Targeted Prettier check for modified source files passed.

Global `npm run format:check` remains blocked by pre-existing audit report formatting warnings under `docs/audit/`, unrelated to this patch.

## Final Decision

AUTOMATEX AUTH GATE — PASS
