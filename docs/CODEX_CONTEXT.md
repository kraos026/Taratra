# CODEX CONTEXT

> This document is the primary context file for AI coding assistants working on AutomateX.

---

# Project Overview

AutomateX is an Enterprise Transformation Platform that converts business knowledge into deterministic automation workflows.

The platform follows a strict enterprise architecture focused on reliability, explainability, auditability and scalability.

---

# Technology Stack

- NestJS
- TypeScript
- PostgreSQL
- Prisma
- Clean Architecture
- Domain Driven Design (DDD)
- REST API
- Immutable Versioned Snapshots

---

# Current Version

Version: V2

Completed modules:

- Discovery
- Adaptive Interview
- Enterprise Knowledge
- Process Mapping
- Business Analysis
- AI Opportunity Engine
- Automation Opportunity Engine
- Recommendation Engine
- Solution Designer
- Automation Specification

Currently under development:

- Automation Generator

Planned:

- Validation Engine
- Compilation Engine
- Deployment Engine
- Monitoring
- Optimization

---

# Architecture Principles

Always preserve:

- Determinism
- Explainability
- Immutability
- Versioning
- Traceability
- Multi-tenancy
- Clean Architecture
- DDD boundaries

Never introduce shortcuts that violate these principles.

---

# Development Rules

Before modifying code:

1. Read ARCHITECTURE.md
2. Read PROJECT_STATE.md
3. Respect ADR decisions
4. Never break snapshots
5. Never bypass validation
6. Never duplicate domain logic
7. Keep domain pure
8. Infrastructure depends on Domain, never the opposite.

---

# Product Philosophy

AutomateX is not an automation tool.

It is an Enterprise Decision Platform.

Every feature must help the user:

- Understand
- Decide
- Act

---

# Decision Flow

Enterprise Knowledge

↓

Business Analysis

↓

Recommendation

↓

Solution Design

↓

Automation Specification

↓

Automation Generation

↓

Validation

↓

Compilation

↓

Deployment

↓

Monitoring

↓

Optimization

Every new feature should integrate naturally into this flow.

---

# Coding Standards

- Prefer composition over inheritance.
- Keep services small.
- Domain must remain framework independent.
- Write tests for critical logic.
- Avoid hidden side effects.
- Preserve backward compatibility whenever possible.

---

# Current Priority

Finish the Automation Generator before starting:

- Validation
- Deployment
- Monitoring

---

# Long-Term Vision

AutomateX aims to become a complete Enterprise Intelligence Platform with:

- Marketplace
- SDK
- AI Agents
- Enterprise Simulator
- AI Cloud
- Partner Ecosystem
