# Coding Standards

Status: **Implemented**

- Use strict TypeScript and validate all unknown runtime data.
- Keep Domain objects immutable where practical.
- Put invariants in Domain, orchestration in Application and technology in Infrastructure.
- Use explicit ports at boundaries.
- Keep functions focused and names behavior-oriented.
- Do not use `eval`, arbitrary scripts or hidden business constants.
- Do not expose secrets or service credentials.
- Update documentation and tests with behavior or architecture changes.
