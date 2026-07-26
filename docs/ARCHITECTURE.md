# Architecture AutomateX

## État de référence

Le dépôt contient les fondations multi-tenant, les questionnaires et audits, la restitution
exécutive v1 et le bounded context Discovery. Il contient également des implémentations
déterministes antérieures de Rule Engine, ROI et Recommendation. Ces dernières restent du code
fonctionnel couvert par des tests, mais elles ne définissent pas l'architecture cible des futurs
Sprints 7, 10 et 11.

## Couches

Chaque module sous `src/modules` suit la séparation suivante :

- `domain` : types, invariants et calculs métier purs ;
- `application` : cas d'usage, orchestration, ports et validation ;
- `infrastructure` : persistance Prisma et adaptateurs ;
- `presentation` : API HTTP et composants UI ;
- `src/app` : composition Next.js et routage uniquement.

Les règles métier ne doivent être placées ni dans les routes Next.js ni dans React.

## Données et sécurité

`supabase/migrations` est la source de vérité du schéma, des contraintes, fonctions, triggers,
grants et politiques RLS. `prisma/schema.prisma` en est la projection typée côté serveur.

Une requête authentifiée :

1. valide la session avec Supabase Auth ;
2. ouvre `withAuthenticatedDatabase` ;
3. configure l'identité PostgreSQL et adopte le rôle `authenticated` ;
4. exécute Prisma dans cette transaction ;
5. applique simultanément les filtres applicatifs et la RLS.

Toutes les tables applicatives du schéma exposé `public` doivent avoir RLS activée et des grants
explicites. Les références tenant-scoped doivent inclure `organization_id` dans leurs contraintes,
pas seulement dans le code.

## Bounded contexts actuels

| Contexte                 | Responsabilité                                   | Statut                               |
| ------------------------ | ------------------------------------------------ | ------------------------------------ |
| Onboarding               | Création atomique organisation/owner             | Production                           |
| Companies                | Identité CRM, contact et cycle commercial        | Production, dette de frontière       |
| Questionnaires           | Catalogue versionné de questions                 | Production                           |
| Audits                   | Sessions et réponses d'audit                     | Production                           |
| Discovery                | Connaissance canonique de l'entreprise           | Production                           |
| Interview                | Collecte adaptative des connaissances manquantes | Production                           |
| Enterprise Knowledge     | Projection interne normalisée et explicable      | Fondation                            |
| Process Mapping          | Reconstruction déterministe des processus        | En cours                             |
| Business Analysis        | Findings et santé explicables                    | Production                           |
| AI Opportunity           | Opportunités IA déterministes                    | Production                           |
| Automation Opportunity   | Opportunités d'automatisation explicables        | En cours                             |
| ROI Evaluations          | Évaluations économiques versionnées              | En cours                             |
| Recommendation Portfolio | Roadmap de transformation déterministe           | En cours                             |
| Reports                  | Projection de restitution sans décision métier   | v1                                   |
| Rules                    | Évaluation déterministe d'anciens audits         | Préexistant à réaligner              |
| ROI                      | Calcul déterministe MVP                          | Préexistant à réaligner au Sprint 10 |
| Recommendations          | Priorisation déterministe MVP                    | Préexistant à réaligner au Sprint 11 |

## Contrat canonique Discovery

Les données suivantes appartiennent exclusivement à Discovery : profil opérationnel, secteur
d'activité normalisé, effectif, revenus, modèle économique, phase de croissance, offres,
organisation interne, logiciels, processus, objectifs et difficultés.

`companies` reste l'agrégat CRM et d'identité : nom légal/usuel, contact, coordonnées, statut
commercial et archivage. Les futurs moteurs référencent `company_id`, puis chargent les entités
Discovery validées. Ils ne créent pas de colonnes ou tables équivalentes.

Une session Discovery conserve la provenance et la version du questionnaire de collecte.
Les tables normalisées représentent l'état canonique courant. Une consommation analytique doit
exiger une session validée ou déclarer explicitement qu'elle utilise un brouillon.

## Flux cible

```text
Company identity
      |
Discovery (canonical company knowledge)
      |
Adaptive Interview
      |
Enterprise Knowledge (immutable projections)
      |
Process Mapping
      |
Business Analysis
      |
AI Opportunity + Automation Opportunity
      |
ROI
      |
Recommendation
      |
Executive Report v2
```

Chaque flèche représente un contrat de lecture versionné, jamais une duplication de tables.

## Enterprise Knowledge

Enterprise Knowledge est une projection interne, et non un nouveau système de saisie. Il reçoit
des sessions Discovery et Interview validées, puis génère des snapshots immuables composés de
nœuds, faits, relations, sources et preuves. Chaque fait conserve les identifiants de ses
enregistrements d'origine et une confiance indépendante.

