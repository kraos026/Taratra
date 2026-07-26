# Guide développeur — AutomateX V1

## Prérequis et installation

- Node.js 22 et npm ;
- Docker Desktop avec WSL2 ;
- Supabase CLI `2.109.1` ;
- PostgreSQL/Supabase local.

```bash
npm ci
npx supabase start
npm run db:generate
npm run dev
```

Copier `.env.example` vers `.env.local`. Définir uniquement une URL Supabase, une clé
publishable locale et `DATABASE_URL`. Ne jamais committer de secret ni exposer une clé service
dans une variable `NEXT_PUBLIC_*`.

## Données

`supabase/migrations` est la source de vérité PostgreSQL : tables, contraintes, triggers, grants
et RLS. `prisma/schema.prisma` est la projection serveur. Toute évolution passe par une migration
Supabase, puis `npm run db:generate`. Les catalogues sont seedés par migrations, versionnés et
publiés explicitement.

Commandes :

```bash
npm run db:generate
npx supabase db reset
npx supabase test db
npm run lint
npm run format:check
npm run typecheck
npm test
npm run build
```

## Architecture et conventions

Chaque bounded context sépare `domain`, `application`, `infrastructure` et `presentation`.
Le domaine contient les décisions déterministes. Les routes et React n’en contiennent aucune.
Un moteur aval lit uniquement la sortie canonique publiée de son prédécesseur via son port.

Chaque table métier est tenant-scoped par `organization_id`, contrainte composite et RLS. Prisma
s’exécute dans `withAuthenticatedDatabase`, sous le rôle PostgreSQL `authenticated`. Les viewers
ne modifient rien. Les fonctions privilégiées restent dans un schéma privé, avec exécution
révoquée par défaut.

Les agrégats utilisent `lock_version`. Une mise à jour doit fournir la version lue ; zéro ligne
modifiée devient HTTP 409. Un rebuild crée toujours un nouveau draft. Une version publiée et ses
preuves, scores, catalogues et provenance sont immuables.

## Ajouter une règle ou un score

1. créer une nouvelle version de catalogue, sans modifier la version publiée ;
2. documenter code, formule, seuils, entrées et provenance ;
3. ajouter des tests unitaires de limites et de déterminisme ;
4. ajouter/adapter migration, Prisma et tests pgTAP/RLS ;
5. valider toute la chaîne de commandes ;
6. publier la version de catalogue seulement après revue.
