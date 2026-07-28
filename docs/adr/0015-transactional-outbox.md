# ADR-0015 — Transactional Outbox

Status: **Implemented**

## Context

Publishing a domain event outside the aggregate transaction risks lost or inconsistent events.

## Decision

Domain events are appended to an outbox in the same transaction as aggregate and idempotency
writes. External dispatch is separate and marks messages published after successful delivery.

## Consequences

Commit guarantees event durability. Consumers must tolerate duplicate delivery. Automation
Generator currently implements storage operations only; an external publisher is Planned.
