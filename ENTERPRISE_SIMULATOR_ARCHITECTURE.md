# Enterprise Simulator — Architecture

Statut : **PROPOSITION POUR ARCHITECTURE REVIEW — PR 1**

Ce document définit un outil interne externe au runtime et aux bounded contexts d'AutomateX.
Aucune implémentation complète ne peut commencer avant validation de cette architecture.

## 1. Objectif

Enterprise Simulator génère des entreprises fictives reproductibles, les fait interagir avec les
API publiques d'AutomateX comme le ferait un client réel, puis compare les snapshots V1 produits
avec une vérité terrain déterministe connue.

Le simulateur mesure la capacité de la chaîne V1 à reconstruire, expliquer et prioriser les
réalités d'une entreprise simulée. Il est un outil de test, pas une source de décisions métier.

## 2. Périmètre

- scénarios d'entreprises fictives versionnés et seedés ;
- acteurs, départements, systèmes, processus et documents simulés ;
- vérité terrain structurée et versionnée ;
- réponses Discovery et Interview déterministes ;
- client HTTP des API publiques AutomateX ;
- orchestration du pipeline V1 ;
- validation structurée des résultats ;
- calcul de métriques et d'un score global ;
- génération de rapports JSON et Markdown ;
- CLI interne ;
- suites smoke, standard, full et adversarial ;
- mode LLM facultatif, jamais requis par la CI.

Le package cible est `tools/enterprise-simulator`. Il reste indépendant des modules sous
`src/modules` et n'est jamais importé par l'application.

## 3. Non-objectifs

Enterprise Simulator ne doit jamais :

- modifier ou remplacer une règle métier V1 ;
- accéder à Prisma, PostgreSQL, Supabase Database ou aux tables internes ;
- appeler un repository ou service applicatif interne ;
- influencer une recommandation attendue après le début d'un run ;
- produire la vérité terrain avec un LLM ;
- devenir un bounded context métier ;
- être inclus dans le bundle ou le runtime de production ;
- créer des données réelles ou utiliser des données client ;
- contourner une API absente avec un accès privilégié ;
- modifier les architectures gelées V1 ou V2.

## 4. Architecture

```text
CLI / CI
   |
SimulationApplication
   |---- ScenarioRepository (fixtures versionnées)
   |---- ScenarioGenerator (déterministe)
   |---- InterviewResponder
   |---- DocumentGenerator
   |---- AutomateXClient (HTTP uniquement)
   |---- ValidationEngine
   |---- MetricsEngine
   `---- ReportWriter
              |
              v
       reports locaux, sans secrets

AutomateXClient
   |
   v
API REST publique AutomateX
   |
Discovery -> Interview -> Knowledge -> Process -> Analysis
          -> AI Opportunity -> Automation Opportunity -> ROI -> Recommendation
