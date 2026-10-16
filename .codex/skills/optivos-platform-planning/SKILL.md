---
name: optivos-platform-planning
description: Analyser l’existant Optivos et préparer un plan de plateforme, de plugins ou de runtime avant une évolution d’architecture ; pas pour une retouche UI isolée.
metadata:
  version: "0.1.0"
---

# Structurer la plateforme Optivos

Consulter le [plan directeur](../../../docs/architecture/optivos-platform-blueprint.md) et les instructions du checkout actif. Il actualise la direction produit ; les moteurs métier, droits et statuts restent ceux des propriétaires existants.

Pour la présentation du poste agentique, appliquer le [nouveau système visuel](../../../design-system/optivos-workspace/MASTER.md). L’utilisateur a remplacé les anciennes règles visuelles Optivos et choisi deux thèmes avec sélecteur. Ne pas réintroduire l’ancienne palette ou ses contraintes de conservation ; les moteurs et protections métier restent canoniques.

Pour un état des lieux, exécuter `scripts/inventory_project.py --root <checkout>` avec Python. Le helper lit les fichiers suivis et le manifeste de dépendances ; il ne contacte aucun service. Ses compteurs ne prouvent ni raccordement ni certification. Compléter uniquement par les contrats/services pertinents à la demande.

Produire une décision qui distingue : existant vérifié, cible, travail manquant et preuve attendue. Associer chaque capacité à un propriétaire, un statut et une interface publique. Une disponibilité dans le chat opérateur n’établit pas son isolation client dans Optivos.

Avant de coder, découper le travail par livrables vérifiables et dépendances. Réutiliser le socle `agent-workspace` et les modules métier ; ne pas créer un deuxième noyau pour contourner un contrat. Si l’utilisateur demande un plan avant construction, livrer analyse/contrats de conception/skills et s’arrêter avant dépendances, migration ou déploiement de moteurs.

Lire les documents spécialisés à la demande : [plugin audit](../../../docs/architecture/audit-plugin-contract.md) pour le métier ; [nodal](../../../docs/architecture/nodal-system-decision.md) pour le graphe. Ne pas charger tous les documents ou bundles d’un moteur pour une décision locale.

Préférer les compteurs, recherches exactes et validations déterministes aux appels de modèle. Pour une sélection sémantique répétitive réellement utile, appliquer la préférence Jev du projet avec contexte minimal, budget disponible et repli ; ne pas l’invoquer pour produire un inventaire exact. Distinguer économies mesurées et estimées.

Le livrable attendu est un plan applicable : prochaine modification précise, critères de sortie, effets sur données/tenant/coûts et limites. Ne pas inventer un planning chiffré, une capacité connectée ou un résultat de recette.
