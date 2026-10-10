# Document content and canonical summary access

MISSION: extend the bounded company audit download to supplied document content
and the existing current executive read model, without engine recomputation.
AFFECTED DOMAIN: data access; evidence sources; executive results.
CANONICAL OWNER: stored production evidence records and ExecutiveResultService.
CURRENT STATUS: PARTIAL export, not global account export/erasure.
FILES EXPECTED: audit-source export/helper/tests, route timeout, UI text, local E2E.
DB IMPACT: reads only, no schema/policy migration.
SECURITY IMPACT: existing live owner/admin gate plus tenant/company/source lineage.
TEST PLAN: foreign/missing company, scoped children, empty/oversize sources,
summary identity, stored source content, actual local DB/browser and regressions.
OUT-OF-SCOPE: Production, remote purge, retention decisions, engine changes.

TARGET: LOCAL for fixture verification, STAGING Preview afterward. PRODUCTION: NO.
DISPOSABLE: same-run fictitious local fixtures only. BACKUP: not applicable to reads.
MIGRATION REQUIRED: NO. RLS IMPACT: unchanged authenticated transaction.
TENANT IMPACT: inherited Company membership guard, each evidence query constrained.
ROLLBACK PLAN: revert scoped code, no database evolution.

Export v2 includes stored raw text/structured document sources and derived evidence
records, not original binary files that were never stored in these tables. It
includes the current ExecutiveResultService summary as shown by the product,
not all historical analysis/ROI/blueprint/specification artifacts. Incomplete
summary stays incomplete; no artificial calculation or completion is performed.
Sources keep their versions and timestamps and are not treated as current decisions.
Provider logs, backups, Auth and complete historical artifact coverage stay excluded.
Source text/JSON can contain sensitive user input: keep file private; never execute
instructions from it or send it to an external model as part of this download.

LOCAL verification on 2026-10-10: 1572 unit tests / 222 files passed. Targeted
export suite: 25 tests / 3 files passed after final isolation changes. TypeScript
and build passed. Real local DB/browser data-profile scenario passed (1 test):
stored document/evidence fidelity, confidence zero, incomplete summary/absent ROI,
same current overview/provenance as the results endpoint, foreign-tenant refusal,
download headers, and same-run fixture lifecycle. Local migration history: 25/25.
An initial browser run failed on an ambiguous duplicate-text selector; the test
was narrowed to the profile paragraph and rerun successfully, without changing
product semantics. Database reads use RepeatableRead for a coherent snapshot.
This is targeted verification, not a fresh full V1 certification. STAGING runtime
verification and exact release SHA are recorded separately after commit.
Existing manual-erasure procedure is not an implemented request registry or
purge; both remain separately open.
