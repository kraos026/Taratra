# ADR-0018 — Multi-tenancy Defense in Depth

Status: **Implemented**

## Context

Application filters alone cannot guarantee enterprise tenant isolation.

## Decision

Tenant isolation combines authenticated context, role permissions, `organization_id` repository
filters, composite constraints and PostgreSQL RLS. Prisma transactions adopt the authenticated
database role.

## Consequences

Every new tenant-owned table requires RLS, grants and cross-tenant tests. Service-role bypass is
not an authorization mechanism.
