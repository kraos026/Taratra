# Automation Specification Engine — Architecture proposée

Statut : **CONTRAT D'IMPLÉMENTATION OFFICIEL — ARCHITECTURE GELÉE**

Ce document constitue le contrat d'implémentation officiel du Sprint AutomateX V2-2. Aucune
nouvelle décision d'architecture ne peut être prise pendant l'implémentation sans une nouvelle
Architecture Review.

Sprint : AutomateX V2-2

## 0. Décision structurante

Automation Specification est un bounded context V2 indépendant. Il transforme exactement une
version **publiée** d'un `SolutionBlueprint` en une ou plusieurs versions immuables
d'`AutomationSpecification`.

```text
Published Solution Blueprint
            |
            v
Automation Specification Engine
            |
            v
Versioned Automation Specification
```

Le contexte ne lit directement ni Recommendation, ni ROI, ni Automation Opportunity, ni aucun
autre agrégat V1. Il ne remonte pas leur chaîne de provenance pour prendre une décision. Le
`SolutionBlueprint` publié et les éléments qu'il a figés constituent son unique contrat source.

Une Automation Specification reste abstraite et indépendante de toute technologie. Elle décrit
ce que l'automatisation doit faire et les contraintes qu'elle doit respecter. Elle ne contient
ni code, ni workflow exécutable, ni configuration de déploiement, ni choix de plateforme.

## 1. Responsabilités du bounded context

### Responsabilités

- accepter uniquement un `SolutionBlueprint` publié et tenant-scoped ;
- traduire les composants, capacités, connecteurs, contraintes et arêtes du Blueprint en un
  contrat fonctionnel et technique abstrait ;
- définir les déclencheurs, entrées, sorties, étapes, dépendances, contrôles, erreurs, exigences
  de sécurité et critères d'acceptation de l'automatisation ;
- préserver une provenance élément par élément vers la version exacte du Blueprint source ;
- valider la cohérence interne d'une spécification à partir de règles explicites et versionnées ;
- gérer un lifecycle versionné, optimistiquement verrouillé et immuable après publication ;
- exposer une représentation déterministe et explicable aux futurs bounded contexts V2.

### Hors périmètre

- générer du code, un script, un workflow ou une configuration exécutable ;
- sélectionner ou recommander une plateforme, un fournisseur ou un produit ;
- déployer, exécuter, planifier, superviser ou optimiser une automatisation ;
- recalculer une Recommendation, un ROI ou une Automation Opportunity ;
- lire Discovery, Interview, Enterprise Knowledge ou un moteur V1 ;
- corriger ou modifier le Blueprint source ;
- enrichir la spécification par un LLM ou par un appel réseau.

## 2. Agrégats

### `AutomationSpecification` — racine d'agrégat

L'agrégat représente une version complète de la spécification issue d'un Blueprint.

Identité et version :

- `id` ;
- `organizationId` ;
- `solutionBlueprintId` ;
- `solutionBlueprintVersionNumber` ;
- `previousVersionId`, nullable pour la première version ;
- `versionNumber` ;
- `status` ;
- `lockVersion`.

Contenu possédé :

- identité fonctionnelle : nom, objectif et portée ;
- `triggers` ;
- `dataContracts` d'entrée et de sortie ;
- `steps` abstraites ;
- `dependencies` entre étapes ;
- `controls` humains ou automatiques ;
- `errorPolicies` ;
- `securityRequirements` ;
- `observabilityRequirements` ;
- `acceptanceCriteria` ;
- `provenanceLinks` ;
- `validationResults`.

Invariants principaux :

1. la source est un Blueprint publié du même tenant ;
2. chaque version référence une seule version exacte de Blueprint ;
3. une version est un snapshot complet, jamais un delta ;
4. `versionNumber` est strictement croissant pour un même Blueprint ;
5. `previousVersionId` référence la version précédente du même tenant et du même Blueprint ;
6. chaque étape a une identité locale stable et au moins une provenance Blueprint ;
7. toute dépendance référence deux étapes existantes et ne crée pas de cycle ;
8. tout contrat de données utilisé par une étape est déclaré ;
9. toute capacité, contrainte ou exigence source pertinente est représentée ou explicitement
   enregistrée comme ignorée avec une justification déterministe ;
