# Naming Conventions

Status: **Implemented**

- Aggregates and Value Objects: singular PascalCase (`AutomationGeneration`, `TenantId`).
- Commands: imperative PascalCase ending in `Command`.
- Queries: `Get...Query` or an equally explicit read intent.
- Ports: capability name ending in `Port`.
- Infrastructure adapters: technology plus capability (`Prisma...Repository`).
- Domain events: past tense fact (`AutomationGraphPublished`).
- Database tables and columns: plural/singular snake_case according to existing schema conventions.
- Branches: `feat/`, `fix/`, `docs/` followed by a concise kebab-case scope.
