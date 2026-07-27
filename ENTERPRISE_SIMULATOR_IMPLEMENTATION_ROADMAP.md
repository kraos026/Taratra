# Enterprise Simulator — Implementation Roadmap

Statut : **FEUILLE DE ROUTE OFFICIELLE**

Ce document planifie l’implémentation du Enterprise Simulator conformément à
`ENTERPRISE_SIMULATOR_ARCHITECTURE.md` et aux contrats validés sous
`tools/enterprise-simulator/contracts`. Il ne modifie ni ces contrats, ni les architectures
gelées, ni les moteurs AutomateX.

## 1. Vision

Enterprise Simulator doit devenir le banc d’essai interne, reproductible et explicable
d’AutomateX. Il représentera des entreprises entièrement fictives, exécutera leur parcours par
les seules API publiques d’AutomateX, puis comparera les résultats observables à une vérité terrain
déterministe préparée avant l’exécution.

Le simulateur doit permettre de mesurer une évolution d’AutomateX sans transformer un benchmark
en règle métier et sans coupler l’outil aux détails internes de la plateforme.

## 2. Objectifs

- produire des scénarios synthétiques versionnés à partir d’une seed ;
- générer une vérité terrain immuable et indépendante des résultats AutomateX ;
- simuler des acteurs possédant une connaissance partielle et explicable ;
- traverser le pipeline AutomateX par HTTP authentifié uniquement ;
- valider les snapshots publics avec des règles déterministes et versionnées ;
- mesurer précision, rappel, F1, exactitude, couverture, déterminisme et stabilité ;
- détecter les régressions métier, contractuelles, multi-tenant et de provenance ;
- produire des rapports JSON et Markdown auditables ;
- fournir des suites adaptées aux pull requests, à la branche principale et aux campagnes
  planifiées.

## 3. Positionnement vis-à-vis d’AutomateX

Enterprise Simulator est un outil interne externe au runtime AutomateX.

Il agit comme un client réel :

- il obtient une identité synthétique valide ;
- il crée un tenant explicitement classé `SYNTHETIC_TEST` ;
- il appelle les API REST publiques ;
- il respecte authentification, autorisation, RLS, optimistic locking, idempotence et corrélation ;
- il lit uniquement des DTO publics validés ;
- il demande le nettoyage par le test control plane dédié.

Il n’importe aucun module sous `src/`, aucun modèle Prisma, aucun repository interne et aucun
client Supabase Database. AutomateX ne dépend jamais du simulateur. Une API publique absente bloque
le parcours concerné : elle n’autorise aucun contournement.

## 4. Principes d’architecture

1. **Séparation stricte** : package privé sous `tools/enterprise-simulator`, absent du bundle de
   production.
2. **Clean Architecture** : domaine pur, orchestration applicative par ports, adaptateurs en
   infrastructure.
3. **Déterminisme** : seed, versions de schémas, catalogues et générateur suffisent à reproduire
   un scénario.
4. **Immutabilité** : scénario, Ground Truth, configuration de benchmark et résultats publiés sont
   des snapshots.
5. **HTTP public uniquement** : aucun accès Prisma, PostgreSQL ou service applicatif interne.
6. **Validation aux frontières** : chaque fixture, configuration et DTO HTTP est validé à
   l’exécution avant d’atteindre le domaine.
7. **Traçabilité complète** : chaque résultat conserve source, règle, version, comparaison et
   justification.
8. **Isolation tenant** : une identité, un tenant et un `simulationRunId` forment une frontière
   obligatoire.
9. **Sécurité par refus** : production, origine inconnue, donnée non synthétique, contrat incomplet
   ou réponse non conforme arrêtent le run.
10. **Pas de jugement LLM** : les benchmarks officiels restent entièrement déterministes.

## 5. Bounded Contexts

Les contextes suivants appartiennent exclusivement à l’outil et ne sont pas des bounded contexts
métier AutomateX.

### Scenario Design

Définit et versionne l’entreprise fictive, ses départements, acteurs, systèmes, processus,
documents, contraintes et objectifs.

### Synthetic Interaction

Transforme un scénario en réponses Discovery et Interview compatibles avec la connaissance
partielle de chaque acteur. Le mode officiel utilise des templates déterministes.

### Ground Truth

Construit, valide et fige l’oracle attendu avant tout appel à AutomateX. Il porte les faits,
processus, opportunités, plages ROI, recommandations, dépendances et preuves attendus.

### Simulation Execution

