# Système nodal : xyflow et Rete

État : choix d’architecture et protocole de POC ; aucune bibliothèque installée par cette note.
Sources inspectées le 16 octobre 2026 : dépôts et documentation officielle, sans exécuter leur code.

| Point                       | xyflow / React Flow                                                    | Rete                                                                                 |
| --------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Rôle documenté              | Bibliothèque d’interfaces à nœuds React/Svelte                         | Framework de programmation visuelle, extensions de traitement dataflow/control-flow  |
| Paquet candidat observé     | `@xyflow/react` 12.12.0, dans le dépôt inspecté                        | `rete` 2.0.6 ; traitement fourni séparément par `rete-engine`                        |
| Licence du cœur inspecté    | MIT                                                                    | MIT ; dépôt `retejs/engine` inspecté également déclaré MIT                           |
| Compatibilité déclarée      | React et React DOM ≥ 17 ; Optivos est en React 19                      | Cœur indépendant du rendu ; intégration à éprouver sur notre stack                   |
| Utilité principale ici      | Canevas unique, nœuds personnalisés, ports, liens et inspecteur métier | Évaluation isolée de sous-graphes de transformations pures                           |
| Ce que cela ne garantit pas | Exécution durable, droits, budget, reprise et autorisation réseau      | Persistance durable, isolation tenant, preuve de coût et sémantique d’action externe |

Les versions sont celles des fichiers source aux commits consultés, pas une affirmation de dernière version publiée ou de compatibilité déjà testée. Les extensions tierces et leurs licences seront vérifiées avant ajout. Le plan utilise les fonctions open source ; aucun abonnement Pro n’est engagé.

## Décision

Retenir xyflow comme seul rendu nodal produit. Garder un format de graphe Optivos indépendant des classes/objets internes des deux bibliothèques. Évaluer Rete derrière un port `PureGraphProcessor` : modèle neutre → nœuds autorisés → résultats typés. Le POC vérifie la cohabitation avec le canevas xyflow sans installer le renderer React de Rete.

La documentation Rete connecte son moteur aux nœuds de son éditeur : l’adaptateur devra donc créer cette représentation interne et son cycle de vie, pas envoyer directement le JSON xyflow à `DataflowEngine`. Il n’est pas établi ici que les API des deux bibliothèques s’assemblent sans travail d’adaptation. Tester ce passage est le but du POC.

Dans ce plan, Rete ne commande jamais directement Hermes, n8n, le shell ou une API cliente. Les effets passent par le runtime Optivos et les adaptateurs autorisés. n8n reste un moteur externe de workflow appelé par une capacité ; il ne devient pas le format de stockage du canevas Optivos.

## POC borné avant installation produit

1. Répertoire de recette isolé, versions et lockfile explicites, sans toucher aux dépendances partagées du checkout canonique.
2. Graphe neutre de trois transformations déterministes, sans réseau ni secrets ; même résultat avec une référence simple et l’adaptateur Rete.
3. Ajouter une branche, une sortie absente, un cycle refusé en V1, une modification de valeur et une version de capacité incompatible. Vérifier l’invalidation du calcul et la libération des ressources.
4. Vérifier en mode développement et production Next/React 19 : chargement client du canevas, rendu serveur de la page environnante, import/export et absence de requête moteur en édition.
5. Mesurer temps de chargement, taille ajoutée, latence et mémoire sur petits/moyens graphes représentatifs ; annoncer les chiffres observés, pas un gain supposé.

Retenir Rete si son apport dépasse la complexité de l’adaptateur. Sinon conserver xyflow et une exécution déterministe plus simple derrière le même port ; le schéma, les nœuds métier et les workflows enregistrés doivent rester compatibles. Cette décision de repli est un critère du POC, pas une autorisation de construire deux exécuteurs concurrents.

## UX prévue

Navigation « Missions / Canvas / Résultats » sur la même mission, galerie de modèles guidés, palette de nœuds métier et inspecteur contextuel. Nœud Audit : « Lire les résultats d’un dossier » plutôt qu’un ensemble de commandes SQL. Connexions permises selon types de ports ; erreurs expliquées avant lancement. Boutons distincts « Enregistrer le brouillon », « Vérifier », « Exécuter ». État d’exécution provenant des événements réels et arrêt au prochain point sûr, sans animation d’agents qui prétende prouver une exécution.

Choix utilisateur confirmé : trois entrées (chat, modèle guidé, canevas manuel) et deux vues (simple/avancée) d’un même workflow. La recette devra vérifier les passages entre entrées/vues sans perte de configuration, de ports ou de dépendances. Les détails avancés restent dans le document neutre même s’ils sont masqués en vue simple ; une vue simple ne doit ni supprimer ni exécuter des nœuds cachés.

## Références vérifiées

- [xyflow/xyflow](https://github.com/xyflow/xyflow), commit `654ba5a5e04f3404bc4db2eee88bfa15866d203d` ; [paquet React inspecté](https://github.com/xyflow/xyflow/blob/654ba5a5e04f3404bc4db2eee88bfa15866d203d/packages/react/package.json).
- [Calculs dans React Flow](https://reactflow.dev/learn/advanced-use/computing-flows) : mécanismes de données de nœuds, distincts de notre runtime de missions.
- [retejs/rete](https://github.com/retejs/rete), commit `2aae19950180dc12725306f06c0440f64473bd21` ; [paquet inspecté](https://github.com/retejs/rete/blob/2aae19950180dc12725306f06c0440f64473bd21/package.json).
- [Concept de moteurs Rete](https://retejs.org/docs/concepts/engine/) et [extension retejs/engine](https://github.com/retejs/engine).
