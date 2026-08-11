# Contrats publics requis par Enterprise Simulator

Statut : **contrat approuvé pour Architecture Review — implémentation hors PR #21**

Ce document distingue les routes déjà présentes des contrats publics requis avant l'intégration
complète du simulateur. Une route requise mais absente doit être implémentée dans une PR AutomateX
séparée, avec sa propre Architecture Review. Son absence n'autorise jamais un accès Prisma,
PostgreSQL ou service role depuis le simulateur.

## 1. Enterprise Knowledge Snapshot read-only

### État existant

`POST /api/knowledge-snapshots/:id/process-maps` consomme un identifiant déjà connu. Il ne permet
ni de découvrir la dernière version Knowledge d'une entreprise, ni d'en lire la projection
publique. Aucun endpoint existant ne satisfait donc le besoin.

### Contrat requis

```text
GET /api/companies/:companyId/knowledge-snapshots/latest?status=ready
```

Le statut interne canonique `ready` représente le snapshot publié et consommable d'Enterprise
Knowledge. Aucun snapshot `building`, incomplet ou invalidé n'est retourné.

Authentification et autorisation :

- Bearer token d'une identité ordinaire AutomateX ;
- appartenance obligatoire à l'organisation de l'entreprise ;
- rôles `viewer`, `consultant`, `admin` et `owner` autorisés en lecture ;
- résolution du tenant à partir de l'identité, jamais d'un header client ;
- RLS et filtre applicatif simultanés.

Réponse :

```ts
interface PublicKnowledgeSnapshotDto {
  id: string;
  companyId: string;
  organizationId: string;
  version: number;
  status: "ready";
  lineage: {
    lineageId: string;
    previousSnapshotId: string | null;
  };
  sourceVersions: {
    discoverySessionId: string;
    discoveryVersion: number;
    interviewSessionIds: string[];
    interviewVersions: number[];
  };
  fingerprint: string;
  generatedAt: string;
  facts: Array<{
    id: string;
    domain: string;
    code: string;
    value: unknown;
    confidence: number;
    sourceType: string;
    evidenceIds: string[];
  }>;
  relationships: Array<{
    id: string;
    fromFactId: string;
    toFactId: string;
    type: string;
  }>;
}
```

Les données suivantes restent exclues : clés techniques privées, données d'authentification,
prompts, secrets, colonnes d'audit internes, contenu brut non validé et données appartenant à un
autre tenant.

Erreurs :

- `400 KNOWLEDGE_QUERY_INVALID` ;
- `401 UNAUTHENTICATED` ;
- `403 KNOWLEDGE_SNAPSHOT_FORBIDDEN` ;
- `404 READY_KNOWLEDGE_SNAPSHOT_NOT_FOUND` ;
- `500 INTERNAL_ERROR`.

Invariants :

- lecture seule ;
- dernière version `ready` de la lignée demandée ;
- DTO versionné par le contrat HTTP ;
- aucune création implicite ;
- aucune lecture directe de la base par le simulateur ;
- aucun fallback vers Discovery ou Interview.

## 2. Safe synthetic tenant lifecycle

Il n'existe aucun endpoint générique de suppression de tenant. Le contrat requis appartient
exclusivement au test control plane et n'est enregistré qu'en environnement non-production.

### Création

```text
POST /api/test-support/simulation-runs/:simulationRunId/tenant
```

La création atomique associe :

- `classification = SYNTHETIC_TEST` ;
- `simulationRunId` immuable ;
- identité créatrice synthétique ;
- environnement autorisé ;
- date d'expiration ;
- audit de création.

### Nettoyage

```text
DELETE /api/test-support/simulation-runs/:simulationRunId/tenant
GET    /api/test-support/simulation-runs/:simulationRunId/cleanup
```

Préconditions cumulatives :

- environnement explicitement classé `local`, `ci` ou `test` ;
- endpoint absent du route manifest de production ;
- tenant marqué `SYNTHETIC_TEST` côté serveur ;
- `simulationRunId` exact ;
- identité possédant `synthetic_test:cleanup` pour ce run uniquement ;
- correlation ID et idempotency key valides.

La suppression retourne `202` avec :

```ts
interface SyntheticCleanupDto {
  cleanupOperationId: string;
  simulationRunId: string;
  state: "pending" | "running" | "completed" | "partially_failed";
  completedSteps: string[];
  pendingSteps: string[];
  failedSteps: Array<{ step: string; errorCode: string }>;
}
```

La suppression est idempotente. Un retry reprend le même journal et retourne la même opération.
Chaque étape est auditée. Un échec partiel conserve les étapes terminées, marque les étapes
restantes et permet une reprise à partir du journal. Aucune restauration de données déjà
supprimées n'est promise ; la récupération consiste à reprendre le nettoyage jusqu'à convergence.

Refus obligatoires :

- `403 ENVIRONMENT_FORBIDDEN` en production ;
- `403 SYNTHETIC_CLEANUP_FORBIDDEN` sans permission dédiée ;
- `404 SYNTHETIC_TENANT_NOT_FOUND` si le run ne possède aucun tenant ;
- `409 TENANT_CLASSIFICATION_MISMATCH` si le tenant n'est pas `SYNTHETIC_TEST` ;
- `409 SIMULATION_RUN_MISMATCH` si le run ne correspond pas ;
- `409 CLEANUP_IN_PROGRESS` pour une autre opération active ;
- `500/503 CLEANUP_INFRASTRUCTURE_ERROR` sans masquer l'état partiel.

Un tenant réel ne peut jamais devenir synthétique après sa création.

## 3. Synthetic identity

Le simulateur utilise des identités Supabase Auth ordinaires, éphémères et exclusivement
tenant-scoped. Il n'utilise aucun administrateur global partagé.