```

### Couches internes

- `domain` : scénarios, vérité terrain, matching, métriques et invariants purs ;
- `application` : orchestration des runs et ports ;
- `infrastructure` : HTTP, fichiers, horloge, hash, PRNG et reporting ;
- `scenarios` : manifestes de scénarios ;
- `catalogs` : données génératives et configurations versionnées ;
- `cli` : parsing des commandes et composition.

Les dépendances pointent vers le domaine. Le domaine ne dépend ni de Node HTTP, ni d'AutomateX, ni
d'un LLM.

### Isolation du repository principal

- aucun import de `src/modules`, `prisma` ou `src/infrastructure` ;
- package privé, non référencé par `dependencies` de l'application ;
- workflow CI séparé ;
- exclusion explicite des builds de production ;
- test d'architecture interdisant les dépendances prohibées.

## 5. Modèle de simulation

### `SimulationScenario`

Racine immuable et versionnée :

- identité : `id`, `version`, `seed`, `catalogVersion`, `createdAt` ;
- entreprise : `name`, `sector`, `country`, `companySize`, `employeeCount`,
  `annualRevenueRange`, `operatingModel` ;
- maturités : `digitalMaturity`, `automationMaturity`, `aiMaturity` ;
- structure : `departments`, `actors`, `systems`, `processes`, `documents` ;
- contexte : `painPoints`, `constraints`, `risks`, `objectives` ;
- oracle : `groundTruth`, `expectedOutcomes`.

Une version de scénario est un snapshot. Elle n'est jamais modifiée après utilisation dans un run.

### `SimulatedDepartment`

Identité stable, nom catalogué, mission, responsabilités, effectif et relations avec les autres
départements.

### `SimulatedActor`

`role`, `department`, `authorityLevel`, `knowledgeScope`, `communicationStyle`,
`digitalLiteracy`, `objectives`, `frustrations`, `knownFacts`, `unknownFacts`, `biases`,
`contradictions`, `responseConsistency`.

Un acteur ne peut répondre qu'avec ses faits connus ou une incertitude explicitement configurée.
Il ne reçoit jamais la totalité de la vérité terrain.

### `SimulatedProcess`

`name`, `owner`, `department`, `trigger`, `inputs`, `steps`, `outputs`, `systems`, `frequency`,
`volume`, `duration`, `manualEffort`, `errorRate`, `reworkRate`, `waitingTime`, `cost`,
`businessCriticality`, `complianceSensitivity`, `automationPotential`, `aiPotential`,
`dependencies`, `bottlenecks`.

Les durées, volumes, taux et coûts utilisent des unités explicites.

### `SimulationRun`

Identité, scénario/hash, commit AutomateX, environnement, timestamps, correlation ID, étapes,
snapshots, métriques, écarts, statut et références de rapports. Le run ne contient aucun token.

## 6. Modèle de vérité terrain

`GroundTruth` est produit avant tout appel à AutomateX par les catalogues et règles déterministes
du simulateur. Il contient :

- `canonicalProcesses` ;
- `canonicalPainPoints` ;
- `canonicalBusinessFindings` ;
- `canonicalAiOpportunities` ;
- `canonicalAutomationOpportunities` ;
- `expectedRoiRanges` ;
- `expectedRecommendationPriorities` ;
- `expectedDependencies` ;
- `expectedRoadmapOrder` ;
- `expectedRisks` ;
- `expectedEvidenceLinks`.

Chaque élément possède :

- un identifiant canonique stable ;
- les attributs nécessaires au matching ;
- sa provenance dans le scénario ;
- une importance ;
- une tolérance éventuelle explicitement versionnée.

La vérité terrain est gelée dans le hash du scénario. Les résultats d'AutomateX ne peuvent jamais
la modifier.

## 7. Contrats avec AutomateX

### Règle d'accès

`AutomateXClient` utilise exclusivement HTTPS et les API publiques authentifiées. Il ne partage
aucun type Prisma ni aucune connexion de base. Ses DTO sont définis côté simulateur à partir des
contrats HTTP observables.

### Capacités publiques actuellement observées

| Étape                  | API publique observée                                                                | État pour le simulateur                           |
| ---------------------- | ------------------------------------------------------------------------------------ | ------------------------------------------------- |
| Organisation           | `POST /api/onboarding/organization`                                                  | création possible pour un utilisateur authentifié |
| Entreprise             | `POST /api/companies`                                                                | disponible                                        |
| Discovery              | `POST /api/companies/:id/discovery`, `PATCH /api/discovery-sessions/:id`, validation | disponible                                        |
| Interview              | création, réponse, navigation, completion et validation                              | disponible                                        |
| Knowledge              | aucune lecture publique directe observée                                             | contrat read-only futur défini                    |
| Process Mapping        | création depuis `knowledge-snapshots/:id`, lecture et lifecycle                      | utilisera le DTO Knowledge public                 |
| Business Analysis      | création depuis Process Map, lecture et lifecycle                                    | disponible                                        |
| AI Opportunity         | création, lecture et lifecycle                                                       | disponible                                        |
| Automation Opportunity | création, lecture et lifecycle                                                       | disponible                                        |
| ROI                    | création, lecture et lifecycle                                                       | disponible                                        |
| Recommendation         | création, lecture et lifecycle                                                       | disponible                                        |
| Nettoyage tenant       | aucune suppression publique de tenant observée                                       | test control plane futur défini                   |

L'inventaire détaillé est dans
`tools/enterprise-simulator/contracts/automatex-public-api.md`.

### Résilience du client

- timeout explicite par requête et par étape ;
- retries bornés seulement pour les erreurs transitoires et les opérations sûres/idempotentes ;
- `Idempotency-Key` UUIDv7 obligatoire pour chaque commande mutante ;
- `X-Correlation-ID` commun au run ;
- contrôle des versions et `lockVersion` ;
- journal d'exécution sans headers sensibles ;
- validation de chaque réponse avant consommation ;
- arrêt immédiat sur violation tenant, version ou provenance.

Une commande mutante n'est jamais envoyée tant que l'API cible ne respecte pas le contrat
d'idempotence défini. Un endpoint ne propageant pas le correlation ID est considéré incompatible
avec l'intégration complète.

## 8. Génération déterministe

Toute génération dépend exclusivement du tuple :

```text
(scenario seed, scenario schema version, catalog versions, generator version)
```

`SeededRandom` est le seul port aléatoire :

- `integer(min, max)` ;
- `decimal(min, max)` ;
- `boolean(probability)` ;
- `pick(items)` ;
- `weightedPick(items)` ;
- `shuffle(items)` ;
- `uuid()`.

`Math.random`, les UUID non seedés, l'heure système et l'ordre du filesystem sont interdits dans
le domaine. Une horloge injectée fixe `createdAt` lors des tests.

Les choix sont évalués dans un ordre canonique documenté. Chaque tirage peut être enregistré avec
son chemin logique pour expliquer un scénario.

Le hash utilise une sérialisation JSON canonique avec clés triées. Deux scénarios identiques ont
le même hash indépendamment de leur mise en forme.

## 9. Utilisation optionnelle d'un LLM

Modes :

1. `deterministic-template` — mode par défaut et unique mode obligatoire en CI ;
2. `llm-assisted` — reformulation facultative ;
3. `adversarial` — anomalies prédéfinies et déterministes.

Le LLM peut uniquement reformuler une réponse structurée, générer une variante linguistique ou
mettre en forme un document fictif. Il ne reçoit pas le droit de changer un fait critique.

Flux :

```text
Ground Truth déterministe
  -> réponse structurée autorisée pour l'acteur
  -> reformulation LLM facultative
  -> extraction/validation des faits critiques
  -> rejet si différence
