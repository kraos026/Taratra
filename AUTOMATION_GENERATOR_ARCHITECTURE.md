# Automation Generator — Architecture

Statut : **PROPOSITION POUR ARCHITECTURE REVIEW — SPRINT V2-3**

Ce document définit le contrat d’architecture du bounded context **Automation Generator**.
Il ne constitue pas une implémentation et ne modifie aucun bounded context existant.

## 1. Vision

Automation Generator est le compilateur canonique d’AutomateX V2. Il transforme un snapshot
publié d’Automation Specification en un **Canonical Automation Graph** déterministe, versionné,
explicable et indépendant de tout fournisseur.

Le Generator ne déploie, n’exécute et ne valide pas la compatibilité d’un workflow avec une
plateforme. Sa sortie constitue la frontière stable entre l’intention d’automatisation et les
futurs moteurs de validation et de compilation spécifiques aux plateformes.

### Concepts distincts

| Concept                    | Responsabilité                                                                                                 |
| -------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Automation Specification   | Décrit, en termes métier abstraits, déclencheurs, étapes, données, contrôles, politiques et critères attendus. |
| Canonical Automation Graph | Représentation compilée, structurée et fournisseur-indépendante du contrôle et des flux de données.            |
| Platform Artifact          | Représentation propre à n8n, Make, Temporal, Camunda ou une autre cible, produite ultérieurement.              |
| Deployment                 | Publication opérationnelle d’un Platform Artifact dans un environnement cible.                                 |

Le Canonical Automation Graph est **exécutable au sens structurel** : toutes les dépendances,
expressions et politiques nécessaires sont explicites. Il n’est pas directement exécutable par une
plateforme et ne contient aucun code arbitraire.

## 2. Position dans la chaîne V2

```text
Recommendation
  -> Solution Blueprint
  -> Automation Specification
  -> Automation Generator
  -> Validation
  -> Platform Compilation
  -> Deployment
  -> Monitoring
  -> Optimization
```

### Frontière avec Automation Specification

- seule une version publiée est consommable ;
- le Generator reçoit un DTO de snapshot public par un port explicite ;
- il ne lit ni tables, ni repositories, ni modèles Prisma du bounded context source ;
- il fige l’identifiant, la version, la lineage et le hash du snapshot consommé ;
- il ne corrige et ne complète jamais silencieusement la Specification.

### Frontière avec Validation

Le Generator garantit uniquement les invariants structurels indispensables pour construire un
graph cohérent. Le futur Validation Engine consommera un graph publié et exécutera les validations
sémantiques, de sécurité, de conformité, de performance et de compatibilité plateforme.

Le statut `VALIDATED` n’appartient donc pas au lifecycle du Generator.

### Frontière avec Deployment

Deployment ne reçoit jamais les données internes du Generator. Il consommera un Platform Artifact
produit à partir d’un Canonical Automation Graph publié et validé. Le Generator ne connaît ni
environnement, ni credential, ni cible de déploiement.

### Frontière avec Monitoring

Le Generator produit seulement des métadonnées de construction et d’observabilité. Monitoring
observe ultérieurement l’exécution déployée ; il ne modifie jamais un graph publié.

## 3. Bounded Context

### Responsabilités

- charger un snapshot public d’Automation Specification publié ;
- sélectionner les versions compatibles du générateur, du schéma et du catalogue ;
- compiler la Specification en graph canonique ;
- garantir déterminisme et invariants structurels ;
- enregistrer provenance, explications et capacités non consommées ;
- gérer lineage, versions, publication et dépréciation ;
- exposer le graph et ses explications par REST ;
- publier les événements nécessaires aux moteurs downstream.

### Données possédées

- `AutomationGeneration` et ses versions ;
- workspace de génération non publié ;
- snapshots publiés du Canonical Automation Graph ;
- nœuds, arêtes, variables, ports et politiques canoniques ;
- provenance et explications de génération ;
- catalogues de règles de génération ;
- journal d’idempotence et outbox propres au contexte.

### Données non possédées

- Automation Specifications ;
- Recommendations, ROI, Automation Opportunities et Solution Blueprints ;
- résultats du futur Validation Engine ;
- Platform Artifacts ;
- déploiements, credentials, exécutions et télémétrie runtime.

### Dépendances autorisées

- DTO public versionné d’Automation Specification via `AutomationSpecificationReaderPort` ;
- PostgreSQL et Prisma derrière les ports d’infrastructure du contexte ;
- horloge, transaction, hash et fabrique d’identifiants par ports ;
- authentification et contexte tenant fournis par la couche plateforme ;
- outbox transactionnelle pour les événements publiés.

### Dépendances interdites

- import d’un domaine, service, repository ou modèle Prisma d’un autre bounded context ;
- accès direct aux tables Automation Specification ;
- SDK d’une plateforme d’automatisation ;
- appel réseau pendant la compilation pure ;
- LLM, `eval`, JavaScript, Python ou script arbitraire ;
- service role dans une route publique sans contrôle tenant et permission.

