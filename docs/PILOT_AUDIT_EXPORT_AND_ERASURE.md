# Bounded audit-source access — local/STAGING tranche

MISSION: extend partial access to persisted canonical audit sources; document erasure handling.
AFFECTED DOMAIN: company data access, Discovery/Interview sources.
CANONICAL OWNER: existing Company tenant membership and canonical source tables.
CURRENT STATUS: PARTIAL; not complete account export or global erasure.
FILES EXPECTED: source export, GET route, company links/settings, tests, this document.
DB IMPACT: read only, no migration.
SECURITY IMPACT: owner/admin, live membership, authenticated transaction/RLS, explicit selects.
TEST PLAN: role/membership/tenant failures, child lineage, archive/zero/null, bounded volume,
route authentication/headers; local real DB/browser proof before Preview publication.
OUT-OF-SCOPE: engine recomputation, remote deletion, Production, retention-policy adoption.

TARGET: LOCAL; later STAGING verification only. PRODUCTION: NO.
DISPOSABLE: only explicit local same-run fixtures. BACKUP: not applicable to reads.
MIGRATION REQUIRED: NO. RLS IMPACT: existing policies unchanged.
TENANT IMPACT: every query scoped to server-resolved organization and company/session IDs.
ROLLBACK PLAN: revert this scoped code; no database changes.

## Download scope

GET /api/companies/:id/audit-export includes Discovery/Interview sessions, answers and
InterviewEvidence. All stored session versions, including archives, are sources and
not a selection of current decisions. Profile remains a separate download.
Documents/acquired evidence, derived artifacts/ROI, legacy questionnaire audits,
Auth, provider logs and backups remain excluded explicitly. No full export claim.
Maximum 1,000 records per section; overflow refuses the whole download, never truncates.
Serialized response limit 10 MiB; raw free text/JSON may contain sensitive user input.
No credentials/auth identities or blanket secret-free promise. Keep downloads private.

## Manual erasure procedure — not an automatic purge

1. Receive request through declared contact; do not ask for passwords or tokens.
2. Verify account control and requested scope; an admin cannot request erasure of
   another member's personal account merely because they own an organization.
3. Record minimal request reference, received date, scope, identity-verification
   outcome, assigned handler and status in a protected register outside Git.
   Do not put personal identifiers or request bodies in release records.
4. Inventory dependencies before any action: Auth/sessions, memberships/shared
   organization data, company, archived sources, documents, derived artifacts,
   provider logs and backups. Distinguish personal vs shared business data.
5. Document retention constraints/decision and a scoped execution plan. Request
   explicit authorization before destructive remote execution. Do not bypass
   publication guards or cascade-delete blindly. Revocation must be assessed
   separately: deleting an Auth user alone does not prove JWT invalidation.
6. After authorized execution, verify absence/inaccessibility, remaining providers
   and backup handling. Communicate what was erased and what remains with reasons.
   Close only on evidence, not on a button click or archive action.

Statuses: received → identity_pending → scope_review → awaiting_authorization →
execution_pending → verification_pending → completed_with_documented_scope.
Alternative: refused_with_reason / awaiting_external_provider. No SLA or adopted
retention deadline is invented. No actual request registered by the mailto page.

LOCAL verification: 1,565 tests / 221 files PASS; typecheck and targeted lint PASS.
Local-configured build and Playwright PASS twice; final run after functional edits
passes with genuine local Discovery session/answer, zero preserved, authenticated
download, headers and cross-tenant refusal. Only same-run fictitious fixtures removed.
No migration/RLS modification. Full account export/global erasure remains NOT CERTIFIED.
STAGING authenticated verification pending. Exact commit recorded externally after commit.