Orchestre les identités, le tenant, les appels REST, les transitions, les retries autorisés, les
snapshots, les échecs et le nettoyage.

### Validation and Matching

Normalise et associe les résultats publics aux attendus selon des règles versionnées. Il produit
les décisions explicables sans modifier l’oracle.

### Benchmarking

Agrège les décisions en métriques, applique une configuration de seuils et compare des runs
compatibles.

### Reporting

Produit les artefacts canoniques, lisibles et exempts de secrets.

## 6. Domain Model

### Objets principaux

- `SimulationScenario` : snapshot versionné de l’entreprise synthétique.
- `SimulatedDepartment` : mission, responsabilités, effectif et relations.
- `SimulatedActor` : rôle, périmètre de connaissance, objectifs, incertitudes et contradictions.
- `SimulatedSystem` : capacités, usages et dépendances d’un système fictif.
- `SimulatedProcess` : déclencheur, étapes, flux, mesures, risques et potentiels.
- `SyntheticDocument` : contenu fictif généré depuis des données structurées.
- `GroundTruth` : oracle immuable lié au hash du scénario.
- `ExpectedOutcome` : résultat attendu, importance, tolérance et preuve.
- `SimulationRun` : exécution d’un scénario contre une version AutomateX.
- `RunStep` : état d’une étape, tentatives, timestamps et références publiques.
- `ObservedSnapshot` : DTO public validé et figé pour le run.
- `MatchDecision` : comparaison attendue/observée, règle et explication.
- `MetricResult` : valeur, formule/version, population et cas limite.
- `BenchmarkDefinition` : cohorte, métriques, poids, seuils et versions compatibles.
- `BenchmarkRun` : agrégation immuable de plusieurs Simulation Runs.
- `SimulationReport` : représentation canonique d’un résultat de run.

### Value Objects

- `ScenarioId`, `ScenarioVersion`, `ScenarioSeed`, `ScenarioHash` ;
- `CatalogVersion`, `GeneratorVersion`, `MatchingRuleVersion` ;
- `SimulationRunId`, `CorrelationId`, `IdempotencyKey` ;
- `TenantClassification`, limité à `SYNTHETIC_TEST` ;
- `Confidence`, `Importance`, `Tolerance`, `Percentage`, `Duration`, `Money` ;
- `SnapshotReference`, `SourceEvidence`, `CanonicalObjectId` ;
- `MetricCode`, `MetricValue`, `BenchmarkThreshold` ;
- `AutomateXCommitSha`, `EnvironmentIdentity`, `ReportFingerprint`.

Les unités, devises, bornes et formats sont validés à la création des Value Objects.

## 7. Aggregate Map

```text
SimulationScenario
├── Departments
├── Actors
├── Systems
├── Processes
├── Documents
└── GroundTruthReference

GroundTruth
├── ExpectedOutcomes
├── ExpectedEvidence
└── Tolerances

SimulationRun
├── ScenarioReference
├── GroundTruthReference
├── RunSteps
├── ObservedSnapshotReferences
├── MatchDecisionReferences
└── ReportReferences

BenchmarkDefinition
├── ScenarioSelection
├── MetricConfiguration
└── AcceptanceThresholds

BenchmarkRun
├── BenchmarkDefinitionReference
├── SimulationRunReferences
├── AggregatedMetrics
└── BenchmarkReportReference
```

### Invariants d’agrégats

- un `SimulationScenario` utilisé par un run est immuable ;
- un acteur ne répond qu’avec ses faits connus ou une incertitude configurée ;
- un `GroundTruth` est produit et figé avant le premier appel AutomateX ;
- un `GroundTruth` ne dépend d’aucun résultat observé ;
- un `SimulationRun` référence exactement un scénario, un Ground Truth, un tenant et un commit
  AutomateX ;
- une étape terminée n’est pas réécrite ; une nouvelle tentative est enregistrée séparément ;
- un benchmark n’agrège que des runs dont les versions sont déclarées compatibles ;
- un rapport publié est dérivé d’un snapshot immuable du run ou du benchmark.

Les agrégats se référencent par identifiant et version. Ils ne se modifient jamais mutuellement par
accès direct.

## 8. REST interactions

### En-têtes communs

- `Authorization: Bearer <synthetic identity token>` ;
- `X-Correlation-ID: <UUIDv7>` sur tous les appels ;
- `Idempotency-Key: <UUIDv7>` sur chaque mutation ;
- version et `lockVersion` lorsque le contrat de la ressource l’exige.

