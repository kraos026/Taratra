# Module Companies

Le module Companies gère les entreprises clientes et prospects d’une organisation AutomateX.
Il couvre la création, la consultation, la modification, l’archivage, la restauration et, pour
les rôles autorisés, la suppression définitive.

## Permissions

| Action                               | Owner | Admin | Consultant | Viewer |
| ------------------------------------ | ----- | ----- | ---------- | ------ |
| Lire les entreprises actives         | Oui   | Oui   | Oui        | Oui    |
| Lire les entreprises archivées       | Oui   | Oui   | Oui        | Non    |
| Créer, modifier, archiver, restaurer | Oui   | Oui   | Oui        | Non    |
| Supprimer définitivement             | Oui   | Oui   | Non        | Non    |

Une suppression définitive peut encore être refusée par PostgreSQL si une dépendance métier
référence l’entreprise. L’archivage, au moyen de `deleted_at`, est l’opération normale. Il ne
modifie pas le statut CRM : restaurer une entreprise restitue donc son statut précédent.

## API

Toutes les routes exigent une session Supabase valide et exécutent Prisma dans
`withAuthenticatedDatabase`, avec le JWT transmis à PostgreSQL afin que les politiques RLS
restent la barrière de sécurité finale.

| Méthode  | Route                        | Usage                    |
| -------- | ---------------------------- | ------------------------ |
| `GET`    | `/api/companies`             | Liste paginée et filtrée |
| `POST`   | `/api/companies`             | Création                 |
| `GET`    | `/api/companies/:id`         | Détail                   |
| `PATCH`  | `/api/companies/:id`         | Modification partielle   |
| `POST`   | `/api/companies/:id/archive` | Archivage                |
| `POST`   | `/api/companies/:id/restore` | Restauration             |
| `DELETE` | `/api/companies/:id`         | Suppression définitive   |

La liste accepte `page`, `pageSize` (maximum 100), `search`, `status`, `companySize`,
`sectorId`, `sortBy`, `sortOrder` et `includeArchived`. Les tris autorisés sont définis dans le
domaine et validés par Zod. La recherche couvre le nom, le contact principal, l’e-mail, la ville
et le secteur.

## Isolation multi-tenant

Le client ne fournit jamais l’organisation qui sera utilisée par une écriture. Le service la
résout depuis l’appartenance de l’utilisateur dans la transaction authentifiée. Les requêtes
Prisma filtrent explicitement cette organisation et les politiques RLS PostgreSQL appliquent le
même périmètre. Aucune route utilisateur n’utilise de clé service Supabase.

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