### Ports entrants

- commandes REST : request, generate, rebuild, publish, deprecate ;
- queries REST : generation, graph, provenance, explanations ;
- future consommation interne d’une commande idempotente via application service.

### Ports sortants

- `AutomationSpecificationReaderPort` ;
- `AutomationGenerationRepositoryPort` ;
- `GenerationRuleCatalogPort` ;
- `TransactionPort` ;
- `ClockPort` ;
- `DeterministicIdFactory` ;
- `ContentHasherPort` ;
- `DomainEventOutboxPort`.

### Anti-corruption boundaries

Le DTO Automation Specification est validé puis traduit en Value Objects du Generator. Les noms de
types, statuts et structures source ne traversent pas cette traduction. De même, les DTO REST du
Generator sont assemblés depuis le domaine et ne révèlent aucun objet Prisma ou état de workspace
interne.

## 4. Aggregate principal

Le nom définitif de l’aggregate principal est **`AutomationGeneration`**.

### Identité et état

- `tenantId` ;
- `generationId` ;
- `lineageId` ;
- `automationSpecificationSnapshotId` ;
- `automationSpecificationLineageId` ;
- `automationSpecificationVersion` ;
- `automationSpecificationContentHash` ;
- `generatorVersion` ;
- `graphSchemaVersion` ;
- `ruleCatalogVersion` ;
- `status` ;
- `generationVersion` ;
- `lockVersion` ;
- `createdAt`, `updatedAt`, `generatedAt`, `publishedAt`, `deprecatedAt` ;
- `contentHash` lorsque le graph est généré ;
- références vers graph, provenance et explications.

`generationVersion` versionne le contenu métier dans la lineage. `lockVersion` protège les
commandes concurrentes. Ces deux valeurs ne sont jamais interchangeables.

### Invariants

1. Le tenant de la Generation est celui du snapshot source.
2. Le snapshot source est publié, immuable et appartient à une seule lineage de Specification.
3. Une Generation consomme exactement une version canonique de Specification.
4. Une seule version publiée non dépréciée peut être active par lineage de Generation.
5. `GENERATED` exige un graph structurellement cohérent, un hash et une provenance exhaustive.
6. Une capacité non supportée interdit la génération.
7. `PUBLISHED` exige `GENERATED` et fige graph, versions, provenance et explications.
8. Un snapshot publié n’est jamais modifié ou reconstruit.
9. Seule la dernière version non publiée d’une lineage peut être reconstruite.
10. Toute transition vérifie `expectedVersion == lockVersion`.
11. Les préconditions de l’Aggregate, de l’Application Service et de PostgreSQL sont identiques.

## 5. Lifecycle

Le lifecycle définitif est :

```text
REQUESTED -> GENERATED -> PUBLISHED -> DEPRECATED
     |           |
     +-- rebuild-+
```

### Justification

`REQUESTED` représente une génération créée et liée à une Specification publiée, mais sans graph
valide. `GENERATED` représente un candidat complet qui peut être inspecté et reconstruit avant
publication. `PUBLISHED` est la frontière de consommation downstream. `DEPRECATED` retire ce
snapshot des nouvelles consommations sans effacer son historique.

`VALIDATED` est exclu : la validation avancée appartient au futur Validation Engine.
`PARTIALLY_GENERATED` est exclu : une sortie partielle ne constitue pas un graph canonique sûr.

### Transitions autorisées

| Transition                            | Préconditions                                                                          | Effet                                                                             |
| ------------------------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------- |
| création → `REQUESTED`                | Specification publiée, tenant concordant, versions résolues                            | crée une version de Generation sans graph public                                  |
| `REQUESTED` → `GENERATED`             | compilation complète, aucune capacité non supportée, invariants structurels satisfaits | remplace atomiquement le workspace et calcule le hash                             |
| `GENERATED` → `GENERATED` par rebuild | dernière version non publiée, expectedVersion correct                                  | reconstruit atomiquement le workspace                                             |
| `GENERATED` → `PUBLISHED`             | graph complet, hash stable, provenance complète                                        | crée et fige le snapshot public ; déprécie atomiquement l’ancienne version active |
| `PUBLISHED` → `DEPRECATED`            | rôle autorisé, expectedVersion correct                                                 | retire la version des nouvelles consommations                                     |

### Transitions interdites

- publier depuis `REQUESTED` ;
- déprécier depuis `REQUESTED` ou `GENERATED` ;
- revenir de `PUBLISHED` vers un état modifiable ;
- reconstruire ou supprimer `PUBLISHED` ou `DEPRECATED` ;
- effectuer une transition sur une version supersédée ;
- ignorer un conflit de version.

Les contraintes PostgreSQL reproduisent exactement cette matrice et retournent une erreur avant
toute mutation invalide.

## 6. Canonical Automation Graph

Le graph canonique est un snapshot métier immuable et indépendant de tout fournisseur.

### Metadata