Process Mapping est son premier consommateur. Les moteurs lisent uniquement les snapshots `ready`
au moyen de ports applicatifs dédiés. Les modèles sources restent propriétaires de leurs données
et ne sont jamais modifiés par la projection.

## Process Mapping

Process Mapping est le premier consommateur d'Enterprise Knowledge. Il sélectionne des patterns
versionnés, produit des graphes dirigés et conserve une provenance exhaustive des faits consommés
ou ignorés. Les versions publiées sont immuables. Le bounded context ne possède aucun import ni
repository vers Discovery ou Interview.

## Business Analysis

Business Analysis consomme exclusivement une Process Map publiée et le snapshot Enterprise
Knowledge qu'elle référence. Ses règles versionnées produisent des findings, preuves, scores et
dimensions de santé traçables. Une analyse publiée est immuable et devient l'entrée canonique des
moteurs d'opportunités futurs. Voir ADR-0007.

## AI Opportunity

AI Opportunity lit uniquement une Business Analysis publiée, sa Process Map publiée et son
snapshot Knowledge référencé. Les capacités, règles de détection et formules sont des catalogues
versionnés. Le moteur identifie et explique des possibilités sans exécuter d'IA, calculer de ROI,
prioriser ou produire de recommandations. Voir ADR-0008.

## Automation Opportunity

Automation Opportunity consomme uniquement un snapshot AI Opportunity publié et les versions
exactes Business Analysis, Process Map et Knowledge qu'il référence. Ses patterns, connecteurs,
règles et formules sont versionnés et figés dans chaque snapshot. La disponibilité d'un connecteur
exige une preuve Knowledge explicite. Il ne génère aucun workflow et ne calcule ni ROI ni
recommandation. Voir ADR-0009.

## ROI Evaluations

Le ROI Sprint 10 consomme une Automation Opportunity publiée et toute sa chaîne canonique
référencée. Il produit trois scénarios dont les hypothèses, formules, contributions, preuves et
métriques sont figées. Il ne priorise pas et ne recommande pas. Le ROI v1 reste isolé pour
compatibilité. Voir ADR-0010.

## Recommendation Portfolio

Sprint 11 consomme les métriques ROI publiées sans les recalculer et produit la décision finale :
catégorie, priorité, dépendances et phase de roadmap. Les règles et définitions de priorité sont
versionnées et chaque contribution est explicable. Voir ADR-0011.

## Incohérences et dette détectées

### Critique

- `companies.employee_count` et `company_profiles.employee_count` dupliquent la même notion.
- `companies.sector_id` et `company_profiles.industry` se chevauchent.
- les moteurs Rules/ROI/Recommendations existent avant leur position dans la roadmap officielle ;
  leurs contrats ne consomment pas encore systématiquement Discovery.

### Importante

- plusieurs modules redéfinissent localement le contexte organisation/rôle et les contrôles de
  permission ;
- les adaptateurs Prisma répètent la résolution de l'appartenance utilisateur ;
- Discovery remplace actuellement des collections normalisées par `deleteMany/createMany`, ce qui
  ne préserve pas l'identité stable des sous-entités ;
- le wizard regroupe plusieurs éléments dans des champs séparés par des virgules, alors que le
  modèle accepte des objets riches ;
- les catalogues système et organisationnels ont besoin d'un contrat uniforme de résolution et
  de priorité ;
- `recharts` utilise une plage de version (`^`) alors que les autres dépendances sont épinglées.

### Modérée

- les erreurs et enveloppes HTTP sont similaires mais non centralisées ;
- les repositories mélangent parfois port applicatif et détails Prisma ;
- la couverture pgTAP protège l'isolation, mais les contrats inter-contextes n'ont pas encore de
  tests d'architecture automatisés.

## Améliorations recommandées

1. Introduire une migration de compatibilité pour faire de Discovery l'unique propriétaire de
   `employee_count` et du secteur, après inventaire et backfill contrôlé.
2. Publier un port de lecture `CompanyDiscoveryReader` versionné pour tous les futurs moteurs.
3. Centraliser `TenantContext`, la matrice de permissions et le mapping d'erreurs HTTP.
4. Remplacer les remplacements complets Discovery par des upserts identifiés et un archivage
   explicite des sous-entités.
5. Ajouter des tests d'architecture interdisant les imports entre couches et la création de champs
   de profil hors Discovery.
6. Décider, au début des Sprints 7/10/11, si les moteurs préexistants sont migrés, remplacés ou
   conservés comme v1 ; ne pas les étendre avant cette décision.
7. Épingler toutes les dépendances et traiter les alertes `npm audit` dans une passe dédiée,
   sans mise à jour majeure automatique.
