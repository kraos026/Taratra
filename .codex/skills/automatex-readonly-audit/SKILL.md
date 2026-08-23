---
name: automatex-readonly-audit
description: Perform forensic/read-only AutomateX audits. Use when asked to inspect, audit, map, classify, inventory, compare, or report without modifying files, databases, migrations, Git history, Supabase, Vercel, dependencies, or product behavior.
---

# AutomateX Read-only Audit

## Hard rules

- Do not edit files.
- Do not generate files unless explicitly requested.
- Do not run migrations.
- Do not change packages.
- Do not commit.
- Do not write to any database.
- Do not modify remote Supabase or Vercel.

## Evidence language

Classify findings as:

- PROVEN: directly observed in source, config, logs, test output, DB read-only query, or Git history.
- LIKELY: strongly inferred but not fully proven.
- UNKNOWN: insufficient evidence.

## Status language

Classify capabilities as:

- ACTIVE
- PARTIAL
- SHADOW
- LEGACY
- DEAD
- UNWIRED
- EXPERIMENTAL

## Audit workflow

1. Identify branch, SHA, and dirty worktree state.
2. Inspect routes, modules, DB schema, migrations, tests, scripts, docs, and env names.
3. Separate product code, lab code, certification harness, documentation, and generated artifacts.
4. Report gaps without remediation unless separately authorized.
