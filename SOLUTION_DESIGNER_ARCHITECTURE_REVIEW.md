# Solution Designer — Architecture Review

Date de revue : 2026-07-26  
Branche examinée : `feat/solution-designer`  
Commit examiné : `58dd017254ec335972905853ff2cb68073ae43ea`  
Périmètre : Solution Designer MVP et migration `20260726185708_add_solution_designer_v2.sql`

## Synthèse

Le bounded context possède une base déterministe, une frontière de lecture globalement correcte et
une traçabilité explicite vers les trois sources publiées. Il n'est toutefois pas prêt à être
fusionné. Des accès directs autorisés par RLS permettent de contourner le cycle de vie et de publier
des données qui n'ont pas été validées. Le verrouillage optimiste de `rebuild()` n'est pas atomique.
La chaîne de versions et la référence au pattern ne sont pas entièrement tenant-scoped au niveau
relationnel. Enfin, le catalogue de validations n'est pas consommé et un pattern publié contient un
cycle bloquant.

**Décision finale : CHANGES REQUIRED**

## 1. Points conformes

### DDD et frontières

- Le moteur est déterministe, sans LLM, appel réseau, génération de code ou choix de plateforme.
- La génération consomme uniquement Recommendation, ROI et Automation Opportunity publiés.
- Aucun import direct vers Discovery, Interview, Enterprise Knowledge, Process Mapping, Business
  Analysis ou AI Opportunity n'a été trouvé.
- Le domaine contient la sélection du pattern, le calcul de complexité, le coût technique et les
  validations de graphe ; les routes ne portent pas de logique métier.
- Les données produites sont organisées autour d'un Blueprint versionné, de ses preuves et de ses
  validations.

### Versioning et immutabilité

- Chaque persistance crée une nouvelle ligne et incrémente `version_number`.
- `rebuild()` appelle la création d'une nouvelle version et renseigne `previous_version_id`.
- Les catalogues portent `code`, `version`, `published` et deviennent immuables après publication.
- Une version de Blueprint déjà publiée, ses preuves et ses validations ne peuvent plus être
  modifiées par les triggers d'immutabilité.
- Une contrainte unique protège `(organization_id, recommendation_id, version_number)`.

### Explainability

Chaque Blueprint conserve :

- `recommendation_id` et `recommendation_snapshot_id` ;
- `roi_snapshot_id` ;
- `automation_opportunity_id` et `automation_opportunity_snapshot_id` ;
- `pattern_id` et les versions des catalogues consommés ;
- `provenance_json` ;
- les références aux preuves de la Recommendation.

Le trigger `validate_solution_blueprint_sources()` vérifie que ces trois sources sont publiées,
alignées avec la Recommendation et rattachées à la même organisation et entreprise.

### Catalogues

- Les 15 patterns, 25 capacités, 20 connecteurs, 16 contraintes et 13 définitions de validation sont
  seedés comme données versionnées.
- Pattern, capacités, connecteurs et contraintes sont chargés depuis PostgreSQL.
- Les requêtes applicatives filtrent `published = true`.
- Les formules de normalisation et leurs coefficients sont stockés dans `template_json`.

### Graphe

Le moteur détecte :

- les composants orphelins ;
- les arêtes dont la source ou la destination est inconnue ;
- les cycles sur les types d'arêtes déclarés comme dépendances ;
- les connecteurs, capacités et contraintes non résolus.

L'audit SQL des 15 seeds confirme zéro arête invalide et zéro composant orphelin.

### Requêtes et performances

- Aucun N+1 n'a été identifié dans la génération, le détail ou la liste.
- Les lectures indépendantes sont regroupées avec `Promise.all`.
- La liste est paginée et effectue le comptage en parallèle.
- La numérotation de version est sérialisée par advisory lock.

### Contrôleurs

- Les routes valident les UUID, paramètres de pagination et `lockVersion` avec Zod.
- Les routes délèguent les décisions au service applicatif.
- Les erreurs métier sont traduites en réponses HTTP cohérentes, dont HTTP 409.

## 2. Non-conformités critiques

### C1 — Le cycle de vie peut être contourné via la Data API

La policy `editors update solution_blueprints` autorise owner, admin et consultant à modifier une
version non publiée. Les grants donnent également `UPDATE` directement au rôle `authenticated`.

Conséquences :

1. un consultant peut modifier graph, coût, provenance ou validations persistées ;
2. il peut positionner directement le statut à `validated` sans appeler le validateur ;
3. un owner/admin peut positionner directement le statut à `published` ;
4. le trigger d'immutabilité ne bloque pas cette première publication, car il ne vérifie que
   `OLD.status = 'published'` ;