- `graphId`, `generationId`, `lineageId`, `generationVersion` ;
- `graphSchemaVersion`, `generatorVersion`, `ruleCatalogVersion` ;
- référence et hash de la Specification source ;
- `contentHash` ;
- compteurs de nœuds, arêtes et warnings structurels ;
- horodatage documentaire, exclu du hash métier ;
- provenance racine.

### Contenu

- inputs et outputs publics ;
- variables typées et scopes ;
- nœuds et ports ;
- arêtes et ordre canonique ;
- expressions et conditions ;
- branches, loops, branches parallèles et joins ;
- waits et timers ;
- retry, timeout et error policies ;
- routes d’erreur et compensation ;
- étapes d’approbation humaine ;
- références de sous-workflows ;
- interactions abstraites avec systèmes externes ;
- références de secrets ;
- data mappings ;
- métadonnées d’observabilité ;
- provenance et explications.

Le graph ne contient aucune URL d’environnement, aucun credential et aucune configuration propre à
une plateforme.

## 7. Node model

La taxonomie minimale définitive est :

| Type                | Rôle                                                       |
| ------------------- | ---------------------------------------------------------- |
| `TriggerNode`       | démarre le graph à partir d’un événement ou input abstrait |
| `ActionNode`        | réalise une interaction ou responsabilité abstraite        |
| `ConditionNode`     | choisit une branche à partir d’une expression booléenne    |
| `TransformNode`     | applique un mapping de données déterministe                |
| `LoopNode`          | itère sur une collection avec limites explicites           |
| `ParallelNode`      | ouvre plusieurs branches indépendantes                     |
| `JoinNode`          | synchronise les branches selon une stratégie canonique     |
| `DelayNode`         | représente wait ou timer                                   |
| `HumanApprovalNode` | suspend le flux pour une décision humaine                  |
| `SubWorkflowNode`   | référence un graph canonique publié compatible             |
| `ErrorHandlerNode`  | traite une route d’erreur explicite                        |
| `CompensationNode`  | décrit une compensation métier abstraite                   |
| `EndNode`           | termine une branche avec un résultat explicite             |

Chaque nœud contient :

- `nodeId` déterministe ;
- `nodeType` ;
- définition métier sérialisée et validée ;
- ports d’entrée et de sortie ;
- configuration canonique ;
- `ProvenanceReference` ;
- `ErrorPolicy` ;
- `RetryPolicy` uniquement lorsque le type l’autorise ;
- ordre canonique d’affichage, sans signification d’exécution implicite.

Une capacité absente de cette taxonomie n’autorise pas l’ajout improvisé d’un type. Elle déclenche
`UnsupportedCapability`.

## 8. Edge model

Une arête contient :

- `edgeId` déterministe ;
- `sourceNodeId` et `targetNodeId` ;
- `edgeType` ;
- condition optionnelle ;
- `outputPort` et `inputPort` ;
- priorité déterministe ;
- provenance.

Types définitifs :

- `SUCCESS` : chemin normal ;
- `FAILURE` : erreur capturée ;
- `CONDITIONAL` : condition explicite ;
- `TIMEOUT` : expiration d’une politique ;
- `COMPENSATION` : déclenchement d’une compensation ;
- `DEFAULT` : branche de repli explicite.

Une arête doit référencer deux nœuds et deux ports existants. Les priorités sont uniques dans le
périmètre d’un port source lorsque l’ordre est significatif.

## 9. Expressions et mappings

`Expression` est un arbre de données fermé, jamais une chaîne de code.

### Primitives

- `Literal` : string, number, boolean, null, date/duration normalisée ;
- `VariableReference` : variable déclarée et scope explicite ;
- `NodeOutputReference` : nœud antérieur et port de sortie ;
- `ConfigurationReference` : valeur non secrète du graph ;
- `SecretReference` : identifiant logique, jamais valeur du secret.

### Opérations

- booléennes : `all`, `any`, `none`, `not` ;
- comparaisons typées : equal, notEqual, greater/less, contains, in ;
- transformations simples versionnées : concat, coalesce, select, rename, format ;
- construction de listes et objets ;
- mapping source → cible structuré.

Le modèle interdit JavaScript, Python, SQL, templates exécutables, accès dynamique à une propriété
non déclarée et appel réseau. Chaque opérateur possède un schéma, une arité et des types connus.

## 10. Déterminisme

Le tuple suivant définit intégralement la sortie :

```text
(Specification snapshot hash,
 Generator version,
 Graph schema version,
 Generation Rule Catalog version)
```

Règles obligatoires :

- tri explicite de chaque collection avant compilation ;
- identifiants dérivés d’un chemin canonique, du type et des identifiants source ;
- aucune dépendance à l’ordre PostgreSQL ou filesystem ;
- aucune utilisation de l’heure dans une décision ou un identifiant ;
- aucun aléa ; un PRNG n’est pas nécessaire et n’est pas autorisé ;
- algorithmes et catalogues versionnés ;
- nombres, dates et durées normalisés ;
- sérialisation JSON canonique à clés triées ;
- exclusion des timestamps techniques du contenu hashé ;
- hash SHA-256 du JSON canonique ;
- même commande logique protégée par idempotency key ;
- unicité du tuple source/versions/generationVersion dans une lineage.

