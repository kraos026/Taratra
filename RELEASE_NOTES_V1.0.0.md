# AutomateX v1.0.0

AutomateX V1 est une Enterprise Intelligence Platform multi-tenant qui transforme des données
d’entreprise validées en cartographies, analyses, opportunités, scénarios ROI et roadmap
priorisée, de façon déterministe et explicable.

## Fonctionnalités

Les Sprints 1 à 11 livrent Auth/RLS, questionnaires et audits, reporting v1, Discovery, Interview,
Enterprise Knowledge, Process Mapping, Business Analysis, AI Opportunity, Automation Opportunity,
ROI et Recommendation. Les catalogues, preuves, contributions et snapshots sont versionnés.

## Architecture et sécurité

Clean Architecture et DDD, Next.js/TypeScript, Supabase Auth/PostgreSQL/RLS et Prisma serveur.
Isolation tenant à plusieurs niveaux, permissions par rôle, optimistic locking, snapshots publiés
immuables et provenance complète. La CI exécute installation propre, génération Prisma, lint,
format, typecheck, Vitest, build et tests pgTAP/RLS.

## Limitations connues

- neuf alertes élevées dev-only de la chaîne ESLint et quatre modérées du CLI Prisma sont
  acceptées temporairement avec mesures compensatoires ;
- les moteurs historiques ROI/Recommendation restent pour compatibilité ;
- aucune exécution ou génération de workflow ;
- aucun déploiement n8n, Make ou Zapier ;
- aucune fonctionnalité Execution Platform V2.

## Compatibilité et mise à niveau

La release conserve les routes et contrats V1. Avant mise à niveau : sauvegarder PostgreSQL,
tester la restauration, appliquer les migrations dans l’ordre, régénérer Prisma, exécuter la
suite complète, puis déployer l’application. En cas d’échec, restaurer la sauvegarde et la version
applicative précédente ; ne jamais modifier manuellement une migration déjà appliquée.
