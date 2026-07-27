# 🤖 AI Entry Point

This is the primary context document for AI assistants.

Read this document BEFORE reading the source code.

Then continue with:

1. docs/ARCHITECTURE.md
2. docs/PROJECT_STATE.md
3. docs/ROADMAP.md
4. docs/VISION.md

# CODEX_CONTEXT.md

> Primary context document for AI coding assistants working on AutomateX.
>
> **Read this document before making ANY modification to the repository.**
>
> If this document conflicts with implementation details, architecture decisions (ADR) or immutable contracts, the ADRs and architecture documents take precedence.

---

# Executive Summary

AutomateX is an Enterprise Intelligence & Automation Platform.

Its mission is to transform raw business knowledge into deterministic, explainable and deployable enterprise automation.

AutomateX is NOT:

- a low-code platform
- a workflow editor
- an AI chatbot
- a generic automation tool

AutomateX IS:

- an Enterprise Decision Platform
- an Enterprise Intelligence Platform
- an Automation Engineering Platform

---

# Mission

Help organizations understand themselves before automating.

The platform progressively transforms business knowledge into executable automation.

Every transformation must be:

- deterministic
- explainable
- versioned
- immutable
- traceable
- auditable

---

# Long-Term Vision

AutomateX aims to become the operating system for enterprise transformation.

Future ecosystem:

- Enterprise Intelligence
- Solution Designer
- Automation Specification
- Automation Generator
- Validation Engine
- Deployment Engine
- Monitoring Engine
- Optimization Engine
- Enterprise Simulator
- Marketplace
- SDK
- Public API
- AI Agents
- AI Cloud
- Partner Network

---

# Product Philosophy

Every feature must help the user:

1. Understand
2. Decide
3. Act

Never build features that only display information.

Every screen should lead to a business decision.

---

# Product Constitution

Non-negotiable principles.

1. Human remains in control.
2. AI explains but does not decide.
3. Business rules are deterministic.
4. Published snapshots are immutable.
5. Everything is versioned.
6. Everything is traceable.
7. Every recommendation is explainable.
8. Domain logic never belongs in infrastructure.
9. Architecture has priority over implementation speed.
10. Simplicity is a feature.

---

# Current Project Status

Current major version:

V2

Completed:

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

Current focus:

Automation Generator

Next modules:

- Validation
- Compilation
- Deployment
- Monitoring
- Optimization

---

# Canonical Pipeline

Enterprise Knowledge

↓

Adaptive Interview

↓

Process Mapping

↓

Business Analysis

↓

AI Opportunity

↓

Automation Opportunity

↓

Recommendation

↓

Solution Designer

↓

Automation Specification

↓

Automation Generator

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

Never bypass this pipeline.

---

# Architecture

Architecture Style:

- Domain Driven Design
- Clean Architecture
- Hexagonal Principles
- CQRS where useful
- Immutable Snapshots

Technology:

- NestJS
- TypeScript
- Prisma
- PostgreSQL
- Supabase
- REST API

---

# Layer Rules

Domain

Contains:

- entities
- value objects
- aggregates
- domain services
- domain events
- invariants

Must NOT:

- import Prisma
- import NestJS
- import infrastructure

---

Application

Contains:

- use cases
- orchestration
- ports
- validation
- transactions

Must NOT:

- contain business rules

---

Infrastructure

Contains:

- Prisma
- repositories
- persistence
- adapters
- HTTP integrations

Must NOT:

- own business logic

---

Presentation

Contains:

- REST
- DTOs
- Controllers

Only orchestrates requests.

---

# DDD Rules

Respect aggregate boundaries.

Never duplicate business concepts.

One canonical owner for every business entity.

Prefer Value Objects over primitives.

Always enforce invariants.

---

# Snapshot Rules

Published snapshots are immutable.

Never edit a published snapshot.

Never overwrite history.

Rebuild = new version.

---

# Explainability Rules

Every recommendation must expose:

- Why
- Evidence
- Rules
- Confidence
- Risks
- Alternatives
- Expected ROI

No black-box decisions.

---

# AI Rules

LLMs may:

- summarize
- explain
- rewrite
- classify
- assist

LLMs must NOT:

- make deterministic business decisions
- replace business rules
- bypass validation

---

# Coding Standards

Prefer:

- composition
- small services
- explicit naming
- pure functions

Avoid:

- hidden side effects
- duplicated logic
- magic values
- circular dependencies

---

# Testing Standards

Critical domain logic requires tests.

Priority:

1. Domain
2. Application
3. Integration
4. API

---

# Repository Structure

src/

application/

domain/

infrastructure/

presentation/

docs/

adr/

tests/

---

# Read Before Coding

Always read:

1. CODEX_CONTEXT.md
2. ARCHITECTURE.md
3. PROJECT_STATE.md
4. ROADMAP.md

Then inspect the target bounded context.

Never modify multiple bounded contexts without explicit justification.

---

# Definition of Done

A feature is complete only if:

✓ Architecture respected

✓ Tests added

✓ Documentation updated

✓ No duplicated logic

✓ Explainability preserved

✓ Build passes

✓ Typecheck passes

✓ Lint passes

✓ CI passes

---

# Common Mistakes

Never:

- bypass snapshots
- duplicate entities
- place business logic in controllers
- place business logic in Prisma repositories
- use mutable published models
- create hidden coupling between bounded contexts

---

# Future Documentation

The following documents will progressively become mandatory references:

- DESIGN_PRINCIPLES.md
- PRODUCT_VISION.md
- PERSONAS.md
- USER_JOURNEYS.md
- DESIGN_SYSTEM.md
- FRONTEND_ARCHITECTURE.md
- IMPLEMENTATION_GUIDE.md

---

# Final Rule

Whenever a choice exists between:

- faster implementation

or

- better architecture

Choose better architecture.

AutomateX is designed for long-term maintainability rather than short-term speed.
