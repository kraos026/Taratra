# A1 — contrats communs de mission, plugin et graphe

MISSION: rendre les contrats du plan directeur testables et fournir quatre définitions de parcours.
AFFECTED DOMAIN: domaine agent-workspace, SHADOW / préparation.
CANONICAL OWNER: noyau Auth/Organization et services métier existants ; aucun moteur ni dispatch remplacé.
CURRENT STATUS: contrats et validation déterministe ; aucune exécution de graphe, installation de plugin ou capacité audit nouvelle.
FILES EXPECTED: schémas domaine, validation de graphe et de prérequis, exemples, tests et cette note.
DB IMPACT: aucun.
SECURITY IMPACT: aucun droit accordé ; les permissions demandées par un manifeste sont distinctes des droits du contexte serveur.
TEST PLAN: cycles, ports/types, doublons, références, versions, limites, séparation UI/exécution, mode absent, permissions et références autorisées ; compatibilité du dispatch Hermes v1.
OUT-OF-SCOPE: adaptateurs nouveaux, API de lancement de graphes, signatures d’approbation, persistance/RLS, bibliothèques nodales, achat et inférence.

## Frontière

Ces contrats sont distincts de l’enveloppe actuelle `version: 1 / engineId / capability / mission`. Le dispatch existant continue de n’accepter que le texte Hermes. Les exemples sont des définitions de recette et ne représentent aucune mission ou connexion réelle.

Le plugin déclare des capacités, des ports typés et des permissions demandées. Son enregistrement ou sa validation n’installe rien. La mission référence une révision exacte de workflow, un objectif et une politique explicite ou encore non choisie. Le graphe contient des valeurs/références bornées et des nœuds connus ; la présentation conserve les trois modes d’entrée et deux vues sans changer sa définition d’exécution.

Un contrôle de prérequis reçoit un contexte construit côté serveur : espace, rôle, plugins installés/versionnés, permissions accordées, bindings et références autorisées. Ce contexte n’est pas un DTO accepté du navigateur. Un résultat positif signifie seulement « prérequis déclarés satisfaits » : aucun runtime n’est lancé et les droits, coûts et validations restent à revérifier lors de l’exécution future.

## Contrats et contrôles livrés

- `orchestration-contracts.ts` définit les schémas stricts Zod, sans dépendance nouvelle. Les champs inconnus sont refusés. Les versions de plugin sont exactes (`0.1.0`), jamais `latest` ou une plage.
- `workflow-validation.ts` valide les ports, types, capacités versionnées, références, doublons et connexions requises. Le graphe est un DAG limité à 64 nœuds, 128 arêtes et 32 niveaux. Chaque nœud doit contribuer à un livrable. Les transformations sont des identifiants enregistrés, sans code ni URL exécutables.
- `assessPlanRequirements` compare les demandes au contexte serveur fourni : accès en écriture, plugins installés, permissions, moteurs liés au même espace, références exactes d’audit et de workflow externe. La lignée d’audit comprend entreprise, audit et version du résultat ; l’identifiant natif n8n conserve sa casse.
- La politique pilote accepte exclusivement 0 € de nouveaux frais API, aucun repli payant et une seule étape concurrente. `autonomy: null` reste un choix absent et bloque les prérequis. Une capacité déclarée `write` requiert le mode `scoped` et un port d’approbation relié à une revue humaine.

Le contexte serveur hypothétique des tests n’est ni une session réelle ni une autorisation publique. Il devra être construit depuis les frontières Auth/Organization existantes ; cette étape n’ajoute aucun point d’entrée HTTP pour le fournir.

## Quatre recettes de référence

Les définitions TypeScript exportées par `reference-workflows.ts` portent l’état `definition-only` et utilisent des UUID fictifs. Les quatre plugins décrits sont des spécimens de contrats, pas des packages installés.

| Recette          | Chaîne prévue                                                                                                     | Politique de l’exemple |
| ---------------- | ----------------------------------------------------------------------------------------------------------------- | ---------------------- |
| Audit → Hermes   | Référence d’audit → lecture des résultats → extraction de texte → brouillon Hermes → relecture → livrable         | `prepare`              |
| Mission générale | Consigne textuelle → brouillon Hermes → relecture → livrable, sans dépendance audit                               | `prepare`              |
| Workflow n8n     | Référence de connexion/workflow + consigne → préparation → approbation → exécution externe → relecture → livrable | `scoped`               |
| Équipe Paperclip | Objectif et petite équipe (1 à 3 agents) → préparation → approbation → coordination → relecture → livrable        | `scoped`               |

Les chaînes décrivent le futur comportement attendu. Aucun transformateur, agent, serveur n8n ou Paperclip n’est exécuté par leur validation. Le contrat audit de lecture ne remplace pas la capacité actuelle de navigation `audit.open` du catalogue : sa façade reste à construire en A2.

## Une définition, plusieurs vues

Le même document conserve `entryMode: chat | template | canvas` et `view: simple | advanced`. `canonicalPlanDefinition` produit une chaîne JSON déterministe à partir de la mission, des nœuds, arêtes et contrats référencés. Les positions, la vue, le mode d’entrée, le titre d’affichage et l’ordre des tableaux de nœuds/arêtes ne changent pas cette chaîne. Modifier une consigne, la politique, une révision, un paramètre ou un contrat référencé la change.

Cette chaîne n’est ni une signature, ni un jeton d’autorisation, ni un cache global. Elle contient les données de mission et ne doit pas être journalisée avec du contenu client. Le futur runtime devra associer un plan immuable aux droits actuels de l’utilisateur/espace, aux versions, au budget et aux reçus d’approbation ; la chaîne seule n’accorde aucun droit.

## Limites et suite

Un nœud de revue n’est pas une approbation obtenue. Il faudra un reçu serveur lié au plan exact, à son auteur et à sa portée, invalidé après modification. L’état `requirements-satisfied` signifie uniquement que les données déclarées satisfont ces contrôles statiques ; il ne prouve pas la disponibilité du moteur, le coût actuel ou la validité d’une approbation.

La provenance/signature des packages, l’installation, l’enveloppe des artefacts produits, les erreurs de transport, les événements, les reprises durables, l’idempotence, l’annulation et les vérifications par étape restent à spécifier/implémenter avec les adaptateurs et le runtime. Aucun schéma de base, migration, droit RLS, appel modèle ou nouvelle API n’est introduit ici.

Tests : quatre recettes valides ; refus des cycles, limites, ports, doublons, références incohérentes, versions inconnues, droits absents, bindings étrangers et paramètres forgés ; invariance des vues et absence de mutation des définitions. Un test HTTP vérifie aussi que le dispatch Hermes actuel refuse ces documents de planification et conserve son enveloppe textuelle v1.

Suite : A2 expose les résultats d’audit existants en lecture ; A3 construit le canevas xyflow sur ces contrats, avec édition et validation explicites. L’exécution de graphes attend A5.