### Parcours nominal

```text
Test Identity Broker
  -> Synthetic Identity
  -> Synthetic Organization
  -> Company
  -> Discovery
  -> Interview
  -> Published Enterprise Knowledge Snapshot
  -> Process Map
  -> Business Analysis
  -> AI Opportunities
  -> Automation Opportunities
  -> ROI
  -> Recommendations
  -> Public snapshots
  -> Safe tenant cleanup
  -> Identity revocation
```

### Règles d’interaction

- les mutations ne démarrent que si leur contrat d’idempotence est disponible ;
- la valeur de corrélation racine est propagée pendant tout le run ;
- le DTO Knowledge provient exclusivement du contrat public read-only validé ;
- toute réponse est validée avant stockage ou consommation ;
- seuls les retries transitoires et contractuellement sûrs sont autorisés ;
- un `401`, `403`, conflit tenant, incohérence de lineage ou perte de provenance interrompt le
  parcours ;
- les tokens sont conservés en mémoire et absents des rapports ;
- le nettoyage cible le `simulationRunId`, jamais un tenant arbitraire.

## 9. Simulation lifecycle

```text
DEFINED
  -> MATERIALIZED
  -> GROUND_TRUTH_FROZEN
  -> PROVISIONING
  -> RUNNING
  -> VALIDATING
  -> REPORTED
  -> CLEANING_UP
  -> COMPLETED
```

États terminaux alternatifs :

- `FAILED` : échec métier ou contractuel ;
- `INFRASTRUCTURE_ERROR` : environnement indisponible sans conclusion métier ;
- `CLEANUP_PENDING` : résultats conservés, nettoyage à reprendre ;
- `CANCELLED` : annulation explicite avant publication du rapport final.

Le run enregistre chaque transition. Un échec déclenche toujours une tentative de révocation et de
nettoyage. Une reprise utilise le journal d’étapes, les mêmes identifiants logiques et les clés
d’idempotence enregistrées.

## 10. Ground Truth lifecycle

```text
DRAFT
  -> VALIDATED
  -> FROZEN
  -> USED
  -> RETIRED
```

- `DRAFT` : construction depuis le scénario et les catalogues.
- `VALIDATED` : schémas, unités, références et tolérances cohérents.
- `FROZEN` : hash canonique calculé ; aucune mutation permise.
- `USED` : référencé par au moins un Simulation Run.
- `RETIRED` : exclu des nouveaux benchmarks, conservé pour l’audit.

Une correction crée une nouvelle version. Les sorties AutomateX ne peuvent jamais faire évoluer le
Ground Truth.

## 11. Benchmark lifecycle

```text
DRAFT
  -> VALIDATED
  -> RUNNING
  -> EVALUATED
  -> PUBLISHED
  -> SUPERSEDED
```

- la définition fige cohorte, versions, poids et seuils avant `RUNNING` ;
- chaque scénario produit un Simulation Run indépendant ;
- les erreurs d’infrastructure sont rapportées séparément des échecs métier ;
- `EVALUATED` calcule les agrégats seulement après classification de tous les runs ;
- `PUBLISHED` est immuable et possède un fingerprint ;
- une nouvelle configuration crée une nouvelle version et marque l’ancienne `SUPERSEDED`.

## 12. CI integration

### Niveaux

| Suite       | Déclenchement                         | Périmètre                               |
| ----------- | ------------------------------------- | --------------------------------------- |
| Contract    | chaque PR du simulateur               | schémas, DTO, frontières, interdictions |
| Smoke       | PR éligible, environnement disponible | 2 scénarios déterministes               |
| Standard    | avant fusion et branche principale    | 10 scénarios                            |
| Full        | planifié ou manuel                    | 20 scénarios ou plus                    |
| Adversarial | planifié et release candidate         | isolation, concurrence, erreurs         |

### Garde-fous

- environnement éphémère ou staging explicitement autorisé ;
- production refusée avant toute obtention d’identité ;
- secrets fournis par le gestionnaire CI, jamais par les fixtures ;
- GitHub OIDC pour l’accès au test identity broker ;
- concurrence bornée et quota par run ;
- artefacts sans tokens, avec rétention configurée ;
- nettoyage exécuté dans une étape finale, même après échec ;
- échec de la CI sur violation de contrat, fuite tenant, non-déterminisme ou seuil obligatoire ;
- `INFRASTRUCTURE_ERROR` n’est jamais transformé en benchmark réussi.

