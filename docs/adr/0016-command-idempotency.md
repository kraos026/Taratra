# ADR-0016 — Command Idempotency

Status: **Implemented**

## Context

Network retries must not duplicate a mutation.

## Decision

Mutating commands reserve an idempotency key scoped by tenant and command with a canonical payload
fingerprint. Identical completed retries replay the stored result. Reuse with a different
fingerprint conflicts. Reservation, mutation and completion share one transaction.

## Consequences

Callers receive deterministic retry behavior and partial commands roll back.