10. une version publiée est totalement immuable, enfants compris ;
11. un rebuild crée toujours une nouvelle version `draft` ;
12. aucune transition ne réussit avec un `lockVersion` obsolète.

Les enfants ne sont pas des agrégats indépendants. Ils ne peuvent être créés, modifiés ou
supprimés qu'au travers de la racine.

### `SpecificationRuleCatalogEntry` — agrégat de catalogue

Un catalogue est nécessaire uniquement pour les règles de transformation et de validation qui
ne sont pas déjà figées dans le Blueprint. Il empêche de cacher des décisions dans le code.

Chaque entrée contient :

- `code`, `version`, `status` ;
- `ruleType` : `transformation` ou `validation` ;
- `conditionJson` ;
- `resultJson` ou `validationJson` ;
- `severity` pour une validation ;
- `description` et justification ;
- `createdAt`, `publishedAt`.

Le moteur ne consomme que des entrées publiées. Les versions de règles effectivement utilisées
sont figées dans la spécification. Les primitives structurelles universelles — unicité d'identité,
références valides, transitions de lifecycle et contrôle de concurrence — restent des invariants
du domaine et de PostgreSQL, pas des règles configurables.

Le catalogue sélectionne des décisions métier configurables, configure les comportements
configurables et versionne ces décisions. Il ne décrit jamais un algorithme, un ordre d'exécution,
un invariant métier, une transition de lifecycle ou un calcul déterministe. Ces responsabilités
appartiennent exclusivement au domaine. Le catalogue complète le moteur ; il ne le remplace
jamais.

## 3. Value Objects

| Value Object               | Rôle et invariants                                                         |
| -------------------------- | -------------------------------------------------------------------------- |
| `SpecificationId`          | UUID non vide                                                              |
| `BlueprintReference`       | `id`, numéro de version et tenant de la source publiée                     |
| `SpecificationVersion`     | entier strictement positif                                                 |
| `LockVersion`              | entier strictement positif comparé à chaque commande                       |
| `SpecificationStatus`      | `draft`, `validated`, `published`, `archived`                              |
| `LocalElementId`           | identifiant stable et unique dans une spécification                        |
| `TriggerDefinition`        | événement abstrait, conditions d'entrée et provenance                      |
| `DataContract`             | nom, direction, schéma abstrait, sensibilité et contraintes                |
| `SpecificationStep`        | responsabilité atomique abstraite, entrées, sorties et capacité requise    |
| `StepDependency`           | source, cible et type de dépendance autorisé                               |
| `ControlDefinition`        | contrôle automatique ou validation humaine, sans implémentation            |
| `ErrorPolicy`              | catégorie d'échec et comportement attendu, sans syntaxe de plateforme      |
| `SecurityRequirement`      | exigence d'authentification, autorisation, secret ou protection de données |
| `ObservabilityRequirement` | événement, métrique ou trace attendue                                      |
| `AcceptanceCriterion`      | condition vérifiable et résultat attendu                                   |
| `ProvenanceLink`           | élément cible, élément Blueprint source, règle et justification            |
| `IgnoredSourceElement`     | élément Blueprint non consommé et justification obligatoire                |
| `ValidationResult`         | règle/version, sévérité, statut, cible et explication                      |

Les Value Objects sont immuables, validés à leur création et dépourvus de dépendance Prisma,
HTTP ou Supabase.

## 4. Services métier

### `AutomationSpecificationEngine`

Service de domaine pur et déterministe.

Entrées :

- snapshot du `PublishedSolutionBlueprint` ;
- versions publiées des règles de transformation et de validation.

Sortie :

- contenu complet d'une spécification candidate ;
- règles consommées ;
- liens de provenance ;
- éléments source ignorés et justifications ;
- résultats de validation.

Le service n'effectue ni I/O, ni appel réseau, ni persistance. À entrées identiques, il produit
une sortie identique. Il ne répare jamais une source invalide.

### `SpecificationGraphValidator`

Vérifie les identités locales, références, dépendances, cycles et contrats de données. Il ne
crée ni ne réordonne silencieusement les étapes.

