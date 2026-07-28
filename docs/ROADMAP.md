# AutomateX Roadmap

Last verified: 2026-07-28.

## Implemented

- V1 Foundation through Recommendation Portfolio;
- Executive Report v1;
- V2 Solution Designer;
- V2 Automation Specification;
- Automation Generator Domain, Application, Infrastructure and Composition Root.

## In Progress

### Automation Generator

Implemented layers are wired and tested. Remaining scope:

- real deterministic `GenerationCompiler`;
- complete persistence mapping for generated canonical graphs;
- public REST interface and transport validation;
- integration tests for the completed generation flow.

No workflow-provider artifact, deployment or execution belongs to this scope.

## Planned

1. Sandbox Validation;
2. Platform-specific compilation;
3. controlled Deployment Engine;
4. Monitoring Engine;
5. Optimization Engine;
6. Executive Report evolution consuming V2 outputs;
7. Enterprise Simulator as a separate internal tool, subject to its own approved implementation
   roadmap.

Every Planned bounded context requires an architecture contract, ADRs, threat analysis, tests and
an explicit approval before implementation.
