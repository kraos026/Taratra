# AutomateX — État du projet

Dernière mise à jour : 2026-07-26

Ce document décrit l'état réellement présent dans `main`. Il ne remplace pas les décisions
d'architecture de `docs/adr`, la vision ni la roadmap.

## Livré

### Sprint 1 — Foundation

- Supabase Auth et onboarding transactionnel organisation/owner ;
- architecture SaaS multi-tenant et politiques RLS ;
- PostgreSQL géré par migrations Supabase ;
- accès serveur typé avec Prisma sous contexte RLS ;
- Next.js, Tailwind CSS et composants UI ;
- ESLint, Prettier, TypeScript strict, Vitest et GitHub Actions.

### Sprint 2 — Audit Engine foundation

- questionnaires, versions, sections et questions ;
- sessions d'audit, réponses, progression, complétion et validation ;
- API REST, UI et isolation multi-tenant.

### Sprint 3 — Executive Report Layer v1

- `ReportBuilder` et contrat `AuditReport` ;
- dashboard, KPI, graphiques et résumé déterministe ;
- export JSON par API ;
- projection des résultats persistés sans recalcul des moteurs.

### Sprint 4 — Enterprise Discovery Engine

- bounded context Discovery ;
- profil d'entreprise et entités associées normalisés ;
- sessions versionnées, cycle de vie et verrouillage optimiste ;
- wizard en six étapes, reprise, autosave et validation ;
- API REST, projection Prisma, migration Supabase et tests pgTAP ;
- Discovery déclaré source canonique des informations opérationnelles d'entreprise.

### Sprint 5 — Adaptive Interview Engine

- catalogue déterministe et branchements contextuels ;
- sessions, réponses, décisions, preuves et timeline ;
- progression, confiance et readiness Process Mapping ;
- API REST, wizard et isolation multi-tenant ;
- consommation de Discovery validée sans duplication.

## Composants préexistants à réaligner

Le dépôt contient des implémentations fonctionnelles v1 de Rule Engine, ROI et Recommendation.
Elles restent testées et utilisables par le Report v1, mais ne signifient pas que les Sprints 7,
10 et 11 de la roadmap officielle sont livrés. Leur migration, adaptation ou remplacement exigera
un ADR au début du sprint concerné.

## En cours

- Sprint 6 Business Process Intelligence, phase Process Mapping ;
- consommation exclusive des snapshots Enterprise Knowledge `ready` ;
- patterns et Process Maps versionnés, graphes, provenance, validation et explorer read-only.

## Prochain jalon

Finaliser et publier Process Mapping sans démarrer Business Intelligence, AI Opportunity,
Automation Opportunity, ROI ou Recommendation.