### `SpecificationLifecyclePolicy`

Porte les transitions permises et les invariants d'immutabilité. Ces invariants sont appliqués
simultanément par l'agrégat, le service applicatif et PostgreSQL.

### Services applicatifs

- `GenerateAutomationSpecification` ;
- `RebuildAutomationSpecification` ;
- `ValidateAutomationSpecification` ;
- `PublishAutomationSpecification` ;
- `GetAutomationSpecification` ;
- `ListAutomationSpecifications`.

Ils authentifient le cas d'usage, résolvent le tenant et les permissions, ouvrent une transaction,
chargent les ports, invoquent le domaine, persistent le snapshot et traduisent les erreurs. Ils
ne contiennent aucune règle de transformation.

### Ports

- `PublishedSolutionBlueprintReader` : expose uniquement le contrat de lecture minimal d'un
  Blueprint publié ;
- `SpecificationRuleCatalogReader` : retourne les versions publiées applicables ;
- `AutomationSpecificationRepository` : charge et persiste l'agrégat ;
- `UnitOfWork` : garantit l'atomicité des commandes.

Le port Blueprint appartient au côté consommateur. Le bounded context ne dépend ni du repository
Prisma ni des services applicatifs internes de Solution Designer.

## 5. Événements de domaine

Les événements décrivent des faits accomplis. Leur publication dans une outbox transactionnelle
est recommandée pour les futurs consommateurs, mais aucun consommateur ni workflow n'est créé
dans ce Sprint.

- `AutomationSpecificationDraftCreated` ;
- `AutomationSpecificationRebuilt` ;
- `AutomationSpecificationValidated` ;
- `AutomationSpecificationPublished` ;
- `AutomationSpecificationArchived`.

Enveloppe commune :

- `eventId`, `occurredAt` ;
- `organizationId` ;
- `automationSpecificationId` ;
- `versionNumber` ;
- `solutionBlueprintId` et version source ;
- `actorId` ;
- `correlationId`.

Les événements publiés ne transportent pas de secrets. Un événement n'est émis qu'après le
respect des invariants et dans la même transaction que le changement d'état.

## 6. Cycle de vie

```text
generate/rebuild
      |
      v
    draft ----validate----> validated ----publish----> published
      |                         |                          |
      +------ archive ----------+--------------------------+
                                                          v
                                                       archived
```

- `generate` crée la version 1 `draft` depuis un Blueprint publié ;
- `rebuild` ne modifie jamais une version existante : il crée une nouvelle version `draft` et
  renseigne `previousVersionId` ;
- `validate` exige zéro erreur bloquante et fige les résultats de validation de la version ;
- `publish` exige le statut `validated`, la dernière version de la lignée et des résultats de
  validation toujours cohérents ;
- `archive` retire une version de l'usage courant sans la supprimer ;
- une version publiée est immuable, y compris son contenu, sa provenance, ses validations et les
  versions de catalogue utilisées.

Les commandes concurrentes comparent `lockVersion`. Une divergence retourne HTTP 409. La
numérotation de version et le rebuild sont protégés dans une transaction unique par verrou
transactionnel et contrainte d'unicité.

## 7. Permissions

| Action                                       | Viewer | Consultant | Admin | Owner |
| -------------------------------------------- | -----: | ---------: | ----: | ----: |
| Lire/listes dans son organisation            |    oui |        oui |   oui |   oui |
| Générer un draft                             |    non |        oui |   oui |   oui |
| Rebuild d'un draft/version                   |    non |        oui |   oui |   oui |
| Valider                                      |    non |        oui |   oui |   oui |
| Publier                                      |    non |        non |   oui |   oui |
| Archiver                                     |    non |        non |   oui |   oui |
| Gérer les catalogues organisationnels futurs |    non |        non |   oui |   oui |

Toutes les autorisations sont vérifiées dans le service applicatif et dans les politiques RLS.
L'identité tenant ne vient jamais d'un champ libre du client. Une lecture par identifiant reste
filtrée par `organizationId`.

## 8. Modèle de données proposé

### Tables principales

#### `automation_specifications`