L’activation des suites E2E reste conditionnée par l’implémentation approuvée des contrats publics
requis dans AutomateX.

## 13. Sprints S1 à S5

### S1 — Domain Foundation and Deterministic Scenarios

Construire le noyau pur du simulateur : modèle de scénario, Value Objects, PRNG seedé,
canonicalisation, hashing, catalogues versionnés et validation des fixtures.

### S2 — Ground Truth and Synthetic Interaction

Construire l’oracle déterministe, les acteurs à connaissance partielle, les réponses Discovery et
Interview et les documents synthétiques sans dépendance AutomateX.

### S3 — Public API Orchestration

Construire le client HTTP et l’orchestrateur de run contre les contrats publics validés :
identité, tenant test, pipeline, idempotence, corrélation, verrouillage, reprise et nettoyage.

Ce sprint ne démarre qu’après disponibilité des contrats AutomateX nécessaires.

### S4 — Validation, Metrics and Reporting

Construire matching, décisions explicables, métriques, scoring, rapports canoniques et comparaison
de runs.

### S5 — Benchmark Catalog and CI Operationalization

Finaliser la cohorte sectorielle, les suites smoke/standard/full/adversarial, les seuils officiels,
la publication d’artefacts et les procédures opératoires.

## 14. Deliverables de chaque sprint

### S1

- package indépendant et règles de frontières ;
- Domain Model et agrégats S1 ;
- PRNG, horloge et identifiants déterministes ;
- schémas runtime Scenario ;
- sérialisation canonique et fingerprint ;
- catalogues initiaux versionnés ;
- tests unitaires de reproductibilité et invariants.

### S2

- modèle et schéma Ground Truth ;
- générateur déterministe de vérité terrain ;
- acteurs, périmètres de connaissance et politiques d’incertitude ;
- générateurs de réponses et documents synthétiques ;
- provenance attendue et tolérances versionnées ;
- tests empêchant toute influence des résultats AutomateX.

### S3

- adaptateur HTTP validant strictement les DTO ;
- gestion des identités synthétiques à permissions minimales ;
- orchestration du lifecycle complet ;
- gestion idempotence, corrélation, timeouts et retries ;
- journal de reprise sans secrets ;
- nettoyage idempotent et révocation ;
- tests de contrat, isolation multi-tenant et erreurs.

### S4

- normalisation et matching versionnés ;
- décisions TP/FP/FN/non comparable explicables ;
- vingt métriques obligatoires ;
- configuration de poids et seuils ;
- rapports `report.json`, `report.md`, `summary.json`, `failures.json` ;
- tests de cas limites, graphes, plages, ensembles et déterminisme.

### S5

- minimum 20 scénarios couvrant 20 secteurs ;
- manifestes des suites CI ;
- benchmark versionné de référence ;
- jobs Contract, Smoke, Standard, Full et Adversarial ;
- politiques d’artefacts, rétention et nettoyage ;
- runbook d’exploitation et diagnostic ;
- baseline publiée avec versions et SHA AutomateX.

## 15. Acceptance Criteria

### Critères communs

- aucun import AutomateX interne, Prisma ou accès PostgreSQL ;
- aucune modification d’un moteur V1/V2 ou d’une architecture gelée ;
- TypeScript strict, lint, format, typecheck, tests et build verts ;
- fixtures et DTO validés à l’exécution ;
- aucune donnée réelle, aucun secret dans les rapports ;
- architecture testée automatiquement.

### S1

- même tuple seed/schémas/catalogues/générateur : même JSON canonique et même hash ;
- aucune source aléatoire ou temporelle implicite dans le domaine ;
- scénario invalide rejeté avant persistance.

### S2

- Ground Truth créé avant tout appel HTTP et ensuite immuable ;
- chaque attendu possède provenance, importance et tolérance explicite ;
- un acteur ne révèle jamais un fait hors de son périmètre.

### S3

- toutes les opérations passent par les API publiques authentifiées ;
- aucune mutation sans idempotency key ;
- correlation ID présent de bout en bout ;
- aucune lecture ou écriture cross-tenant ;
- production et tenant réel systématiquement refusés ;
- reprise et nettoyage partiel convergent sans double création.

### S4

- chaque décision de matching est reproductible et expliquée ;
- métriques conformes aux formules et conventions d’ensembles vides ;
- rapport identique pour deux entrées métier identiques ;
- erreur d’infrastructure séparée du score métier.

### S5

