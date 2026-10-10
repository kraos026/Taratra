# Pilot data controls — local/STAGING work

MISSION: close proven data-access gaps, without changing Production.
AFFECTED DOMAIN: Company data access and account assistance.
CANONICAL OWNER: CompanyService → CompanyRepository; Supabase owns Auth.
CURRENT STATUS: partial data access, not complete account export/erasure.
FILES EXPECTED: company service/export route, settings, tests, this record.
DB IMPACT: none for profile export; no migration or remote data deletion.
SECURITY IMPACT: admin-only scoped export; explicit projection; private/no-store download.
TEST PLAN: negative membership/role/tenant tests, route validation/headers,
local DB/RLS tests with fictitious companies, existing company regressions.
OUT-OF-SCOPE: engine, ROI, Production, global purge, retention-policy adoption.

## Proven gaps at baseline b29d57c

Settings redirects to home. No dedicated downloadable company profile export.
Company DELETE is a company operation, not an account/audit/log/backup erasure;
dependencies may prevent it. Never bypass published-artifact protections to erase.

## Export contract

GET /api/companies/:id/export, only owner/admin in the resolved organization.
Includes explicit company profile fields, including archived profiles and notes.
Excludes authentication credentials, sessions, other tenants, audits/results,
provider logs and backups. Download is partial and states these limits.
Do not spread ORM objects into an export. User-supplied profile text remains
untrusted and may itself contain sensitive information; the owner must protect
the downloaded file. No claim that arbitrary user input is secret-free.

## Requests

Settings explains the partial export and links to a manual email request. Opening
an email draft does not send it, register a request or execute a deletion. No
password, token or confidential document is requested. Account erasure requires
separate coverage of Auth sessions, business dependencies, logs and backups.

## Verification status

Tests and environment evidence must be recorded after execution. LOCAL is not
STAGING, a test double is not persisted DB proof. This document is not a final
privacy notice, legal opinion, retention commitment or pilot-opening approval.

10 October local verification: 1,547 tests across 219 files PASS; typecheck,
lint and local-configured build PASS. The previous legacy redirect assertion was
replaced by assertions for the newly authorized bounded data-assistance surface.
A lint-security timing failure under concurrent build passed unchanged in isolation
and in the bounded-worker full regression. No relaxed security checks.

TARGET: local Supabase port 55022 only. PRODUCTION: NO. DISPOSABLE: only newly
created same-run fictitious fixtures. BACKUP: not needed for these new fixtures;
existing baseline data is not deleted. MIGRATION REQUIRED: NO. RLS IMPACT:
existing authenticated-role transaction retained. TENANT IMPACT: negative A/B
access tested. ROLLBACK: revert this scoped code commit, no database evolution.

STAGING: NOT RUN. Complete account/audit export and complete Auth/data/log/backup
erasure: NOT IMPLEMENTED/NOT CERTIFIED. Retention rules and provider coverage must
be established before adopting or promising a global erasure procedure. The local
profile deletion test does not prove any of these broader capabilities.

Local Playwright data-profile scenario PASS (13.1s): actual browser download,
archived-profile export, A/B refusal on read and DELETE, genuine draft-audit FK
dependency refusal (409 with data retained), then empty-profile deletion (200)
and export absence (404), with tenant B's profile preserved before its own same-run
fixture cleanup. The first fixture attempt wrongly attached an audit to an archived
company; the test now restores it first. Product guards were not modified.
