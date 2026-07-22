# Questionnaires d’audit

Le Sprint 2 sépare la définition d’un questionnaire de son utilisation dans un audit. Un modèle
(`questionnaire_templates`) possède plusieurs versions, composées de sections puis de questions.
Un audit référence toujours une version précise et ses réponses ne contiennent aucune décision
métier, recommandation ou sortie d’IA.

## Versionnement

Une version `draft` est modifiable. La publication est transactionnelle : la version publiée
précédente est archivée et la version draft devient l’unique version publiée active. Le contenu
d’une version `published` ou `archived` est protégé par des triggers PostgreSQL. La transition
`published → archived` est la seule modification administrative autorisée sur une version publiée.
La duplication copie les sections, questions, options, validations et métadonnées dans un nouveau
draft portant le prochain numéro.

## Questions et valeurs JSON

Types : `short_text`, `long_text`, `number`, `boolean`, `single_choice`, `multiple_choice`,
`percentage`, `currency` et `date`. `options_json` est un tableau de valeurs primitives, requis
uniquement pour les choix. Exemple : `["faible", "moyen", "élevé"]`.

`validation_json` accepte `min`, `max`, `minLength`, `maxLength` et `pattern`. Exemple :
`{"min": 0, "max": 500}`. `metadata_json` reste un objet générique réservé aux extensions
futures, notamment la visibilité conditionnelle qui n’est pas exécutée dans ce sprint.

## Cycle de vie d’un audit

`draft → in_progress → completed → validated`, avec `archived` comme état terminal administratif.
La première réponse fixe `started_at`, passe l’audit en cours et fige sa version de questionnaire.
Chaque réponse est validée de manière déterministe avant l’upsert. La progression est le nombre de
questions répondues divisé par le nombre total, arrondi à l’entier le plus proche, ou zéro si le
questionnaire est vide. La complétion exige toutes les questions obligatoires. Seuls owner et admin
peuvent valider définitivement.

## Permissions et RLS

- Tous les membres lisent les questionnaires système publiés.
- Owner et admin administrent les questionnaires personnalisés de leur organisation.
- Consultant lit les questionnaires et saisit les audits de son organisation.
- Viewer lit les versions publiées et les audits, sans aucune écriture.
- Owner, admin et consultant créent et complètent les audits ; owner et admin les valident.

Les routes utilisent Prisma dans `withAuthenticatedDatabase`. L’organisation vient exclusivement
de l’appartenance authentifiée. Les contraintes et triggers vérifient en plus la cohérence
entre entreprise, audit, version, question et réponse. Toutes les tables publiques ont RLS activée
et des `GRANT` explicites ; aucune route utilisateur n’emploie de clé service.

## API

Questionnaires : `/api/questionnaires`, `/api/questionnaires/:id`, leurs versions, duplication,
publication, archivage, sections et questions. Filtres : `page`, `pageSize`, `search`, `category`,
`status`, `isSystem`, `sortBy`, `sortOrder`.

Audits : `/api/audits`, `/api/audits/:id`, réponses par question, complétion, validation et
archivage. Filtres : pagination, entreprise, statut et tri en liste blanche.

## Vérification

```bash
npm ci
npm run db:generate
npm run lint
npm run format:check
npm run typecheck
npm test
npm run build
supabase start
supabase test db
```
