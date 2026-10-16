# A3 — canevas de brouillons

MISSION: éditer les contrats A1 dans un canevas xyflow avec inspecteur et alternative clavier.
AFFECTED DOMAIN: présentation et édition déterministe agent-workspace.
CANONICAL OWNER: contrats A1 ; Auth/Organization et audit restent propriétaires de leurs données.
CURRENT STATUS: SHADOW / Preview, édition uniquement.
FILES EXPECTED: éditeur, adaptateur de présentation, tests, styles, navigation, dépendance xyflow et lockfile.
DB IMPACT: aucun ; brouillon en mémoire, export local explicite.
SECURITY IMPACT: import JSON borné/strict, aucune permission accordée, aucun appel moteur ; pas de persistance navigateur des contenus.
TEST PLAN: validation/import/édition, invariance des vues, clavier/mobile, absence de requête moteur, régression Hermes.
OUT-OF-SCOPE: exécution de graphes, Rete, installation de moteurs/plugins, persistance serveur, migration, modification audit et appel modèle.

Version sélectionnée : `@xyflow/react` 12.12.0, MIT, React/React DOM >=17, manifeste npm officiel vérifié le 16 octobre 2026. Aucun abonnement Pro. Les dépendances de développement du checkout sont isolées de la jonction vers le checkout canonique avant installation.

## Livré

Le menu « Workflows » ouvre l’éditeur par chargement différé. Il utilise les schémas A1, pas le JSON interne de React Flow. Les quatre modèles portent des références fictives ; les points de départ consigne et canevas manuel initialisent le même format sans interprétation générative. Le parcours manuel contient une transformation pure à la place d’une capacité moteur, avec remappage de ses ports.

L’utilisateur peut modifier objectif/consignes/références/profils d’équipe, ajouter et retirer des blocs, déplacer les blocs et relier leurs ports. L’inspecteur et les sélecteurs sortie/entrée offrent une alternative au glisser-déposer. Les connexions déjà occupées et les types incompatibles sont refusés ; la validation complète A1 vérifie aussi les cycles, limites et blocs inutilisés. La vue avancée affiche les identifiants et ports ; les deux vues conservent tous les nœuds et paramètres.

Une modification du contenu incrémente la révision et aligne la référence de mission ; une modification de vue ou de position ne change pas la révision d’exécution. Une modification invalide le verdict structurel précédent. Une autonomie non choisie reste `null`, y compris après import. Le menu ne fabrique pas un contexte serveur, des droits ou un reçu de validation humaine.

L’import est borné à 128 Kio avant lecture et après décodage UTF-8 ; seules les recettes strictement valides, versionnées et reconnues sont acceptées. Les documents avec contexte serveur, credentials, URL ou autres champs étrangers sont refusés. L’export vérifie à nouveau mission et structure, puis télécharge un JSON local `definition-only`. Aucun contenu client n’est enregistré dans localStorage ou journalisé. Une fermeture après modification non exportée et un rechargement de page déclenchent l’avertissement de perte du brouillon.

## État exact et limites

- Fonctionne : édition en mémoire, validation structurelle et import/export local.
- Non livré : sauvegarde serveur, liaison de références réelles via sélecteurs métier, exécution du graphe, état de traitement, installation de plugin et calcul Rete.
- Les modèles ne prouvent pas la présence de n8n ou Paperclip, ni un raccordement d’audit. Les capacités de graphes devront passer par les adaptateurs et le runtime A5, avec contrôles frais de droits/coûts/approbations.
- Le dispatch textuel Hermes existant reste indépendant et conserve ses contrats et limites.

## Vérification

Les tests domaine vérifient les trois points d’entrée, les quatre recettes, les identités renouvelées, l’absence de politique implicite, les versions cohérentes, le nettoyage des connexions lors d’une suppression, la limite de révision, le refus d’imports invalides et le passage simple/avancé sans perte.

La recette navigateur `scripts/atelier-ia-component-preview.mjs` inclut les contrôles nodaux de `scripts/atelier-ia-nodal-checks.mjs` : chargement réel de xyflow, modèles, révision des modifications, création manuelle/consigne, réparation de connexion au clavier, refus de doublon, bloc orphelin, déplacement réel ne changeant que les positions, import/export, perte de brouillon, largeur mobile. Elle vérifie zéro requête API pendant ces interactions. Auth/serveur y sont des fixtures : ce résultat n’est pas une certification du staging authentifié.

Le chunk différé est mesuré sur cette recette Vite ; ce chiffre n’est pas la taille réseau d’un build Next et ne constitue pas une économie mesurée sur le PC. La dépendance n’est chargée que lors de l’ouverture de Workflows. Aucun polling ou processus d’animation permanent n’est ajouté.

Suite : A2 pour la façade de lecture audit ; A4 pour le POC Rete si son intérêt est démontré ; A5 pour persistance et exécution durable. A3 livre l’éditeur et ne clôt pas ces autres lots.

Sources : [manifeste npm 12.12.0](https://registry.npmjs.org/@xyflow/react/12.12.0), [documentation React Flow](https://reactflow.dev/api-reference/react-flow), [contrats A1](orchestration-contracts-v1.md), [décision nodale](nodal-system-decision.md).