### Identifiants déterministes

La stratégie définitive est :

```text
NodeId = sha256("node" + graphSchemaVersion + canonicalSourcePath + nodeType)[0..31]
EdgeId = sha256("edge" + sourceNodeId + targetNodeId + edgeType + canonicalOrdinal)[0..31]
```

Les identifiants sont représentés avec un préfixe de type lisible. Ils ne dépendent ni d’un UUID
aléatoire, ni de l’ordre d’insertion.

## 11. Compilation pipeline

Le pipeline conceptuel définitif est :

1. charger le snapshot public de Specification ;
2. vérifier publication, tenant, lineage, version et hash ;
3. valider le contrat d’entrée à l’exécution ;
4. résoudre des versions compatibles et publiées ;
5. normaliser la Specification ;
6. construire une Intermediate Representation ;
7. appliquer les règles de génération sélectionnées ;
8. construire nœuds, ports et variables ;
9. résoudre control flow et data flow ;
10. attacher retry, timeout, erreur et compensation ;
11. attacher provenance et explications ;
12. détecter toute capacité unsupported ou ignorée ;
13. exécuter les invariants structurels ;
14. canoniser les ordres et identifiants ;
15. sérialiser et calculer le hash ;
16. remplacer atomiquement le workspace non publié ;
17. publier seulement par commande explicite ultérieure.

### Intermediate Representation

Une IR interne est nécessaire pour séparer normalisation source et graph public. Elle est :

- pure, transitoire et non persistée ;
- privée au Domain Service de compilation ;
- non exposée par REST ;
- jamais une source de vérité ;
- entièrement reconstruite à chaque generate/rebuild.

## 12. Generation rules

Le nom définitif est **`GenerationRuleCatalog`**.

### Rôle exact

Le catalogue :

- sélectionne des décisions de projection configurables ;
- configure paramètres, priorité, activation et compatibilités ;
- versionne ces décisions ;
- associe capacités source et projections canoniques autorisées.

Le catalogue ne décrit jamais :

- un algorithme ;
- un ordre d’exécution ;
- les invariants métier ;
- le lifecycle ;
- le calcul des identifiants ou du hash ;
- une configuration fournisseur.

Ces responsabilités appartiennent aux Aggregates, Value Objects et Domain Services. Le catalogue
complète le compilateur ; il ne le remplace pas.

Chaque entrée JSON est validée à l’exécution par schéma strict ou Value Object. Les champs inconnus,
types incorrects, versions incompatibles et décisions non reconnues déclenchent
`InvalidCatalogConfiguration`. Aucun cast TypeScript direct ne vaut validation.

Seules les versions `PUBLISHED` du catalogue sont consommables. Elles sont immuables et identifiées
dans le snapshot.

## 13. Value Objects

- `GenerationId` et `GenerationLineageId` ;
- `GenerationVersion` et `LockVersion` ;
- `AutomationSpecificationSnapshotReference` ;
- `GeneratorVersion`, `GraphSchemaVersion`, `CatalogVersion` ;
- `NodeId`, `EdgeId`, `PortId`, `VariableId` ;
- `ContentHash` ;
- `CanonicalSourcePath` ;
- `Expression`, `VariableReference`, `NodeOutputReference`, `SecretReference` ;
- `DataMapping` ;
- `RetryPolicy`, `TimeoutPolicy`, `ErrorPolicy`, `CompensationPolicy` ;
- `ProvenanceReference`, `ExplanationCode`, `ExplanationParameters` ;
- `IdempotencyKey`, `CorrelationId`, `TenantId`.

Tous valident format, bornes, compatibilité et invariants à leur création. Aucun objet Domain ne
reçoit de JSON non validé.

## 14. Provenance et explicabilité

Chaque nœud, arête, port, variable, expression, mapping et politique possède une provenance.

### Données minimales

- `sourceSpecificationElementIds` ;
- `consumedCapabilities` ;
- `appliedRuleIds` et versions ;
- `ruleCatalogVersion` ;
- `generatorVersion` ;
- `explanationCode` ;
- `explanationParameters` structurés ;
- `generatedElementId` ;
- classification et justification.

### Classifications

- `CONSUMED` : élément lu et directement représenté ;
- `TRANSFORMED` : élément représenté sous une autre forme canonique ;
- `IGNORED` : élément reconnu mais intentionnellement non nécessaire, avec raison autorisée ;
- `UNSUPPORTED` : capacité reconnue mais non représentable ; la génération échoue ;
- `DEFAULTED` : valeur canonique ajoutée par une règle publiée, avec règle et justification.

