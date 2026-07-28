# ADR-0014 — CQRS Application Boundary

Status: **Implemented**

## Context

Mutations require lifecycle, transaction and idempotency guarantees that reads do not.

## Decision

Commands and Queries use separate models and use cases. Commands orchestrate one transactional
mutation through ports. Queries read without domain transitions. Neither model is an HTTP DTO.

## Consequences

Interface concerns stay outside Application and command failure behavior can be tested in
isolation.
