# ADR-0020 — Explicit Composition Roots

Status: **Implemented**

## Context

Use cases require many ports, and ad hoc construction can omit or duplicate bindings.

## Decision

Complex bounded contexts expose an explicit Composition Root that binds exactly one implementation
per required port and constructs use cases. The Composition Root contains no business behavior.

## Consequences

Provider completeness and dependency direction are architecture-testable. Automation Generator is
the first context with the explicit `composition/` layer.