```

Le fournisseur LLM est derrière un port optionnel. Aucune clé n'est requise, aucun appel n'est
effectué sans activation explicite, et aucun score officiel n'utilise un jugement LLM.

## 10. Algorithme de validation

1. Valider le schéma et le hash du scénario.
2. Normaliser les identifiants, noms, unités et ensembles.
3. Extraire les résultats structurés des snapshots publics.
4. Sélectionner la règle de matching versionnée par type d'objet.
5. Associer d'abord les identifiants structurés exacts.
6. Associer ensuite les noms normalisés sous les contraintes de département/processus.
7. Comparer attributs, ensembles, graphes et plages numériques.
8. Classer chaque résultat : vrai positif, faux positif, faux négatif ou non comparable.
9. Conserver la décision, la règle/version, les valeurs comparées et la justification.
10. Calculer les métriques avec une politique explicite pour les ensembles vides.
11. Évaluer les seuils versionnés.
12. Produire le statut final et les rapports.

### Matching

- identifiants : égalité exacte ;
- noms : Unicode normalisé, casse et espaces normalisés, alias catalogués ;
- ensembles : intersection, éléments manquants et éléments inattendus ;
- valeurs : unité commune et tolérance cataloguée ;
- dépendances : comparaison d'arêtes orientées ;
- ordre de roadmap : exactitude par position et contraintes d'antériorité.

Le moteur ne fait aucun matching sémantique non déterministe.

### Divisions par zéro

- précision : `1` si attendu et prédit sont tous deux vides, sinon `0` si prédit est vide ;
- rappel : `1` si attendu est vide et aucune prédiction n'existe, sinon `0` si attendu est vide
  mais des éléments sont prédits ;
- F1 : `0` si précision + rappel vaut zéro.

Cette convention est versionnée avec les règles de scoring.

## 11. Métriques

Métriques obligatoires :

1. Process Precision ;
2. Process Recall ;
3. Process F1 ;
4. Pain Point Precision ;
5. Pain Point Recall ;
6. Business Finding Accuracy ;
7. AI Opportunity Precision ;
8. AI Opportunity Recall ;
9. Automation Opportunity Precision ;
10. Automation Opportunity Recall ;
11. ROI Range Accuracy ;
12. Recommendation Priority Accuracy ;
13. Dependency Accuracy ;
14. Roadmap Ordering Accuracy ;
15. Evidence Coverage ;
16. Explainability Coverage ;
17. Determinism Score ;
18. Pipeline Completion Rate ;
19. Average Execution Duration ;
20. Failure Rate.

Formules :

```text
precision = true positives / predicted positives
recall    = true positives / expected positives
f1        = 2 * precision * recall / (precision + recall)
```

Le score global vaut `sum(metric group score * configured weight)`, borné entre 0 et 100. Les
poids ne résident pas dans le moteur. La proposition v1 :

- Process Mapping : 20 % ;
- Business Analysis : 15 % ;
- AI Opportunity : 10 % ;
- Automation Opportunity : 20 % ;
- ROI : 15 % ;
- Recommendation : 15 % ;
- Explainability : 5 %.

Les seuils initiaux internes sont configurés dans le catalogue proposé. Ils ne constituent pas
une preuve scientifique.

## 12. Stratégie de tests

### Unitaires

- PRNG, choix pondérés, UUID et shuffle reproductibles ;
- invariants des scénarios et acteurs ;
- génération de vérité terrain ;
- matching exact, normalisé, ensembles, plages et graphes ;
- divisions par zéro ;
- métriques, poids et seuils ;
- redaction des secrets ;
- refus d'environnement de production.

### Contrats

- validation des DTO de requêtes/réponses ;
- inventaire des routes publiques ;
- erreurs, timeout, retry et verrou optimiste ;
- absence d'import interne ;
- absence de Prisma et accès DB.

### End-to-end

- smoke : 2 scénarios sur PR ;
- standard : 10 scénarios avant fusion ;
- full : 20+ scénarios manuels ou planifiés ;
- adversarial : sécurité, concurrence et données invalides.

### Reproductibilité

- même seed/version : même scénario/hash ;
- même scénario/version V1 : mêmes résultats métier ;
- dix runs : aucune différence métier ;
- seed différent : scénario différent ;
- catalogue différent : version/hash différents ;
- rapport historique : versions et résultats relisibles.

### Multi-tenant

Deux tenants simultanés au minimum. Chaque lecture, écriture, snapshot, recommandation et rapport
est vérifié contre son tenant anonymisé. Toute fuite rend le run `FAILED`.

Le plan détaillé est dans `tools/enterprise-simulator/TEST_PLAN.md`.

## 13. Sécurité

- allowlist d'origines locales, éphémères et de staging de test ;
- refus par défaut de toute origine classée production ;
- activation exceptionnelle impossible par un simple flag CLI : elle exige une policy signée,
  un identifiant d'environnement autorisé et une confirmation hors processus ;
- comptes et tenants préfixés comme données de test ;
- nettoyage autorisé uniquement si le marqueur de tenant test et le correlation ID correspondent ;
- aucun service role, accès DB ou secret dans les fixtures ;
- tokens en mémoire uniquement, redaction des logs et destruction après run ;
- retries bornés et rate limiting client ;
- taille maximale des réponses et documents ;
- validation stricte des URL pour prévenir SSRF et redirections hors origine ;
- rapports sans données d'authentification.

## 14. Confidentialité

Toutes les données sont synthétiques :

- noms, emails, téléphones, identifiants et documents fictifs ;
- domaines réservés comme `example.invalid` ;
- aucun import de données client ou production ;
- aucune copie de logs métier réels ;
- rapports anonymisant les identifiants de tenant et utilisateur ;
- durée de conservation configurable ;
- nettoyage sûr des artefacts temporaires.

Un LLM éventuel ne reçoit que des données fictives et minimisées.

## 15. Reproductibilité

Chaque run fige :

- scénario, seed, hash et version ;
- versions de tous les catalogues ;
- version du générateur et des règles de matching ;
- commit SHA AutomateX ;
- configuration de score et seuils ;
- mode de réponse ;
- versions des snapshots récupérés ;
- horodatage et environnement non sensible.

Les champs temporels et identifiants techniques volatils sont exclus de la comparaison métier,
mais conservés pour l'audit.

## 16. Reporting

Artefacts :

- `report.json` : détail canonique ;
- `report.md` : lecture humaine déterministe ;
- `summary.json` : statut, score et métriques principales ;
- `failures.json` : écarts, erreurs et preuves.

Le rapport contient scénario, seed, versions, SHA AutomateX, durée, tenant anonymisé, snapshots,
métriques, score, attendus, obtenus, écarts, erreurs, warnings, décisions de matching, provenance
et statut.

Statuts :

- `PASSED` ;
- `PASSED_WITH_WARNINGS` ;
- `FAILED` ;
- `INFRASTRUCTURE_ERROR`.

Une erreur d'infrastructure n'est jamais comptée comme une erreur métier et ne peut produire un
score artificiellement réussi.

## 17. Critères d'acceptation

### PR 1 — architecture et contrats

- architecture cohérente et approuvée ;
- package séparé défini ;
- schémas Scenario et GroundTruth versionnés ;
- interfaces et contrats HTTP définis sans import AutomateX interne ;
- catalogues initiaux proposés ;
- plan de tests complet ;
- risques et blocages publics explicités ;
- aucun moteur V1/V2 modifié ;
- build, lint, typecheck, tests et CI existants verts.

### PR 2 — implémentation future

- 20 scénarios couvrant les 20 secteurs ;
- vérité terrain par scénario ;
- génération entièrement seedée ;
- pipeline public V1 complet exécutable ;
- matching et métriques déterministes ;
- quatre rapports générés ;
- reproductibilité, multi-tenancy, immutabilité et verrouillage testés ;
- aucun LLM requis en CI ;
- quatre niveaux CI ;
- tous les seuils configurables ;
- build, lint, typecheck, tests et GitHub Actions verts.

## Architecture Review Resolution

Les décisions suivantes ferment les contrats précédemment ouverts. Leur implémentation dans
AutomateX exige une PR séparée et une Architecture Review propre. La PR #21 ne les implémente pas.

### 1. Enterprise Knowledge Snapshot public

**Décision.** Aucun endpoint existant ne fournit la lecture publique nécessaire. Le contrat requis
est :

```text
GET /api/companies/:companyId/knowledge-snapshots/latest?status=ready
```

Le statut `ready` est le statut canonique d'un snapshot Knowledge publié et consommable.

**Justification.** La résolution par entreprise évite de demander au simulateur un identifiant
interne qu'il ne peut découvrir par une API publique. La lecture reste alignée sur la frontière
tenant et ne déclenche aucune projection.

**Contrat.** Bearer token d'un membre du tenant ; rôles viewer, consultant, admin ou owner ;
dernière version `ready` uniquement ; DTO versionné contenant identité, version, lineage,
fingerprint, versions sources, faits publics, relations et preuves publiques. Erreurs 400, 401,
403, 404 et 500. Le DTO complet est défini dans
`tools/enterprise-simulator/contracts/automatex-public-api.md`.

**Invariants.**

- lecture seule ;
- tenant résolu depuis l'identité ;
- filtre applicatif et RLS ;
- aucune donnée brute non validée, secret ou champ Auth ;
- aucun fallback vers Discovery/Interview ;
- aucun accès direct à la base.

**Limites.** L'endpoint est un contrat futur. Le simulateur ne peut exécuter Process Mapping tant
qu'il n'est pas implémenté et approuvé.

**Risques résiduels.** Taille du DTO, stabilité du schéma public et redaction des valeurs sensibles
doivent être testées lors de l'implémentation.

### 2. Safe synthetic tenant cleanup

**Décision.** Le nettoyage appartient à un test control plane absent de production :

```text
DELETE /api/test-support/simulation-runs/:simulationRunId/tenant
GET    /api/test-support/simulation-runs/:simulationRunId/cleanup
```

Il n'existe aucun endpoint générique de suppression d'organisation.

**Justification.** La route centrée sur le run permet de vérifier simultanément environnement,
classification, provenance et permission sans accepter un tenant arbitraire.

**Contrat.** Tenant créé atomiquement avec `classification = SYNTHETIC_TEST` et
`simulationRunId` immuables. Permission `synthetic_test:cleanup`. Suppression idempotente,
asynchrone et auditée. Réponse avec opération, étapes terminées/restantes et erreurs.

**Invariants.**

- route non enregistrée en production ;
- refus d'un tenant réel ;
- concordance run/tenant obligatoire ;
- identité limitée au run ;
- idempotency key et correlation ID obligatoires ;
- chaque étape de suppression auditée.

**Limites.** Une suppression partielle n'est pas annulée. La récupération reprend les étapes
restantes depuis le journal jusqu'à convergence.

**Risques résiduels.** Les dépendances externes peuvent retarder la convergence ; un réconciliateur
et une alerte sur les opérations `partially_failed` seront nécessaires.

### 3. Synthetic identity

**Décision.** Un test identity broker côté serveur crée des identités Supabase Auth ordinaires,
éphémères et tenant-scoped :

```text
POST   /api/test-support/simulation-runs/:simulationRunId/identities
DELETE /api/test-support/simulation-runs/:simulationRunId/identities/:identityId
```

**Justification.** Le broker garde les privilèges Auth Admin côté serveur. Le simulateur ne reçoit
jamais de service role et aucun administrateur global partagé n'est utilisé.

**Contrat.** Deux profils minimaux : `synthetic_owner` pour les publications imposées par V1 et
`synthetic_consultant` pour la collecte/génération. Une permission de nettoyage dédiée est limitée
à l'orchestrateur du run. Durée du run plus une heure, maximum absolu 24 heures. Révocation au
nettoyage ou à l'expiration.

**Invariants.**

- une identité appartient à un seul run et un seul tenant ;
- provenance `ENTERPRISE_SIMULATOR` ;
- permissions minimales ;
- aucun rôle global ;
- aucune réutilisation inter-run ;
- tokens absents des logs, rapports et fixtures.

**Limites.** En local, bootstrap par broker local éphémère. En CI, échange GitHub OIDC limité au
repository/workflow/environnement/run. Hors test, les routes sont absentes.

**Risques résiduels.** Une panne avant révocation nécessite un réconciliateur TTL et une alerte sur
les identités expirées encore actives.

### 4. Idempotency

**Décision.** Chaque opération mutante du simulateur exige :

```text
Idempotency-Key: <UUIDv7>
```

**Justification.** Les timeouts et retries ne doivent jamais créer une deuxième organisation,
session, version ou publication.

**Contrat.** Portée `(tenant ou simulationRunId, principal, méthode, route canonique, clé)`.
Fingerprint SHA-256 du payload JSON canonique. Rétention jusqu'à 24 heures après la fin du run et
au moins 48 heures après la première requête. Retry identique : même status/body et
`Idempotency-Replayed: true`. Payload différent : `409 IDEMPOTENCY_KEY_REUSED`. Requête active :
`409 IDEMPOTENCY_IN_PROGRESS`.

**Invariants.**

- persistance côté serveur ;
- clé liée au run pour test-support ;
- aucune mutation si le store est indisponible ;
- aucun token ou secret stocké ;
- une clé par commande logique.

**Limites.** Les mutations V1 ne sont appelables par le simulateur qu'après adoption de ce contrat
par leurs routes.

**Risques résiduels.** Volumétrie du store, purge et réponses trop volumineuses nécessitent quotas,
redaction et supervision.

### 5. Correlation ID

**Décision.** Tous les appels utilisent :

```text
X-Correlation-ID: <UUIDv7>
```

**Justification.** Une simulation complète traverse plusieurs moteurs et doit être retraçable sans
utiliser un identifiant de tenant comme corrélation.

**Contrat.** UUIDv7 racine généré par le simulateur, associé au `simulationRunId`, validé par
AutomateX, renvoyé dans chaque réponse, présent dans les logs/audits et propagé aux appels
downstream. Obligatoire sur test-support ; généré par le serveur s'il manque sur une API publique
ordinaire.

**Invariants.**

- ne participe jamais à l'autorisation ;
- ne remplace ni tenant ID, ni idempotency key ;
- même valeur propagée pendant le run ;
- conflit avec un autre run refusé ;
- format invalide refusé.

**Limites.** La propagation ne peut être considérée complète avant des tests de contrat sur chaque
frontière HTTP et événementielle.

**Risques résiduels.** Les bibliothèques ou services externes peuvent perdre le header ; chaque
adaptateur downstream devra être vérifié.

## Risques résiduels globaux

1. Les cinq contrats publics nécessitent encore une implémentation AutomateX indépendante.
2. Les contrats HTTP V1 existants ne sont pas encore tous versionnés.
3. Les versions de catalogues V1 doivent rester exposées dans les snapshots publics.
4. Vingt pipelines complets nécessiteront un parallélisme CI borné.
5. Les politiques de purge idempotency/audit et les réconciliateurs identité/nettoyage devront
   être supervisés.

Toutes les décisions contractuelles sont résolues. Ces risques décrivent des travaux
d'implémentation futurs, sans autoriser de contournement ni de modification silencieuse de V1/V2.
