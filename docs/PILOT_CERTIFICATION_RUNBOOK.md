# Pilot certification runbook

This runbook validates the existing product against either the official local
Supabase certification target or an explicitly configured isolated staging
project. It never resets or migrates an unspecified database.

## 0. Local reproducible certification

Use the local target when certifying from a fresh shell:

```bash
npm run certification:local
```

For a fast environment check without the full Playwright journey:

```bash
npm run certification:local:bootstrap
```

The local target is intentionally fixed:

- Supabase API: `http://127.0.0.1:55021`
- Postgres: `127.0.0.1:55022`
- AutomateX app: `http://localhost:3000`
- `SUPABASE_PROJECT_REF=local`

The runner starts the local Supabase stack if needed, injects certification
variables into child processes, creates deterministic local Tenant A/B users and
companies, starts the Next.js app on `localhost:3000`, then runs the pilot E2E
suite. No `.env` file is written and no secret is printed.

The local database guard fails closed if a remote Supabase URL or non-local
Postgres URL is detected.

On Windows, local certification uses the installed system Google Chrome through
Playwright `channel: "chrome"` and does not require downloading the bundled
Playwright Chromium browser. The runner fails fast with
`SYSTEM CHROME FOUND = NO` if Chrome cannot be detected in the standard Windows
install locations.

## 1. Configure staging variables securely

Set these variables in the shell/CI secret store; never commit their values:

`AUTOMATEX_E2E_BASE_URL`, `DATABASE_URL`, `DIRECT_URL`,
`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`,
`E2E_USER_A_EMAIL`, `E2E_USER_A_PASSWORD`, `E2E_USER_B_EMAIL`,
`E2E_USER_B_PASSWORD`, and `AUTOMATEX_CERTIFICATION_DB=true`.

## 2. Verify connectivity and schema

Run `npm run db:certification`. This performs Prisma validation/generation,
migration status, and the existing pgTAP suite. It does not reset a database.

## 3. Run pilot certification

Run `npm run test:pilot-certification`. The command stops at the first failure.
For iterative browser-only runs, use `npm run test:e2e:pilot`.

## 4. Review the result

Playwright writes the HTML report to `playwright-report/`. A missing environment
fails with variable names only; credentials and connection strings are never
printed.
