# Contrat public AutomateX observé

Cet inventaire décrit les routes présentes au moment de la PR 1. Il ne crée aucune garantie
supplémentaire et ne remplace pas une spécification OpenAPI officielle.

## Authentification et tenant

| Besoin                             | Route                               | Observation                        |
| ---------------------------------- | ----------------------------------- | ---------------------------------- |
| Créer une organisation             | `POST /api/onboarding/organization` | requiert une identité authentifiée |
| Supprimer une organisation de test | absente                             | blocage PR 2                       |
| Propager correlation ID            | non contractuel                     | header non garanti                 |
| Idempotence des commandes          | non contractuelle                   | retry dangereux pour les POST      |

## Entreprise et collecte

| Besoin                      | Route                                            |
| --------------------------- | ------------------------------------------------ |
| Créer/lister une entreprise | `POST/GET /api/companies`                        |
| Lire/modifier/archiver      | `GET/PATCH/DELETE /api/companies/:id`            |
| Démarrer/lire Discovery     | `POST/GET /api/companies/:id/discovery`          |
| Lire/modifier une session   | `GET/PATCH /api/discovery-sessions/:id`          |
| Valider Discovery           | `POST /api/discovery-sessions/:id/validate`      |
| Démarrer/lister Interview   | `POST/GET /api/companies/:id/interviews`         |
| Répondre                    | `POST /api/interviews/:id/answer`                |
| Navigation                  | `POST /api/interviews/:id/back`, `/skip`         |
| Compléter/valider           | `POST /api/interviews/:id/complete`, `/validate` |

## Pipeline analytique

| Étape                  | Création                                                  | Lecture/lifecycle                       |
| ---------------------- | --------------------------------------------------------- | --------------------------------------- |
| Enterprise Knowledge   | aucune route directe observée                             | aucune route directe observée           |
| Process Mapping        | `POST /api/knowledge-snapshots/:id/process-maps`          | `GET`, `validate`, `publish`, `rebuild` |
| Business Analysis      | `POST /api/process-maps/:id/analyze`                      | `GET`, `validate`, `publish`, `rebuild` |
| AI Opportunity         | `POST /api/business-analysis/:id/ai-opportunities`        | `GET`, `validate`, `publish`, `rebuild` |
| Automation Opportunity | `POST /api/ai-opportunities/:id/automation-opportunities` | `GET`, `validate`, `publish`, `rebuild` |
| ROI                    | `POST /api/automation-opportunities/:id/roi`              | `GET`, `validate`, `publish`, `rebuild` |
| Recommendation         | `POST /api/roi/:id/recommendations`                       | `GET`, `validate`, `publish`, `rebuild` |

## Règles du futur adaptateur

- même origine HTTPS allowlistée pour toute redirection ;
- session utilisateur ordinaire, jamais de clé service ;
- parsing strict des enveloppes de succès et d'erreur ;
- `lockVersion` lu sur la ressource juste avant une transition ;
- retry automatique limité aux GET et aux commandes dont l'idempotence est confirmée ;
- journalisation des identifiants et versions, jamais des tokens ;
- arrêt si l'organisation d'un résultat diffère du tenant du run ;
- aucune lecture de table pour combler une route manquante.

## Contrats manquants avant PR 2 complète

1. résolution publique du Knowledge Snapshot `ready` par entreprise/run ;
2. suppression sûre d'un tenant de test ;
3. création publique autorisée d'une identité synthétique ;
4. sémantique serveur de `Idempotency-Key` ;
5. propagation serveur de `X-Correlation-ID` ;
6. version explicite du contrat HTTP.
