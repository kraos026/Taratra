# ADR-0013 — Clean Architecture

Status: **Implemented**

## Context

AutomateX contains multiple independent business engines and technology adapters.

## Decision

Each bounded context separates Domain, Application, Infrastructure, Interfaces and, where needed,
Composition. Dependencies point inward. Domain contains business behavior and has no framework or
database dependency.

## Consequences

Ports isolate technology. More mapping code is accepted in exchange for testability and stable
business boundaries.
