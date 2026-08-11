# Enterprise Simulator — Plan de tests

## Matrice

| Suite        | Déclenchement               |             Scénarios | LLM                 | Bloquante                |
| ------------ | --------------------------- | --------------------: | ------------------- | ------------------------ |
| unit         | chaque PR simulateur        |         sans pipeline | interdit            | oui                      |
| smoke        | chaque PR                   |                     2 | interdit            | oui                      |
| standard     | avant fusion                |                    10 | interdit            | oui                      |
| full         | manuel/planifié             |                   20+ | interdit par défaut | oui pour release interne |
| adversarial  | manuel/planifié et sécurité | catalogue adversarial | interdit            | oui                      |
| llm-assisted | manuel uniquement           |             sélection | facultatif          | non                      |

## Tests unitaires

### Déterminisme

- chaque méthode de `SeededRandom` ;
- même seed/version, même séquence ;
- seed ou catalogue différent, résultat différent ;
- UUID déterministes et uniques dans un scénario ;
- absence de `Math.random` dans le package.

### Domaine

- invariants Scenario, Actor, Process et GroundTruth ;
- périmètre de connaissance des acteurs ;
- contradictions autorisées uniquement si cataloguées ;
- unités, bornes numériques et dépendances ;
- documents sans données réelles.

### Validation

- identifiants exacts ;
- noms normalisés et alias ;
- ensembles ;
- tolérances numériques ;
- graphes orientés ;
- ordre roadmap ;
- divisions par zéro ;
- poids total égal à 100 % ;
- score borné à 0–100.

## Tests de contrat HTTP

- endpoint Knowledge read-only : `ready` uniquement, tenant et DTO public ;
- routes test-support absentes en production ;
- nettoyage refusé sans `SYNTHETIC_TEST`, run concordant et permission dédiée ;
- identité synthétique limitée à un tenant, un run, un rôle autorisé et 24 heures ;
- `Idempotency-Key` UUIDv7 obligatoire, retry identique et conflit de payload ;
- `X-Correlation-ID` UUIDv7 propagé et renvoyé ;
- authentification absente/expirée ;
- 400, 401, 403, 404, 409, 422, 429 et 5xx ;
- timeout ;
- retry borné ;
- non-retry d'une commande non idempotente ambiguë ;
- optimistic locking ;
- validation des DTO ;
- organisation attendue sur chaque snapshot ;
- redaction des headers.

Les tests statiques de PR 1 vérifient également les noms de headers, routes dédiées, marqueur de
tenant, permission de nettoyage, durées maximales et absence de dépendance Prisma/PostgreSQL.

## Tests end-to-end

Pour chaque run :

1. créer identité et tenant test ;
2. exécuter chaque étape V1 publique ;
3. conserver identifiants, versions, durées et statuts ;
4. récupérer les snapshots publiés ;
5. comparer à GroundTruth ;
6. produire les quatre rapports ;
7. nettoyer uniquement le tenant marqué test.

## Tests adversariaux

- réponse manquante ou contradictoire ;
- devise incohérente ;
- volume impossible ou durée négative ;
- processus dupliqué ;
- acteur sans autorité ;
- système inconnu ;
- dépendance cyclique ;
- ROI irréaliste ;
- entreprise sans logiciel ou très automatisée ;
- réponse vague ou excessivement détaillée ;
- interview interrompue ;
- mise à jour concurrente et mauvaise version ;
- accès cross-tenant ;
- mutation d'un snapshot publié.

## Reproductibilité

1. même seed + versions → même scénario et hash ;
2. même scénario + SHA V1 → mêmes résultats métier ;
3. dix runs → aucune différence métier ;
4. seed différent → scénario différent ;
5. catalogue différent → version/hash différents ;
6. rapport historique → toutes les versions identifiables.

## Multi-tenancy

- deux runs simultanés dans deux tenants ;
- aucune lecture, écriture, snapshot ou recommandation croisée ;
- aucun identifiant brut de l'autre tenant dans les rapports ;
- erreurs explicites ;
- nettoyage refusé si le tenant n'est pas marqué test.

## Seuils proposés

- Pipeline Completion Rate : 100 % ;
- Determinism Score : 100 % ;
- Tenant Isolation : 100 % ;
- Immutable Snapshot Protection : 100 % ;
- Explainability Coverage : 100 % ;
- Process Recall : ≥ 85 % ;
- Automation Opportunity Recall : ≥ 80 % ;
- Recommendation Priority Accuracy : ≥ 85 % ;
- Overall Score : ≥ 85 %.

Ces seuils sont internes, versionnés et configurables.
