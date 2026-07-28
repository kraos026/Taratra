# API Documentation

Status: **In Progress**

Implemented REST routes live under `src/app/api`. Engine documents list their current endpoints.
There is not yet one generated OpenAPI contract for the whole platform.

Rules:

- validate input at the interface boundary;
- authenticate and authorize tenant membership;
- invoke Application use cases;
- map known domain/application errors consistently;
- never place business logic in a route;
- never access Prisma directly when a bounded-context port exists.

Planned: consolidated endpoint catalog and generated OpenAPI specification.
