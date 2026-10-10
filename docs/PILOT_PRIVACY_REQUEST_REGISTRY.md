# Personal data request registry

MISSION: register and track access/correction/deletion requests, no automatic purge.
AFFECTED DOMAIN: account data access, not the audit decision engine.
CANONICAL OWNER: authenticated account identity; dedicated privacy request service.
CURRENT STATUS: PARTIAL until local and STAGING persistence/isolation verified.
FILES EXPECTED: additive Supabase migration, Prisma mapping, service/API, settings
form, unit/RLS/browser tests.
DB IMPACT: new table only; no existing audit data changed or erased.
SECURITY IMPACT: self-only reads/inserts; no tenant-admin access to others' requests.
TEST PLAN: validation, retries, actor spoofing, foreign tenant AND same-tenant other
user denied, status tampering denied, persistence/refresh, local manual response.
OUT-OF-SCOPE: Production, automated deletion, retention deadlines, email sending,
legal-compliance claims, full account export, Jev or canonical engine changes.

TARGET: LOCAL first, additive STAGING only after validation. PRODUCTION: NO.
DISPOSABLE: synthetic local requests only. BACKUP: existing local fixture lifecycle.
MIGRATION REQUIRED: YES, Supabase owns it. RLS IMPACT: new self-only policies.
TENANT IMPACT: live membership for creation; user identity owns requests regardless
of later membership changes, so loss of workspace access does not hide own request.
ROLLBACK: disable new UI/API; retain requests, no destructive rollback.

Requests concern the signed-in account. Describe desired scope without passwords,
tokens or confidential documents. A received request is not identity verification,
agreement to erase shared business data, execution, or a guaranteed response time.
No automatic email notification. The responsible operator must review the registry
through privileged, approved server-side access; tenant roles cannot process it.

Statuses: RECEIVED, IN_REVIEW, NEEDS_INFORMATION, COMPLETED, DECLINED. A public
response must accompany completion/refusal and describe execution and exclusions;
COMPLETED means request handling completed, not necessarily full deletion.
Operator access/update UI is not exposed to ordinary tenant administrators. Manual
operator processing requires a separate authorized workflow, accountable review
and a clear public response. No erasure occurs from any status transition.

Before any deletion: verify account control, agree scope, check shared tenant data,
audit dependencies, Auth sessions, logs/backups/providers and applicable retention.
Never infer a retention schedule or legal basis from the software. Existing account
deletion remains blocked until a safe, separately authorized procedure exists.

## Implementation evidence — 2026-10-10

LOCAL: build and two browser journeys PASS; 1,590 unit tests / 224 files PASS.
RLS: 262 assertions / 19 files PASS, including 13 registry assertions. Local
security advisors reported no issues. These are working-tree checks, not a
clean-clone whole-product certification.

PRODUCT BUG found in browser testing: Prisma.create writes default columns and
violates the narrow INSERT grant (SQLSTATE 42501). Fixed using parameterized SQL
with only the five allowed input columns, returning only customer-visible fields.
No status/response/timestamp write privileges were granted to authenticated users.
An initial full-unit run timed out scanning source files during concurrent build;
the unchanged suite passed when rerun alone. No timeout or security gate weakened.

STAGING additive migration applied via Supabase MCP, version 20261010120653.
The previously uncommitted CLI-generated local version 20261010114956 is renamed
to the actual remote version. Only this local history entry is aligned; no remote
history rewriting, no older migration changes, no reset and no existing data edits.
Authenticated STAGING creation/refresh/isolation remains NOT RUN until Preview
and a user-controlled test session are available. Production remains unchanged.