Un même élément ne peut être simultanément consommé/transformé et ignoré dans une décision donnée.
Toute capacité référencée par une règle ou présente dans une définition générée doit être marquée
`CONSUMED` ou `TRANSFORMED`. Les éléments réellement ignorés exigent un code de justification.

La provenance est vérifiée comme invariant avant `GENERATED`.

## 15. Immutabilité et lineage

### Décision de lineage

- une nouvelle lineage publiée d’Automation Specification ouvre une nouvelle
  `GenerationLineageId` ;
- une nouvelle version publiée dans la même lineage de Specification crée une nouvelle
  `GenerationVersion` dans la lineage de Generation correspondante ;
- une Generation référence une seule version canonique de Specification ;
- aucune continuité implicite n’est autorisée entre deux lineages ;
- les liens inter-lineages sont conservés uniquement pour navigation, audit et traçabilité.

### Opérations

- **rebuild** : reconstruit atomiquement la dernière Generation non publiée pour la même
  Specification et les mêmes versions résolues ;
- **regeneration** : crée une nouvelle GenerationVersion, notamment pour une nouvelle version de
  Specification, du Generator, du schéma ou du catalogue ;
- **supersession** : la publication d’une version plus récente déprécie atomiquement l’ancienne
  version active en appliquant sa transition `PUBLISHED → DEPRECATED` sous verrou de lineage ;
- **publication** : fige un snapshot public ;
- **deprecation** : retire explicitement un snapshot des nouvelles consommations.

Les snapshots publiés restent lisibles pour audit. Ils ne sont ni modifiés ni supprimés par les
commandes métier.

## 16. Rebuild transactionnel

Le rebuild s’exécute dans une unique transaction :

1. charger et verrouiller la Generation ;
2. vérifier tenant, statut, dernière version et `expectedVersion` ;
3. relire le snapshot source publié et vérifier son hash ;
4. relire les mêmes versions de Generator, schéma et catalogue ;
5. reconstruire intégralement l’IR et le graph en mémoire ;
6. valider capacités, provenance et invariants ;
7. supprimer les enfants du workspace non publié ;
8. insérer les nouveaux enfants ;
9. mettre à jour hash, métriques, timestamps et `lockVersion` ;
10. enregistrer l’audit et l’idempotence ;
11. commit.

Toute erreur entraîne un rollback complet. Les snapshots publiés ne sont jamais touchés. Un conflit
renvoie HTTP `409 GENERATION_VERSION_CONFLICT`.

## 17. API REST

Préfixe public : `/api/automation-generations`.

| Méthode | Endpoint                                       | Responsabilité                                       |
| ------- | ---------------------------------------------- | ---------------------------------------------------- |
| `POST`  | `/api/automation-generations`                  | demander une Generation depuis un snapshot publié    |
| `GET`   | `/api/automation-generations/:id`              | lire metadata et lifecycle                           |
| `POST`  | `/api/automation-generations/:id/generate`     | construire le premier candidat                       |
| `POST`  | `/api/automation-generations/:id/rebuild`      | reconstruire le candidat non publié                  |
| `POST`  | `/api/automation-generations/:id/publish`      | publier explicitement                                |
| `POST`  | `/api/automation-generations/:id/deprecate`    | déprécier un snapshot publié                         |
| `GET`   | `/api/automation-generations/:id/graph`        | lire le graph public ou le candidat selon permission |
| `GET`   | `/api/automation-generations/:id/provenance`   | lire la provenance paginée                           |
| `GET`   | `/api/automation-generations/:id/explanations` | lire les explications paginées                       |

### Commandes

- validation Zod stricte des DTO ;
- `expectedVersion` obligatoire sauf création ;
- `Idempotency-Key` obligatoire ;
- `X-Correlation-ID` propagé ;
- `201` à la création, `200` pour une transition terminée ;
- `202` n’est utilisé que si une future exécution asynchrone conserve exactement les mêmes
  invariants et contrats d’idempotence ;
- aucun endpoint générique `PATCH` du status ou du graph.

### Queries

- `200`, `401`, `403`, `404` ;
- graph `REQUESTED` : `409 GRAPH_NOT_GENERATED` ;
- provenance et explications : `page`, `pageSize` borné, ordre canonique stable ;
- ETag égal au content hash pour un snapshot publié.

Le versioning fonctionnel est porté par les DTO et `graphSchemaVersion`. Un préfixe `/v2` ne sera
introduit qu’en cas de rupture du contrat HTTP, pas pour chaque version métier.

## 18. Persistence model

### Décision de stockage

Le modèle définitif est **hybride** :

- relationnel pour lifecycle, recherches, contraintes, tenant, nœuds, arêtes, provenance et
  explications ;
- `graph_json` JSONB pour le snapshot canonique public exact ;
- `definition_json` pour les Value Objects sérialisés des éléments.

`graph_json` est l’autorité du snapshot public. Les tables normalisées sont des index/projections
immuables produits dans la même transaction et vérifiés contre le même `content_hash`. Elles ne
constituent jamais une seconde source métier modifiable.