5. les validations stockées peuvent donc ne plus correspondre au contenu publié.

Références :

- `supabase/migrations/20260726185708_add_solution_designer_v2.sql:133-152`
- `supabase/migrations/20260726185708_add_solution_designer_v2.sql:171-194`

Correction minimale proposée :

- interdire les mises à jour directes des champs métier ;
- autoriser uniquement les transitions de statut contrôlées par une fonction PostgreSQL dédiée ou
  retirer les droits directs d'écriture et faire transiter toute mutation par le serveur ;
- imposer côté base les transitions `draft → validated → published` ;
- vérifier l'absence d'erreur et la présence de preuves lors de la publication.

### C2 — Le verrouillage optimiste du rebuild n'est pas atomique

Le service lit `lockVersion`, le compare, puis appelle `persist()` dans un second temps. L'advisory
lock n'est acquis que dans `persist()`. Deux requêtes concurrentes portant le même `lockVersion`
peuvent donc toutes les deux réussir et créer deux nouvelles versions. Aucune ligne source n'est
mise à jour conditionnellement avec `WHERE lock_version = ?`.

Références :

- `src/modules/solution-designer/application/solution-blueprint-service.ts:37-51`
- `src/modules/solution-designer/infrastructure/prisma-solution-blueprint-repository.ts:142-158`

Correction minimale proposée :

- acquérir le verrou avant la lecture/validation du `lock_version` dans la même transaction ;
- effectuer une consommation atomique du verrou optimiste ou une mise à jour conditionnelle de la
  version source ;
- retourner HTTP 409 lorsque le verrou attendu n'est plus courant.

### C3 — Les relations de version et de pattern ne sont pas totalement tenant-scoped

`pattern_id` et `previous_version_id` sont des clés étrangères simples. Elles ne garantissent ni la
même organisation, ni, pour la version précédente, la même Recommendation. Les contrôles RLS ne
s'appliquent pas comme contrôle de visibilité lors de la vérification interne d'une clé étrangère.
Un identifiant connu pourrait donc créer une référence inter-tenant ou une chaîne de versions
incohérente.

Référence :

- `supabase/migrations/20260726185708_add_solution_designer_v2.sql:41-67`

Correction minimale proposée :

- ajouter une validation relationnelle/trigger garantissant que le pattern est système ou appartient
  au tenant ;
- garantir que `previous_version_id` appartient au même tenant, à la même Recommendation et précède
  la nouvelle version ;
- couvrir ces invariants par des tests pgTAP inter-tenant réels.

## 3. Non-conformités majeures

### M1 — Le catalogue de validations n'est pas consommé

`solution_validation_rule_catalog` est créé et seedé, mais le repository ne le charge jamais. Les
codes et comportements de validation sont codés directement dans `SolutionDesigner.validate()`.
Le catalogue est donc décoratif et les services ne sont pas réellement pilotés par l'ensemble des
catalogues annoncé.

Correction minimale : charger uniquement les règles publiées, vérifier que chaque validation
exécutée correspond à une version publiée et enregistrer cette version dans `catalogVersions`.

### M2 — Dépendance Clean Architecture inversée

`SolutionBlueprintService` dépend directement de `PrismaSolutionBlueprintRepository`. La couche
Application importe donc Infrastructure au lieu de dépendre d'un port.

Correction minimale : introduire une interface `SolutionBlueprintRepository` dans Application et
faire implémenter ce port par l'adaptateur Prisma.

### M3 — Agrégat et Value Objects insuffisamment exprimés

Le domaine expose principalement des interfaces de données et un service. Les invariants de statut,
version, provenance, verrouillage et publication sont répartis entre service, repository, triggers et
policies. Il n'existe pas de Value Objects pour identité/version/statut/complexité/risque/coût ni
d'agrégat contrôlant explicitement les transitions.

Correction minimale avant fusion : ne pas refondre tout le modèle, mais centraliser au minimum les
transitions et invariants de publication derrière un port transactionnel. La création de Value
Objects plus riches peut rester une dette documentée si les invariants critiques sont protégés.

### M4 — JSON de catalogue non validé à l'exécution

`template_json` est converti avec `as unknown as PatternTemplate`. La base vérifie seulement que la
valeur est un objet. Un catalogue publié mal formé peut provoquer une erreur d'exécution ou contourner
des attentes du moteur.

