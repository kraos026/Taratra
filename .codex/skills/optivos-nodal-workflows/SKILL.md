---
name: optivos-nodal-workflows
description: Concevoir ou réaliser le canevas nodal et les contrats de graphes Optivos avec xyflow, en évaluant Rete pour le traitement pur et en séparant édition et exécution durable.
metadata:
  version: "0.1.0"
---

# Graphes métier et canevas Optivos

Lire la [décision nodale](../../../docs/architecture/nodal-system-decision.md) et le lot du [plan directeur](../../../docs/architecture/optivos-platform-blueprint.md) concerné. Le choix est un canevas xyflow unique, pas deux éditeurs concurrents. Le port de traitement Rete reste un POC tant que compatibilité et intérêt ne sont pas démontrés.

Préserver un graphe neutre Optivos : schéma/version, IDs stables, ports typés, capacités et versions explicites. Séparer positions/options UI et plan exécutable. Ne pas enregistrer des classes Rete, fonctions JavaScript, URLs privées ou secrets dans le JSON. Les droits sont dérivés et revérifiés côté serveur.

En V1, valider un DAG borné avant tout lancement : nœuds/ports/capacités connus, compatibilité de types, références cohérentes, cycles et doublons refusés, limites explicites. Un bloc non raccordé peut apparaître comme disponible à configurer mais doit bloquer l’exécution, sans faux progrès.

Déplacer, importer ou relier un nœud ne déclenche aucune action externe. L’exécution s’appuie sur une version immuable et une autorisation encore valide. Une modification de graphe/paramètres invalide la validation correspondante. Conserver les IDs de traitement des moteurs et leur idempotence avant une reprise.

Évaluer `rete` et `rete-engine` sur transformations pures isolées, avec référence déterministe, invalidation des valeurs et libération des ressources. Ne pas faire de Rete le propriétaire des credentials, coûts ou effets réseau. Vérifier versions/licences et preuves actuelles dans les sources officielles avant installation.

Vérifier UX clavier, toucher, mobile, textes longs et nœuds hors écran. Présenter des blocs métier compréhensibles et un inspecteur progressif. Mesurer taille chargée, mémoire et latence ; préférer chargement client différé et tests sans modèle quand ils suffisent. Ne pas créer de tests de performance qui annoncent un gain sans baseline.
