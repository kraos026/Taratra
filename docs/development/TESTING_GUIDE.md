# Testing Guide

Status: **Implemented**

| Test layer     | Primary evidence                                            |
| -------------- | ----------------------------------------------------------- |
| Domain         | invariants, lifecycle matrices, Value Objects, determinism  |
| Application    | orchestration, port calls, transactions, idempotency        |
| Infrastructure | mapping, persistence adapters, rollback and outbox behavior |
| Interface      | validation, permissions, response mapping and components    |
| PostgreSQL     | constraints, triggers, RLS and cross-tenant denial          |
| Architecture   | forbidden imports, missing providers and circular wiring    |

Never disable a test or weaken TypeScript/ESLint to obtain a green build.