Correction minimale : valider les JSON chargés avec un schéma Zod strict avant toute génération et
refuser une version invalide.

### M5 — Résolution ambiguë entre catalogue système et catalogue tenant

`latest()` conserve la première ligne par code après un tri `code ASC, version DESC`, mais aucun
ordre ne départage une version système d'une version tenant portant le même code et le même numéro.
Le résultat peut dépendre du plan SQL.

Correction minimale : définir et tester une priorité explicite, par exemple version la plus élevée,
puis override tenant avant système à version égale.

### M6 — Un pattern publié contient un cycle bloquant

`customer_support` contient :

`intake → assistant → escalation → assistant`

Les arêtes `calls` et `approves` sont toutes deux des dépendances. Le moteur produit donc
`topology_cycle`. L'audit des seeds trouve trois chemins cycliques pour ce pattern. Les quatorze
autres patterns n'ont pas de cycle bloquant.

Correction minimale : corriger uniquement la topologie du seed existant selon la décision métier,
sans ajouter de pattern ni étendre le catalogue.

### M7 — Les tests RLS ne démontrent pas l'isolation

Le test pgTAP actuel vérifie surtout l'existence des tables, les volumes des seeds et le flag
`relrowsecurity`. Il ne simule pas deux organisations ni les rôles viewer/consultant/admin/owner. Il
ne couvre pas les contournements de statut, le lien de version inter-tenant ou la preuve inter-tenant.

Correction minimale : ajouter des tests de lecture/écriture inter-tenant et de chaque transition par
rôle.

### M8 — Contexte ambigu pour un utilisateur multi-organisations

`context(userId)` utilise `findFirst` sans organisation demandée ni ordre déterministe. Un utilisateur
membre de plusieurs organisations est arbitrairement attaché à une seule organisation pour toutes
les opérations.

Correction minimale : transmettre explicitement l'organisation active issue du contexte de requête
et vérifier l'adhésion correspondante.

## 4. Non-conformités mineures

- Le coût du risque utilise le premier risque ayant la sévérité maximale, pas explicitement le coût
  maximal des risques. Les seeds actuels masquent ce défaut car leurs risques de sévérité maximale
  ont le même coût.
- `dependencies_json` duplique exactement `topology_json`, sans sémantique distincte.
- `assumptions_json` est systématiquement vide.
- Le domaine n'émet jamais de validation `warning`, bien que l'enum PostgreSQL le permette.
- La chaîne de nom contient un caractère mal encodé (`â€”`).
- `request.json()` est appelé hors du gestionnaire d'erreurs métier ; un JSON invalide peut produire
  une réponse 500 au lieu de 400.
- Le cast `status as "draft"` masque les autres valeurs de statut au niveau TypeScript.
- Aucun `TODO`, `FIXME` ou `HACK` n'a été trouvé ; aucun code mort évident hors catalogue de
  validations non consommé.

## 5. Dette technique et performances

### Duplications et simplifications

- `topology_json` et `dependencies_json` stockent la même donnée.
- Les versions de catalogues sont copiées en JSON alors que certaines références existent déjà ;
  cette duplication est justifiée pour l'explicabilité, mais son rôle doit être documenté.
- Les méthodes `generate()` et `rebuild()` du domaine sont identiques. Cela est acceptable pour le
  MVP si `rebuild` exprime l'intention, mais le versioning doit rester applicatif.

### Chargements inutiles

Une génération charge toutes les versions publiées de quatre catalogues, puis filtre en mémoire.
Elle exécute jusqu'à neuf requêtes, sans N+1. Pour le volume MVP, cela reste acceptable. À surveiller
avant croissance :

- sélectionner d'abord le pattern applicable ;
- charger uniquement les codes référencés par ce pattern ;
- mettre en cache les catalogues système immuables si une mesure démontre un besoin.

### Index manquants

Aucun index explicite Solution Designer n'est créé. Les contraintes uniques couvrent partiellement
les accès, mais les chemins suivants méritent des index après mesure :

- `solution_blueprints(organization_id, company_id, status, version_number DESC)` ;
- `solution_blueprint_validations(organization_id, blueprint_id)` ;
- catalogues sur `(organization_id, published, code, version DESC)`.

Cette optimisation n'est pas bloquante pour le MVP, contrairement aux invariants et à la sécurité.

## 6. Scénarios métier simulés

Les simulations utilisent strictement les seeds présents, sans modification. Le choix dépend de la
catégorie de la Recommendation, pas du secteur. Les coûts sont des indices techniques relatifs.

