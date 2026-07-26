# ADR-0002 — Frontière Supabase, Prisma et RLS

- Statut : accepté
- Date : 2026-07-26

## Contexte

AutomateX doit combiner un accès serveur typé avec une isolation multi-tenant vérifiable au niveau
PostgreSQL.

## Décision

Supabase possède Auth, PostgreSQL, les migrations et la RLS. Prisma est un adaptateur serveur,
jamais l'autorité de migration. Les routes authentifiées utilisent exclusivement
`withAuthenticatedDatabase`; les politiques RLS qualifient leurs colonnes et les contraintes
tenant-scoped incluent `organization_id`.

## Conséquences

- aucune clé service dans une route utilisateur ;
- toute table `public` exposée reçoit RLS, politiques et grants explicites ;
- les migrations SQL et tests pgTAP sont obligatoires pour les changements de données ;
- le schéma Prisma est régénéré après chaque évolution SQL.