### Tables conceptuelles

- `automation_generations` : aggregate, lineage, source, lifecycle, versions et verrou ;
- `automation_generation_snapshots` : graph JSON canonique, hash et versions figées ;
- `canonical_graph_nodes` ;
- `canonical_graph_edges` ;
- `canonical_graph_variables` ;
- `canonical_graph_inputs` ;
- `canonical_graph_outputs` ;
- `canonical_graph_policies` ;
- `generation_provenance` ;
- `generation_explanations` ;
- `generation_rule_catalogs` ;
- `automation_generation_outbox` ;
- store d’idempotence partagé via port de plateforme ou table tenant-scoped dédiée.

Toutes les tables enfants portent `tenant_id` et une FK composite vers leur parent.

### Rôle des JSON

`definition_json` et `graph_json` sont exclusivement la représentation sérialisée de Value Objects
validés par le domaine. Ils constituent des snapshots de données métier. Ils ne contiennent jamais
de logique, algorithme, règle de décision, code arbitraire, comportement fournisseur ou
configuration d’exécution réelle. Ils ne sont ni un Aggregate mutable, ni un objet Prisma.

## 19. Multi-tenancy et sécurité

- `tenant_id` obligatoire sur chaque donnée tenant-scoped ;
- unicité incluant le tenant ;
- FKs composites `(id, tenant_id)` lorsque possible ;
- RLS activée et forcée sur toutes les tables tenant-scoped ;
- `SELECT` réservé aux membres autorisés du tenant ;
- `INSERT` réservé aux rôles autorisés et au tenant de l’identité ;
- `UPDATE` limité aux transitions et workspaces non publiés ;
- `DELETE` refusé pour les snapshots publiés et données d’audit ;
- catalogues système lisibles par les membres, catalogues tenant isolés ;
- service role absent des routes publiques ordinaires ;
- opérations internes privilégiées uniquement derrière service applicatif autorisé, transaction et
  tenant explicite ;
- validation tenant côté application avant toute référence inter-aggregate ;
- RLS comme défense supplémentaire, jamais comme unique contrôle ;
- secrets représentés par `SecretReference` opaque ;
- aucun token, credential, secret réel ou payload sensible dans graph, provenance ou logs.

Une tentative cross-tenant retourne `404` lorsque l’existence ne doit pas être révélée, ou `403`
pour une ressource déjà résolue dans un contexte explicite.

## 20. Optimistic locking

`lock_version` est un entier strictement positif.

- chaque commande modifiante exige `expectedVersion` ;
- l’Aggregate refuse une version différente ;
- le repository exécute l’update avec `WHERE id AND tenant_id AND lock_version` ;
- PostgreSQL exige `new.lock_version = old.lock_version + 1` ;
- zéro ligne modifiée retourne `409 GENERATION_VERSION_CONFLICT` ;
- aucun retry silencieux d’une décision concurrente ;
- l’idempotence rejoue une réponse identique sans incrémenter la version.

## 21. Domain Events

Deux événements d’intégration sont nécessaires :

- `AutomationGraphPublished` ;
- `AutomationGenerationDeprecated`.

Ils servent respectivement au futur Validation Engine et aux consommateurs downstream qui doivent
cesser de sélectionner une version. Ils sont enregistrés dans une outbox au sein de la transaction
de transition.

`AutomationGenerationRequested` et `AutomationGraphGenerated` restent des faits de domaine
observables dans l’audit, mais ne sont pas publiés tant qu’aucun consommateur métier n’existe.
Créer un événement sans consommateur est interdit.

## 22. Ports et adapters

### Ports actuels

- `AutomationSpecificationReaderPort` : lit le DTO public publié ;
- `AutomationGenerationRepositoryPort` : persiste et relit l’Aggregate ;
- `GenerationRuleCatalogPort` : sélectionne une version publiée compatible ;
- `TransactionPort` : garantit les frontières atomiques ;
- `ClockPort` : fournit les timestamps documentaires ;
- `DeterministicIdFactory` : calcule les IDs canoniques ;
- `ContentHasherPort` : sérialise canoniquement et calcule SHA-256 ;
- `DomainEventOutboxPort` : persiste les événements dans la transaction.

### Adapters

- entrant : controllers REST NestJS, guards, pipes Zod et DTO ;
- sortant : client REST Automation Specification, repository Prisma/PostgreSQL, hasher et outbox ;
- composition : module NestJS Automation Generator sans import du module interne Specification.

### Ports futurs

- `CanonicalGraphValidationPort` appartient au futur bounded context Validation ;
- `PlatformCompilerPort` appartient au futur bounded context Platform Compilation ;
- `ArtifactRepositoryPort` appartient au futur bounded context Platform Compilation, propriétaire
  des Platform Artifacts.

Ces interfaces peuvent être documentées comme contrats de consommation, mais ne sont ni définies
dans le domaine du Generator ni implémentées pendant V2-3.

