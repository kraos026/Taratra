# Rule Engine Core

Le Rule Engine évalue les réponses d'un audit sans IA, sans réseau et sans `eval`. Les faits sont
construits à partir du code stable de chaque question et de sa réponse validée. Une exécution lit
les règles actives disponibles pour l'organisation, évalue leur DSL en mémoire puis remplace les
résultats de l'audit dans la même transaction authentifiée.

## DSL

Une condition est une feuille `{ fact, operator, value }` ou un groupe `all`, `any` ou `none` non
vide. Les opérateurs acceptés sont `equal`, `notEqual`, `greaterThan`, `greaterOrEqual`, `lessThan`,
`lessOrEqual`, `contains`, `notContains`, `in`, `notIn`, `isEmpty` et `isNotEmpty`. Le validateur Zod
rejette tout autre opérateur, les valeurs manquantes et les groupes vides.

Les comparaisons d'ordre s'appliquent seulement à deux nombres ou à deux chaînes. `contains`
recherche une sous-chaîne ou un élément exact dans un tableau. `isEmpty` reconnaît une valeur
absente, `null`, une chaîne vide ou un tableau vide.

## Versionnement et portée

Les catégories et règles système ont `organization_id = null`. Une règle personnalisée appartient
à l'organisation authentifiée et peut utiliser une catégorie système ou une catégorie de cette
organisation. Une version est une ligne distincte identifiée par `(code, version)`. Une règle est
désactivée avec `active = false` et n'est jamais supprimée par l'API.
Seule la version la plus récente de chaque code et de chaque portée est évaluée ; si elle est
désactivée, aucune version antérieure n'est réactivée implicitement.

Owner et admin créent ou modifient les règles personnalisées. Tous les membres lisent le catalogue
disponible. Owner, admin et consultant exécutent le moteur ; viewer lit uniquement les résultats.
Les politiques RLS et les triggers empêchent toute lecture ou écriture inter-tenant.

## Scores

Le score d'une règle vraie est son poids ; celui d'une règle fausse est zéro. Pour chaque catégorie,
`score` est la somme des poids vrais, `total` la somme de tous les poids actifs et `percentage`
vaut `score / total * 100` (zéro si le total est nul). Le score global applique la même formule à
toutes les catégories. La priorité et la sévérité sont conservées comme métadonnées explicites et
ne modifient pas ce calcul.

## API

- `POST /api/audits/:id/evaluate`
- `GET /api/audits/:id/results`
- `GET /api/rules`
- `POST /api/rules`
- `PATCH /api/rules/:id`

## Vérification

```bash
npm ci
npm run db:generate
npm run lint
npm run format:check
npm run typecheck
npm test
npm run build
supabase test db
```
