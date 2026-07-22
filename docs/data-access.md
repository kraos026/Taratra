# Accès aux données : Supabase et Prisma

## Responsabilités

Supabase reste responsable de PostgreSQL, de l'authentification, des migrations SQL et de la sécurité RLS. Les fichiers de `supabase/migrations` sont l'unique source de vérité pour le schéma déployé, car Prisma ne sait pas représenter les politiques RLS, les fonctions de sécurité et les triggers PostgreSQL.

Prisma est la couche d'accès typée utilisée exclusivement côté serveur. Son schéma reflète les tables applicatives, mais il ne doit pas servir à générer une migration qui supprimerait les objets Supabase non représentés.

## RLS depuis Prisma

Une connexion Prisma de migration dispose de privilèges élevés. Le code applicatif doit donc exécuter chaque opération dans `withAuthenticatedDatabase` :

1. une transaction est ouverte ;
2. l'identifiant Supabase validé est placé dans `request.jwt.claim.sub` ;
3. la transaction adopte le rôle PostgreSQL `authenticated` ;
4. les requêtes Prisma sont alors soumises aux politiques RLS ;
5. le rôle et le contexte sont automatiquement réinitialisés à la fin de la transaction.

Il est interdit d'utiliser directement le singleton Prisma dans une route HTTP. Une route doit d'abord valider l'utilisateur avec Supabase Auth, puis appeler l'adaptateur transactionnel.

## Migrations

- `npm run db:generate` régénère le client Prisma typé.
- `npm run db:migrate:local` applique les migrations Supabase à la base locale.
- `npm run db:migrate` pousse les migrations Supabase vers le projet lié.
- `npm run test:rls` exécute les tests PostgreSQL après `supabase start`.

Le pooler Supabase en mode session est recommandé pour les migrations. La chaîne d'exécution serverless doit utiliser le pooler fourni par Supabase et rester dans `DATABASE_URL` côté serveur uniquement.