## 23. Frontière avec les platform adapters

Les adaptateurs n8n, Make, Zapier, Temporal, Camunda, AWS Step Functions et Azure Logic Apps sont
hors du Generator.

### Options analysées

1. **Sous-module Deployment** : simple, mais mélange compilation et déploiement.
2. **Bounded context Platform Compilation** : sépare la traduction fournisseur de l’accès aux
   environnements.
3. **Adapters du Generator** : rejeté, car introduit les fournisseurs dans sa frontière.

### Décision

La compilation fournisseur appartiendra à un bounded context distinct **Platform Compilation**.
Il consommera uniquement un Canonical Automation Graph publié et validé, produira un Platform
Artifact immuable, puis Deployment le déploiera. Cette séparation évite de coupler le Generator à
une cible et permet une validation avant compilation.

## 24. Frontière avec Validation

Le Generator contrôle seulement :

- identifiants et ports uniques ;
- absence d’arêtes orphelines ;
- références de nœuds, variables, outputs et secrets résolues ;
- conditions typées ;
- branches et joins structurellement fermés ;
- loops bornées selon le contrat canonique ;
- ordre et sérialisation canoniques ;
- graph acyclique sauf constructions de loop explicitement modélisées ;
- provenance complète ;
- absence de code et de secret en clair.

Le futur Validation Engine contrôle :

- sémantique avancée du workflow ;
- sûreté et conformité ;
- compatibilité avec une plateforme ;
- simulation et performance ;
- contraintes de déploiement ;
- politiques organisationnelles.

Le Generator ne demande pas au Validation Engine l’autorisation de publier. Publication signifie
« snapshot canonique figé », pas « workflow validé pour déploiement ». Le downstream doit exiger un
résultat Validation séparé avant Platform Compilation.

## 25. Fonctionnalités non supportées

La décision définitive est **génération refusée**.

Si une capacité source ne peut être représentée :

1. la compilation collecte toutes les capacités non supportées ;
2. elle produit un diagnostic déterministe avec source, raison et versions ;
3. aucun graph `GENERATED` ou snapshot partiel n’est persisté ;
4. la transaction est annulée ;
5. la Generation reste `REQUESTED` ou conserve son précédent candidat intact lors d’un rebuild ;
6. l’API retourne `422 UNSUPPORTED_CAPABILITY`.

Il n’existe pas de statut `PARTIALLY_GENERATED`. Aucune capacité n’est ignorée silencieusement.

## 26. Erreurs

| Erreur domaine                  | HTTP                                              | Code REST                                            |
| ------------------------------- | ------------------------------------------------- | ---------------------------------------------------- |
| `SpecificationNotPublished`     | 422                                               | `SPECIFICATION_NOT_PUBLISHED`                        |
| `SpecificationSnapshotNotFound` | 404                                               | `SPECIFICATION_SNAPSHOT_NOT_FOUND`                   |
| `UnsupportedCapability`         | 422                                               | `UNSUPPORTED_CAPABILITY`                             |
| `InvalidCatalogConfiguration`   | 500 pour catalogue système, 422 pour draft tenant | `INVALID_CATALOG_CONFIGURATION`                      |
| `GenerationInvariantViolation`  | 422                                               | `GENERATION_INVARIANT_VIOLATION`                     |
| `GenerationVersionConflict`     | 409                                               | `GENERATION_VERSION_CONFLICT`                        |
| `InvalidLifecycleTransition`    | 409                                               | `INVALID_LIFECYCLE_TRANSITION`                       |
| `GraphConstructionFailed`       | 422                                               | `GRAPH_CONSTRUCTION_FAILED`                          |
| `CrossTenantAccessDenied`       | 404 ou 403 selon le contexte                      | `RESOURCE_NOT_FOUND` ou `CROSS_TENANT_ACCESS_DENIED` |
| `IdempotencyKeyReused`          | 409                                               | `IDEMPOTENCY_KEY_REUSED`                             |
| `Unauthorized`                  | 401                                               | `UNAUTHORIZED`                                       |
| `Forbidden`                     | 403                                               | `FORBIDDEN`                                          |

Les erreurs inattendues retournent un identifiant de corrélation sans stack, secret ou détail
interne.

## 27. Testing strategy

### Domaine

- invariants de l’Aggregate et matrice complète du lifecycle ;
- Value Objects, expressions, mappings et politiques ;
- chaque type de nœud et d’arête ;
- capacités supportées et unsupported ;
- compilation et provenance exhaustive.

### Déterminisme

- même tuple d’entrée : graph JSON, IDs et hash identiques ;
- ordre source différent mais sémantique identique : sortie canonique identique ;
- timestamps techniques sans effet ;
- golden masters versionnés pour quelques graphs canoniques stables ;
- property-based tests pour ordres, unicité, graphes et sérialisation lorsque leur générateur reste
  déterministe.

### Catalogues

