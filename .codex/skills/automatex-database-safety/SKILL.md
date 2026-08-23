---
name: automatex-database-safety
description: Govern safe AutomateX Supabase, Postgres, Prisma, migration, RLS, and tenant-isolation work. Use before database inspection, migration, reset, RLS change, Prisma mapping change, certification DB work, or staging/production data operation.
---

# AutomateX Database Safety

## Environment rules

- LOCAL: destructive operations are allowed only when explicitly certification/disposable.
- STAGING: never reset unless explicitly authorized and proven disposable.
- PRODUCTION: no destructive action.

## Ownership

- Supabase migrations are the schema source of truth.
- Prisma is the application mapping/client, not the migration owner.
- Required migrations must be committed with their related product change.
- Untracked migration files mean the feature is not complete.

## Before DB change, report

```text
TARGET:
PRODUCTION?
DISPOSABLE?
BACKUP?
MIGRATION REQUIRED?
RLS IMPACT?
TENANT IMPACT?
ROLLBACK PLAN?
```

## Safety rules

- Never reveal secrets or full connection strings.
- Never weaken RLS to make a test pass.
- Never perform destructive remote database operations without explicit approval.
- Preserve tenant keys and lineage.
- Prefer read-only proof before remediation.
- Local PASS does not imply staging PASS, and staging PASS does not imply production PASS.
