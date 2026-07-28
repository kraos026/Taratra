# Dependency Rules

Status: **Implemented**

## Allowed dependencies

| Source         | Domain | Application | Infrastructure | Interfaces | Composition |
| -------------- | :----: | :---------: | :------------: | :--------: | :---------: |
| Domain         |   ✓    |      —      |       —        |     —      |      —      |
| Application    |   ✓    |      ✓      |       —        |     —      |      —      |
| Infrastructure |   ✓    |      ✓      |       ✓        |     —      |      —      |
| Interfaces     |   ✓    |      ✓      |       —        |     ✓      |      —      |
| Composition    |   ✓    |      ✓      |       ✓        |  optional  |      ✓      |

An arrow to another bounded context is forbidden unless it targets a published, versioned contract
through an explicit port. Importing another context's repository, aggregate or Prisma model is
forbidden.

## Enforcement

- TypeScript strict compilation;
- architecture tests in bounded contexts that have explicit layer guards;
- code review of imports and transaction boundaries;
- pgTAP for database boundaries and RLS.

Repository-wide automated import graph enforcement is Planned.