- `id uuid primary key` ;
- `organization_id uuid not null` ;
- `solution_blueprint_id uuid not null` ;
- `solution_blueprint_version_number integer not null` ;
- `previous_version_id uuid null` ;
- `version_number integer not null` ;
- `status automation_specification_status not null` ;
- `lock_version integer not null default 1` ;
- `name`, `objective`, `scope` ;
- `source_fingerprint text not null` ;
- `created_by uuid not null` ;
- `created_at`, `updated_at`, `validated_at`, `published_at`, `archived_at`.

Contraintes :

- unicité `(organization_id, id)` ;
- unicité `(organization_id, solution_blueprint_id, version_number)` ;
- FK composite de la source `(solution_blueprint_id, organization_id)` vers
  `solution_blueprints(id, organization_id)` ;
- FK composite de `previous_version_id` vers une spécification du même tenant ;
- contrôles de statut, version et verrou ;
- trigger d'immutabilité des versions publiées.

#### `automation_specification_elements`

Stocke les éléments possédés par le snapshot :

- `id`, `organization_id`, `automation_specification_id` ;
- `local_id` ;
- `element_type` : trigger, data contract, step, dependency, control, error policy, security,
  observability ou acceptance criterion ;
- `definition_json` validé à l'entrée et contraint par son type ;
- `display_order`.

Un format relationnel commun préserve l'extensibilité sans multiplier les agrégats. Les champs
fortement requêtés restent sur la racine ; la forme JSON est un snapshot validé, pas un espace
libre de logique métier.

`definition_json` est exclusivement la représentation sérialisée d'un Value Object préalablement
validé par le domaine. Il constitue un snapshot immuable de données métier. Il ne contient jamais
de logique métier, d'algorithme, de règle de décision, de comportement dépendant d'une plateforme
ou de configuration d'exécution. Toute logique reste portée par les agrégats, les Value Objects,
les services de domaine et les catalogues versionnés, dans les limites de responsabilité définies
pour chacun.

#### `automation_specification_provenance`

- `organization_id`, `automation_specification_id` ;
- `target_element_id` ;
- `source_blueprint_element_type`, `source_blueprint_element_id` ;
- `catalog_rule_code`, `catalog_rule_version`, nullable pour une correspondance directe ;
- `reason` ;
- `consumed boolean`.

Une entrée non consommée exige une justification.

#### `automation_specification_validations`

- `organization_id`, `automation_specification_id` ;
- `rule_code`, `rule_version` ;
- `severity` : error, warning, information ;
- `passed` ;
- `target_element_id`, nullable pour une validation globale ;
- `details_json`.

#### `automation_specification_rule_catalog`

- `id`, `organization_id nullable`, `code`, `version` ;
- `status`, `rule_type`, `condition_json`, `result_json` ;
- `severity nullable`, `description` ;
- `created_at`, `published_at`.

Une résolution de catalogue choisit une version organisationnelle publiée lorsqu'elle existe,
sinon une version système publiée, selon une règle de précédence explicitement testée. Aucun seed
fonctionnel n'est défini avant validation de la présente architecture.

### RLS et intégrité

- RLS activée sur toutes les tables tenant-scoped ;
- policies avec colonnes entièrement qualifiées ;
- membres : lecture dans leur organisation ;
- consultants/admins/owners : création et validation dans leur organisation ;
- admins/owners : publication et archivage ;
- aucune clé service dans une route utilisateur ;
- FK composites tenant-scoped partout où PostgreSQL le permet ;
- triggers privés, `search_path` vide, droits d'exécution révoqués ;
- `updated_at` automatique uniquement pour les versions encore mutables ;
- aucune suppression en cascade ne peut supprimer le contenu d'un snapshot publié.

## 9. API publique proposée

Toutes les réponses utilisent l'enveloppe JSON commune du projet. Les commandes valident leur
payload avec Zod et retournent 409 lors d'un conflit de verrou/version.

```text
POST /api/solution-blueprints/:id/automation-specifications
POST /api/automation-specifications/:id/rebuild
POST /api/automation-specifications/:id/validate
POST /api/automation-specifications/:id/publish
POST /api/automation-specifications/:id/archive
GET  /api/automation-specifications/:id
GET  /api/solution-blueprints/:id/automation-specifications
```