### Restaurant

Recommendation simulée : « Automatiser les confirmations de réservation », catégorie
`quick_wins`.

- Pattern : `simple_automation`
- Composants : Trigger, Action
- Capacités : scheduler, api_client, notification
- Connecteurs : Generic Scheduler, Generic REST API, Generic Notification
- Contraintes : authentification, autorisation, idempotence, retry, observabilité
- Risques : dépendance externe, double exécution, échec de notification
- Risque final : 50
- Complexité : 36/100
- Coût technique : 108
- Cohérence : satisfaisante ; graphe valide, sans orphelin ni cycle bloquant

### Cabinet comptable

Recommendation simulée : « Superviser automatiquement les contrôles de conformité », catégorie
`compliance`.

- Pattern : `compliance_monitoring`
- Composants : Collector, Validator, Report
- Capacités : logging, analytics, notification, relational_database, monitoring
- Connecteurs : base relationnelle, analytics, notification, logging, monitoring
- Contraintes : authentification, autorisation, audit, chiffrement, PII, sauvegarde, reprise,
  observabilité
- Risques : conformité non détectée, perte de preuves, faux résultat, accès non autorisé
- Risque final : 100
- Complexité : 51/100
- Coût technique : 320,5
- Cohérence : satisfaisante pour un contexte réglementé ; graphe valide

### E-commerce

Recommendation simulée : « Automatiser le traitement des commandes à ROI élevé », catégorie
`high_roi`.

- Pattern : `workflow_automation`
- Composants : Trigger, Processor, Decision, Action
- Capacités : scheduler, queue, human_approval, api_client, notification, logging
- Connecteurs : scheduler, queue, validation humaine, REST, notification, logging
- Contraintes : authentification, autorisation, audit, idempotence, retry, observabilité
- Risques : interruption, goulot d'approbation, double exécution, dépendance externe
- Risque final : 50
- Complexité : 61/100
- Coût technique : 215,5
- Cohérence : satisfaisante ; graphe valide et explicable

### Clinique

Recommendation simulée : « Assistant de consultation de procédures internes », catégorie
`ai_first`.

- Pattern : `knowledge_assistant`
- Composants : Interface, Retrieval, LLM, Response, Identity Provider
- Capacités : knowledge_search, search_engine, llm_gateway, identity_provider, logging, monitoring
- Connecteurs : identité, recherche, LLM, logging, monitoring
- Contraintes : authentification, autorisation, secret, PII, chiffrement, audit, rate limit,
  observabilité
- Risques : divulgation, réponse incorrecte, exposition PII, dépendance fournisseur, coût d'usage
- Risque final : 100
- Complexité : 61/100
- Coût technique : 435,5
- Cohérence : techniquement cohérente et prudente ; elle ne constitue pas une validation médicale

### Usine

Recommendation simulée : « Orchestrer une transformation inter-systèmes », catégorie
`strategic_projects`.

- Pattern : `enterprise_transformation`
- Composants : Intake, Orchestrator, Integration, Monitoring, Identity Provider
- Capacités : queue, api_client, human_approval, logging, monitoring, analytics, identity_provider,
  secrets_manager
- Connecteurs : identité, secrets, queue, approbation, REST, logging, monitoring, analytics
- Contraintes : authentification, autorisation, secret, audit, chiffrement, PII, haute disponibilité,
  sauvegarde, reprise, multi-tenant, idempotence, retry, observabilité
- Risques : panne transverse, action privilégiée, fuite, état partiel, dépendance fournisseur
- Risque final : 100
- Complexité : 68/100
- Coût technique : 529
- Cohérence : satisfaisante pour une transformation stratégique ; graphe valide

## 7. Recommandations minimales avant fusion

Ordre recommandé, sans nouvelle fonctionnalité :

1. fermer les contournements du cycle de vie au niveau PostgreSQL/RLS ;
2. rendre le verrouillage de `rebuild()` atomique ;
3. garantir tenant, Recommendation et ordre dans les liens `pattern`/`previous_version` ;
4. ajouter les tests pgTAP réels couvrant tenants, rôles et transitions ;
5. connecter le catalogue de validations au moteur et valider les JSON de catalogue ;
6. corriger le cycle du pattern `customer_support` ;
7. introduire un port de repository applicatif et une résolution déterministe des overrides ;
8. corriger les défauts mineurs sans élargir le périmètre.

Après ces corrections minimales, la revue devra être rejouée. La PR #18 ne doit pas être fusionnée
en l'état.
