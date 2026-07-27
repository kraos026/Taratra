# Enterprise Simulator

Outil interne externe destiné à tester AutomateX V1 par ses API publiques.

Cette PR contient uniquement l'architecture, les contrats, les schémas, la proposition de
catalogues et le plan de tests. Elle ne contient ni moteur de génération, ni client HTTP
opérationnel, ni scénario exécutable.

Référence : [architecture](../../ENTERPRISE_SIMULATOR_ARCHITECTURE.md).

## Frontière

Le futur package ne pourra importer aucun module sous `src/`, aucun client Prisma et aucun
adaptateur Supabase Database. Il ne sera pas une dépendance du runtime AutomateX.

## Structure prévue

```text
tools/enterprise-simulator/
├── src/
│   ├── domain/
│   ├── application/
│   ├── infrastructure/
│   ├── scenarios/
│   ├── generators/
│   ├── actors/
│   ├── ground-truth/
│   ├── adapters/
│   ├── validators/
│   ├── scoring/
│   ├── reporting/
│   └── cli/
├── fixtures/
├── schemas/
├── contracts/
├── catalogs/
├── tests/
└── reports/
```

Les dossiers d'implémentation seront créés uniquement dans la PR 2 après Architecture Review.
