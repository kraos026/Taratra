# AutomateX — État final Version 1

Dernière mise à jour : 2026-07-26. Version : `1.0.0`.

AutomateX V1 est fonctionnellement livrée. L’architecture V1 est gelée : aucune fonctionnalité
Execution Platform V2 n’est incluse.

## Sprints livrés

| Sprint    | Livraison                                                | Migration principale                                     |
| --------- | -------------------------------------------------------- | -------------------------------------------------------- |
| 1         | Auth, onboarding atomique, multi-tenant, Prisma, RLS, CI | `0001_foundations.sql`                                   |
| 2         | Questionnaires et Audit Engine foundation                | `20260722064705_add_audit_questionnaire.sql`             |
| 3         | ReportBuilder, dashboard exécutif et API Report v1       | aucune migration dédiée                                  |
| 4         | Discovery, profil canonique et wizard                    | `20260726033231_add_discovery_engine.sql`                |
| 5         | Adaptive Interview Engine                                | `20260726042817_add_adaptive_interview_engine.sql`       |
| Fondation | Enterprise Knowledge                                     | `20260726050014_add_enterprise_knowledge_foundation.sql` |
| 6         | Process Mapping Engine                                   | `20260726051835_add_process_mapping_engine.sql`          |
| 7         | Business Analysis Engine                                 | `20260726060854_add_business_analysis_engine.sql`        |
| 8         | AI Opportunity Engine déterministe                       | `20260726070749_add_ai_opportunity_engine.sql`           |
| 9         | Automation Opportunity Engine                            | `20260726074924_add_automation_opportunity_engine.sql`   |
| 10        | ROI Engine versionné                                     | `20260726082805_add_roi_engine.sql`                      |
| 11        | Recommendation Portfolio et roadmap                      | `20260726091105_add_recommendation_engine_v2.sql`        |

## État final

Chaîne canonique :

`Discovery → Interview → Enterprise Knowledge → Process Mapping → Business Analysis → AI Opportunity → Automation Opportunity → ROI → Recommendation`.

Chaque moteur aval consomme des snapshots publiés ou `ready`, conserve la provenance, applique
des catalogues et formules versionnés, et ne réécrit jamais ses sources. Les snapshots publiés
sont immuables. Un rebuild crée une nouvelle version. Les écritures concurrentes utilisent
`lock_version` et renvoient HTTP 409 en cas de conflit.

Catalogues versionnés : questionnaires, interviews, process patterns, règles et scores Business
Analysis, capacités et règles AI, patterns/connecteurs/règles Automation, modèles/hypothèses ROI,
règles Recommendation et définitions de priorité.

## Qualité de la release

- Vitest : 47 fichiers, 189 tests ;
- pgTAP/RLS : 15 fichiers, 174 tests ;
- lint, format, typecheck et build obligatoires en CI ;
- audit initial : 17 alertes ; après correction : 13 (9 élevées dev-only, 4 modérées CLI),
  documentées dans `docs/security/DEPENDENCY_AUDIT_V1.md`.

## Contraintes et dette connue

- les moteurs historiques Rules, ROI et Recommendations restent présents pour compatibilité ;
- les doublons historiques `employee_count` et secteur entre Companies et Discovery nécessitent
  une migration de compatibilité future ;
- la résolution du contexte tenant et certaines enveloppes HTTP restent répétées ;
- neuf alertes de globbing restent dans ESLint/plug-ins et quatre dans le CLI Prisma ;
- PostgreSQL 17 doit être la cible de validation avant déploiement Supabase.

## Prochaine étape

AutomateX Execution Platform V2, uniquement après validation d’une nouvelle architecture et de
nouveaux ADR.
