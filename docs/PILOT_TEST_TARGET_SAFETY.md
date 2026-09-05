# Pilot test target safety

The pilot Playwright suite creates and updates test data. It is not a Production smoke suite.

Local runs require the local Supabase Auth service on port 55021 and PostgreSQL on port 55022. A local application paired with a remote database is rejected.

For staging, the release operator must first inspect the deployment in Vercel and verify:

- its target is Preview, not Production;
- its source SHA is the intended clean release;
- its application environment points only to staging Supabase `ajvncwsazrhqjlktzojm`.

Only then supply these process variables (never commit credentials):

- `AUTOMATEX_E2E_TARGET=staging`
- `AUTOMATEX_E2E_BASE_URL`: the exact inspected deployment origin
- `AUTOMATEX_E2E_PREVIEW_URL`: the same inspected origin
- staging `NEXT_PUBLIC_SUPABASE_URL`, `DATABASE_URL`, and `DIRECT_URL` if used
- the existing staging user credentials and Preview protection credential

The duplicated origin is an explicit operator selection, not independent proof of Vercel deployment metadata. A `.vercel.app` hostname alone does not prove Preview: Production also uses that suffix. The old `AUTOMATEX_E2E_ALLOW_PRODUCTION` escape hatch no longer authorizes this mutating suite.

Canonical local certification now checks Tenant B with an authenticated browser/API context before and after publication. Knowledge counts are scoped to the current organization and snapshot, never historical global totals. Readiness requires every expected HTTP status and content type to match.