Commandes de transition :

```json
{
  "lockVersion": 3
}
```

La liste accepte `status`, `page`, `pageSize`, `latestPublished`. Aucun endpoint n'accepte
Recommendation, ROI, Automation Opportunity, plateforme cible, code ou workflow.

## 10. Règles métier

1. Seul un Blueprint `published` peut produire une spécification.
2. La source doit appartenir à l'organisation active.
3. Une spécification référence une version exacte et un fingerprint immuable de sa source.
4. La génération ne traverse jamais la provenance amont du Blueprint.
5. Toute décision de transformation configurable vient d'une règle de catalogue publiée.
6. Les règles et leurs versions consommées sont figées dans le résultat.
7. Une étape décrit une responsabilité, jamais une implémentation ou une plateforme.
8. Les dépendances forment un graphe dirigé acyclique.
9. Les entrées et sorties référencées doivent être déclarées.
10. Les contraintes et capacités pertinentes du Blueprint doivent être couvertes ou justifiées
    comme non consommées.
11. Une validation de sévérité `error` en échec interdit la validation et la publication.
12. Les warnings et informations restent conservés et explicables.
13. La génération et le rebuild sont déterministes.
14. Un rebuild crée une nouvelle version complète dans une transaction unique.
15. Seule la dernière version d'une lignée peut progresser vers publication.
16. Une version publiée et ses enfants ne peuvent plus être modifiés ou supprimés.
17. Toute transition exige le `lockVersion` attendu et l'incrémente exactement de un.
18. Le moteur refuse une source ou un catalogue invalide ; il ne les corrige jamais.

## 11. Stratégie de versioning

### Spécifications

- versionnement par lignée de `solutionBlueprintId` ;
- snapshot complet à chaque version ;
- `previousVersionId` pour la chaîne d'audit ;
- contrainte unique sur tenant, Blueprint et numéro de version ;
- fingerprint canonique du Blueprint pour prouver la source exacte ;
- rebuild idempotent au niveau d'une requête grâce à une clé de corrélation, mais créateur d'une
  seule nouvelle version ;
- aucune mise à jour destructive d'une version précédente.

Toute nouvelle version publiée d'un Solution Blueprint ouvre une nouvelle lignée d'Automation
Specification. Une lignée ne référence qu'une seule version canonique de Blueprint. Les liens
entre anciennes et nouvelles lignées sont conservés uniquement pour la navigation, l'audit et la
traçabilité. Aucune continuité implicite entre deux lignées n'est autorisée.

### Catalogues

- couple `(code, version)` immuable après publication ;
- désactivation sans suppression ;
- statut `draft`, `published`, `retired` ;
- une spécification mémorise chaque version réellement utilisée ;
- une nouvelle règle n'altère jamais les spécifications existantes ;
- le code ne contient aucune matrice métier équivalente au catalogue.

### Optimistic locking

Le verrou est garanti simultanément par :

- l'agrégat, qui compare la version attendue ;
- le service applicatif, qui exige le token client ;
- PostgreSQL, via une mise à jour conditionnelle et les triggers de lifecycle.

La création d'une nouvelle version utilise une seule transaction avec verrou transactionnel de la
lignée, lecture `FOR UPDATE`, calcul du prochain numéro et insertion du snapshot complet.

## 12. Justification des choix d'architecture

### Bounded context séparé

Le Blueprint exprime une architecture abstraite ; la Specification exprime un contrat détaillé
de comportement. Les séparer évite de faire du Solution Designer un générateur et permet aux
futurs générateurs de consommer un contrat stable sans dépendre de la V1.

### Source unique

Limiter la lecture au Blueprint publié supprime les dépendances transitives vers Recommendation,
ROI et Automation Opportunity. Le contexte reste testable avec un snapshot source et ne peut ni
réinterpréter ni contredire les décisions amont.

### Snapshot complet immuable

Un snapshot complet facilite l'audit, la reproductibilité, l'explicabilité et les comparaisons.
L'espace supplémentaire est accepté en échange d'une histoire fiable et de lectures simples.

