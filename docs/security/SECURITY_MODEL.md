# Security Model

Status: **Implemented**

Security uses defense in depth:

1. Supabase Auth establishes identity.
2. Application permissions restrict operations by role.
3. Tenant identifiers scope repository queries.
4. Composite constraints prevent cross-tenant references.
5. PostgreSQL RLS restricts rows under the authenticated role.
6. Validation rejects malformed runtime data.
7. Secrets remain outside source and domain snapshots.

Roles currently used are owner, admin, consultant and viewer. Viewer access is read-only. Exact
mutation and publication permissions remain context-specific and are tested in API/pgTAP suites.