### Contrat requis

```text
POST   /api/test-support/simulation-runs/:simulationRunId/identities
DELETE /api/test-support/simulation-runs/:simulationRunId/identities/:identityId
```

Le test identity broker côté serveur crée l'identité au moyen de l'administration Auth interne.
Le simulateur ne reçoit ni clé service, ni accès Auth Admin, ni accès PostgreSQL.

Profils minimaux :

- `synthetic_owner` : owner du seul tenant synthétique du run, nécessaire aux publications ;
- `synthetic_consultant` : saisie Discovery/Interview et génération/validation ;
- permission spéciale `synthetic_test:cleanup` accordée uniquement à l'identité orchestratrice
  du run et uniquement pour son tenant.

Chaque identité conserve :

- `simulationRunId` ;
- tenant ID ;
- rôle ;
- provenance `ENTERPRISE_SIMULATOR` ;
- environnement ;
- expiration ;
- correlation ID de création.

Durée :

- durée du run plus une marge maximale d'une heure ;
- durée absolue maximale de 24 heures ;
- révocation immédiate après nettoyage ou échec terminal ;
- tâche de réconciliation révoquant les identités expirées.

Bootstrap :

- local : credential éphémère émis par le test identity broker local ;
- CI : échange GitHub OIDC contre un credential de test limité au repository, workflow,
  environnement et run ;
- hors environnement de test : routes non enregistrées et création refusée.

Invariants :

- aucune identité réutilisée entre deux runs ;
- aucune appartenance à plusieurs tenants ;
- aucun rôle global ;
- aucun accès cross-tenant ;
- permissions minimales et temporaires ;
- révocation auditée ;
- token jamais écrit dans un rapport ou une fixture.

Erreurs : `401`, `403 ENVIRONMENT_FORBIDDEN`, `403 WORKLOAD_IDENTITY_FORBIDDEN`,
`404 SIMULATION_RUN_NOT_FOUND`, `409 IDENTITY_ALREADY_EXISTS`, `422 ROLE_NOT_ALLOWED`.

## 4. Idempotency

Toutes les opérations mutantes utilisées par le simulateur exigent :

```text
Idempotency-Key: <UUIDv7>
```

Contrat :

- format UUIDv7 canonique en minuscules ;
- une clé par commande métier logique, réutilisée lors de ses retries ;
- portée :
  `(organizationId ou simulationRunId, principalId, méthode HTTP, route canonique, key)` ;
- payload fingerprinté par SHA-256 d'une sérialisation JSON canonique ;
- persistance serveur durable, jamais dans le simulateur ;
- rétention minimale de 24 heures après l'état terminal du run, avec un minimum absolu de
  48 heures après la première requête ;
- relation obligatoire au `simulationRunId` pour les routes test-support.

Retry identique :

- retourne exactement le status code et le body enregistrés ;
- ajoute `Idempotency-Replayed: true` ;
- n'exécute aucun effet secondaire supplémentaire.

Conflits :

- même clé avec payload différent : `409 IDEMPOTENCY_KEY_REUSED` ;
- même clé encore en cours : `409 IDEMPOTENCY_IN_PROGRESS` avec `Retry-After` ;
- clé absente : `400 IDEMPOTENCY_KEY_REQUIRED` ;
- format invalide : `400 IDEMPOTENCY_KEY_INVALID` ;
- store indisponible : `503 IDEMPOTENCY_STORE_UNAVAILABLE`, sans exécuter la mutation.

Les enregistrements stockent uniquement les métadonnées, le fingerprint, le statut et une réponse
redactée. Aucun token ou secret n'est persisté.

## 5. Correlation ID

Chaque appel utilise :

```text
X-Correlation-ID: <UUIDv7>
```

Contrat :

- le simulateur génère un UUIDv7 racine au début du run ;
- ce même identifiant est associé au `simulationRunId` et propagé à toutes les étapes ;
- AutomateX valide le format avant traitement ;
- si le header manque sur une API publique ordinaire, AutomateX en génère un ;
- il est obligatoire sur les routes test-support ;
- la réponse renvoie toujours `X-Correlation-ID` ;
- tous les logs structurés, audits et erreurs le conservent ;
- chaque appel downstream HTTP ou événement déclenché le propage sans modification ;
- il ne sert jamais à l'autorisation ni à l'isolation tenant.

Erreurs :

- `400 CORRELATION_ID_INVALID` ;
- `400 CORRELATION_ID_REQUIRED` sur test-support ;
- `409 CORRELATION_RUN_MISMATCH` si un correlation ID déjà lié à un autre
  `simulationRunId` est présenté.

Le correlation ID n'est pas secret et ne remplace ni request ID, ni idempotency key, ni tenant ID.

## 6. Règles du futur adaptateur

- HTTPS et origine allowlistée ;
- session utilisateur ordinaire ;
- aucun service role ;
- parsing strict des DTO versionnés ;
- `lockVersion` lu avant chaque transition ;
- retry automatique uniquement avec une idempotency key acceptée ;
- correlation ID propagé et vérifié ;
- journalisation sans tokens ;
- arrêt si le tenant d'un résultat diffère du tenant du run ;
- aucune lecture de table pour combler une route manquante.

## 7. Précondition de PR 2

La PR 2 peut implémenter les composants purs du simulateur, mais son intégration complète reste
conditionnée à l'implémentation et à l'Architecture Review des contrats publics absents :

- Knowledge Snapshot read-only ;
- test tenant lifecycle ;
- synthetic identity broker ;
- idempotency middleware ;
- correlation propagation.

Cette condition est une limite explicite, pas une question architecturale ouverte.