### Catalogue limité aux décisions configurables

Les mappings métier évolutifs appartiennent à des catalogues versionnés. Le catalogue sélectionne,
configure et versionne uniquement les décisions métier configurables. Il ne décrit jamais un
algorithme, un ordre d'exécution, un invariant métier, une transition de lifecycle ou un calcul
déterministe. Les invariants structurels et ces responsabilités d'exécution restent dans le
domaine et PostgreSQL afin d'éviter qu'une configuration puisse désactiver l'intégrité
fondamentale. Le catalogue complète le moteur ; il ne le remplace jamais.

### Représentation abstraite

Les étapes, contrats et contrôles sont indépendants d'un fournisseur. Cette frontière interdit
qu'une préférence de plateforme pénètre prématurément dans la chaîne et réserve la génération
exécutable au futur Automation Generator.

### Défense en profondeur

Les invariants critiques sont répétés aux niveaux domaine, application et base. Les filtres
tenant, FK composites et RLS rendent une erreur applicative insuffisante pour provoquer une fuite
inter-tenant.

### Déterminisme et explicabilité

Chaque élément est relié à un élément Blueprint et, le cas échéant, à une règle/version. Les
éléments ignorés sont conservés avec justification. La même source et les mêmes catalogues
produisent le même résultat.

## 13. Frontières de dépendance

```text
presentation (HTTP/Zod)
        |
        v
application (use cases + ports)
        |
        v
domain (aggregate + value objects + pure services)
        ^
        |
infrastructure (Prisma/Supabase adapters)
```

Dépendances interdites :

- `domain` vers Prisma, Next.js, Supabase ou Zod ;
- `application` vers une implémentation Prisma ;
- `presentation` contenant une règle métier ;
- import direct d'un module Recommendation, ROI ou Automation Opportunity ;
- lecture directe de leurs tables ;
- import d'un repository interne de Solution Designer ;
- logique de transformation dans une migration ou une route.

Un test d'architecture devra faire échouer le build si ces frontières sont violées.

## 14. Stratégie de tests attendue après validation

Cette section décrit la couverture future ; aucun test n'est implémenté avant validation.

- tests unitaires des Value Objects, invariants et transitions ;
- tests déterministes du moteur pour chaque règle de transformation ;
- tests de graphe : références, contrats, cycles et éléments orphelins ;
- tests de provenance complète et des éléments ignorés ;
- tests de rebuild atomique, versionnement et optimistic locking ;
- tests d'immutabilité applicative et PostgreSQL ;
- tests API : validation, permissions, 404, 409 et enveloppes ;
- pgTAP : RLS lecture/écriture inter-tenant et matrice des rôles ;
- tests de FK composites et de triggers ;
- tests d'architecture des imports et dépendances interdites ;
- tests prouvant l'absence de code, workflow et plateforme cible dans les sorties.

## 15. Décisions d'implémentation gelées

1. **Lignées** : toute nouvelle version publiée d'un Solution Blueprint ouvre une nouvelle lignée.
   Une lignée référence une seule version canonique de Blueprint. Les liens inter-lignées servent
   uniquement à la navigation, à l'audit et à la traçabilité, sans continuité implicite.
2. **Catalogue organisationnel** : le modèle autorise cette extension, mais le MVP utilise
   uniquement des règles système afin de ne pas introduire une fonctionnalité de configuration
   non demandée.
3. **Archive** : la transition et la route dédiées font partie du contrat pour assurer la cohérence
   avec Solution Designer.
4. **Outbox** : les événements de domaine font partie du contrat ; la persistance outbox est
   différée jusqu'à l'arrivée d'un consommateur.
5. **`definition_json`** : il reste un snapshot typé par discriminant d'un Value Object validé,
   sans logique ni configuration d'exécution. Une évolution vers des tables spécialisées exige
   une nouvelle Architecture Review.

## 16. Gel architectural

Ce document autorise uniquement une implémentation strictement conforme au présent contrat.
L'architecture est gelée. Aucune nouvelle décision d'architecture ne peut être prise pendant le
développement sans une nouvelle Architecture Review.