- 2 scénarios smoke, 10 standard et au moins 20 full ;
- dix répétitions d’un scénario sans différence métier ;
- suites CI exécutables avec parallélisme borné ;
- baseline, seuils et versions visibles dans chaque rapport ;
- tous les tenants et identités synthétiques nettoyés ou signalés à réconcilier.

## 16. Non Goals

- modifier ou remplacer une règle métier AutomateX ;
- tester par accès direct à la base ;
- générer des données ou décisions de production ;
- créer un moteur métier partagé avec AutomateX ;
- utiliser un LLM comme oracle, matcher ou scorer officiel ;
- générer du code, des workflows ou des plateformes cibles ;
- mesurer une vérité économique universelle ;
- masquer l’absence d’une API publique ;
- fournir une interface utilisateur client ;
- réaliser des tests de charge génériques de la plateforme.

## 17. Future V2

La V2 pourra étendre l’outil sans changer les principes fondamentaux :

- éditeur interne de scénarios avec export vers le format canonique ;
- mutation testing des scénarios et contrats ;
- réduction automatique d’un scénario ayant échoué ;
- comparaison différentielle entre deux commits AutomateX ;
- matrices de compatibilité de versions ;
- catalogues sectoriels plus profonds ;
- simulation déterministe de concurrence et de reprise ;
- tableaux de tendance historiques ;
- mode LLM facultatif pour variantes linguistiques, exclu du score officiel.

Toute évolution V2 nécessitera une Architecture Review dédiée.

## 18. Future V3

La V3 pourra constituer une plateforme de qualification à grande échelle :

- campagnes distribuées multi-environnements ;
- centaines de scénarios et variantes combinatoires ;
- analyse statistique des tendances sans remplacer les métriques déterministes ;
- certification de releases par politiques versionnées ;
- marketplace interne de scénarios approuvés ;
- connecteurs vers observabilité et gestion d’incidents ;
- comparaison inter-version des explications et provenances ;
- laboratoire adversarial avancé pour sécurité et résilience.

La V3 ne devra toujours jamais accéder directement aux données internes AutomateX ni devenir une
source de décisions métier.

## 19. Glossaire

| Terme                | Définition                                                                    |
| -------------------- | ----------------------------------------------------------------------------- |
| Enterprise Simulator | Outil interne externe qui teste AutomateX par ses API publiques.              |
| Scenario             | Snapshot versionné décrivant une entreprise entièrement fictive.              |
| Seed                 | Valeur initiale contrôlant toute génération pseudo-aléatoire.                 |
| Ground Truth         | Oracle déterministe, figé avant l’exécution AutomateX.                        |
| Simulation Run       | Exécution d’un scénario contre un commit et un environnement AutomateX.       |
| Benchmark Definition | Cohorte, métriques, poids et seuils versionnés.                               |
| Benchmark Run        | Agrégation immuable de Simulation Runs compatibles.                           |
| Observed Snapshot    | Résultat public AutomateX validé et conservé comme preuve du run.             |
| Match Decision       | Association expliquée entre un attendu et un résultat observé.                |
| Synthetic Identity   | Identité Supabase Auth éphémère, tenant-scoped et à permissions minimales.    |
| Synthetic Tenant     | Organisation marquée `SYNTHETIC_TEST` et liée à un `simulationRunId`.         |
| Idempotency Key      | UUIDv7 identifiant une commande mutante logique pour rendre ses retries sûrs. |
| Correlation ID       | UUIDv7 racine permettant de tracer tous les appels d’un run.                  |
| Catalog              | Données configurables, publiées et versionnées utilisées par le simulateur.   |
| Determinism Score    | Mesure de stabilité des résultats métier à entrées et versions identiques.    |
| Infrastructure Error | Échec technique ne constituant pas une conclusion métier.                     |
| Full Suite           | Campagne d’au moins 20 scénarios représentatifs.                              |
| Adversarial Suite    | Campagne déterministe ciblant erreurs, concurrence, sécurité et isolation.    |

## Séquencement officiel

L’ordre S1 → S5 est obligatoire. S1 et S2 peuvent être développés sans environnement AutomateX.
S3 est bloqué jusqu’à l’implémentation et l’approbation des contrats publics requis. S4 peut
commencer sur des fixtures de snapshots validées, mais son acceptation exige les sorties réelles du
parcours S3. S5 commence uniquement après acceptation de S1 à S4.

Aucun sprint ne peut modifier silencieusement cette feuille de route, l’architecture validée ou les
contrats existants. Toute divergence requiert une nouvelle Architecture Review.