- validation runtime stricte ;
- champs inconnus, versions incompatibles et décisions invalides rejetés ;
- aucune règle non publiée consommée ;
- absence de casts non validés.

### Application et infrastructure

- transaction generate/rebuild et rollback ;
- optimistic locking et idempotence ;
- repository Prisma sans logique métier ;
- alignement Aggregate/Application/PostgreSQL ;
- publication et outbox atomiques ;
- REST, DTO, permissions et traduction d’erreurs ;
- RLS CRUD et isolation cross-tenant ;
- snapshot publié immuable ;
- rebuild ne modifiant jamais une version publiée.

### Frontières

- test interdisant les imports d’autres bounded contexts ;
- aucun SDK fournisseur ;
- aucun secret en clair ;
- aucun appel réseau depuis le domaine.

## 28. Observabilité

Métadonnées autorisées :

- `correlationId` ;
- `generationId` anonymisable et `lineageId` ;
- `generationDurationMs` ;
- `nodeCount`, `edgeCount`, `warningCount` ;
- `unsupportedCapabilityCount` ;
- `generatorVersion`, `graphSchemaVersion`, `ruleCatalogVersion` ;
- `contentHash` ;
- transition, résultat et code d’erreur.

Les logs n’incluent ni graph complet, ni données métier sensibles, ni expression contenant une
valeur confidentielle, ni secret reference résolue. Ces métadonnées préparent Monitoring sans
implémenter le monitoring runtime.

## 29. Non-goals

- aucun déploiement ;
- aucune exécution de workflow ;
- aucun appel réel vers un service externe ;
- aucune génération directe n8n, Make, Zapier ou autre fournisseur ;
- aucune gestion de credentials réels ;
- aucun monitoring runtime ;
- aucune optimisation fondée sur des performances réelles ;
- aucun LLM nécessaire ou autorisé dans la construction déterministe ;
- aucune validation sémantique ou plateforme avancée ;
- aucun Platform Artifact ;
- aucune modification d’un bounded context existant.

## 30. Acceptance Criteria

### Architecture

- bounded context isolé et responsabilités non ambiguës ;
- `AutomationGeneration` adopté comme Aggregate principal ;
- lifecycle `REQUESTED → GENERATED → PUBLISHED → DEPRECATED` figé ;
- graph canonique fournisseur-indépendant défini ;
- stockage hybride et autorité de `graph_json` explicités ;
- capacités unsupported refusant la génération ;
- Platform Compilation positionné dans un futur bounded context distinct ;
- lineage, IDs déterministes, publication et frontière Validation décidés ;
- rôle du `GenerationRuleCatalog` limité aux décisions configurables ;
- aucune question obligatoire laissée ouverte.

### Future implémentation

- consommation exclusive d’une Automation Specification publiée par port public ;
- même tuple d’entrée produisant mêmes graph, IDs et hash ;
- snapshot publié immuable et versionné ;
- provenance exhaustive, sans capacité consommée classée ignored ;
- configuration catalogue validée à l’exécution ;
- optimistic locking et HTTP 409 ;
- generate/rebuild et publication transactionnels ;
- RLS et FKs composites tenant-scoped ;
- aucun accès cross-tenant ;
- aucun secret en clair ;
- aucune dépendance fournisseur ;
- aucun accès direct à un autre bounded context ;
- tests domaine, déterminisme, golden masters, transactions, REST, repository et pgTAP verts ;
- lint, format, typecheck, build et CI verts.

## 31. Décisions d’architecture figées par ce document

1. **Aggregate principal** : `AutomationGeneration`.
2. **Lifecycle** : `REQUESTED → GENERATED → PUBLISHED → DEPRECATED`.
3. **Stockage** : hybride, `graph_json` public autoritaire et projections relationnelles immuables.
4. **Capacité unsupported** : génération intégralement refusée, aucun résultat partiel.
5. **Platform adapters** : futur bounded context distinct `Platform Compilation`.
6. **Lineage** : miroir explicite de la lineage Specification, sans continuité inter-lineage.
7. **Identifiants** : hash déterministe de chemins canoniques et versions de schéma.
8. **Publication** : commande explicite, transactionnelle, snapshot et outbox atomiques.
9. **Validation** : invariants structurels seulement ; validations avancées downstream.
10. **GenerationRuleCatalog** : configuration versionnée, jamais algorithme ou invariant.

## 32. Risques résiduels

- la taille maximale raisonnable d’un graph devra être bornée lors de l’implémentation ;
- le contrat public Automation Specification devra rester stable et versionné ;
- la compatibilité entre versions de schéma, Generator et catalogue exigera une matrice publiée ;
- la consommation des événements devra gérer replay et ordre par lineage ;
- la stratégie de purge des workspaces abandonnés devra respecter audit et rétention ;
- les expressions canoniques devront rester suffisamment expressives sans devenir un langage
  d’exécution arbitraire.

Ces risques ne rouvrent aucune des dix décisions obligatoires et n’autorisent aucune décision
silencieuse pendant l’implémentation.
