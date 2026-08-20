# Pilot certification runbook

This runbook validates the existing product against an isolated staging
Supabase project. It never resets or migrates an unspecified database.

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
