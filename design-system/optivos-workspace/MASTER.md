# Optivos Workspace — nouvelle interface

Décision utilisateur, 16 octobre 2026 : nouveau produit visuel, thème clair et sombre avec sélecteur. L’ancien Optivos fournit le moteur métier et ses frontières d’accès. Ses anciennes règles visuelles ne s’appliquent plus au poste de travail.

MISSION: refondre présentation, navigation, création d’équipe et canevas.
AFFECTED DOMAIN: présentation agent-workspace uniquement.
CANONICAL OWNER: services et contrats existants pour données, Auth/Organization, audit et missions.
CURRENT STATUS: SHADOW / Preview.
FILES EXPECTED: thème et styles isolés, shell, assistant de création, canevas, tests UI et documentation.
DB IMPACT: aucun ; seule la préférence de thème peut être mémorisée dans le navigateur.
SECURITY IMPACT: aucun nouveau droit ou appel ; persistance métier et requêtes existantes préservées.
TEST PLAN: navigation et formulaires réels, thèmes et portails, clavier, mobile, sauvegarde des préférences/repli, régression mission/import/export.
OUT-OF-SCOPE: réécriture moteur, nouvelles API, migration, activation d’outils et lancement payant.

## Direction

Un outil de travail calme et précis. Mission au centre, espaces et historiques dans le rail, réglages contextuels. Pas de décoration de dashboard, gradient de marque, données fictives présentées comme actives ou catalogue de fonctions inactives dans la navigation principale.

La recherche UI/UX Pro Max retrouve le principe AI-native de chrome minimal et une typographie fonctionnelle. Ses suggestions de landing marketing, palette violette et animations de streaming ne sont pas retenues : elles ne conviennent pas à ce poste. Les choix ci-dessous sont la direction produit propre au projet.

## Thèmes et composants

Tokens indépendants `--ws-*` : fond graphite/papier, surfaces neutres, bordures discrètes, texte fortement contrasté. Accent vert profond en clair et menthe claire en sombre, réservé à la sélection/action. Police système sans téléchargement supplémentaire ; titres de 28–36 px, texte courant de 14–16 px. Espacement 4/8/12/16/24/32. Coins 8–12 px. Cibles interactives de 44 px et focus visible dans les deux thèmes.

Le sélecteur clair/sombre est visible dans le chrome de l’application. La préférence locale est limitée au thème ; aucun contenu de mission n’y est enregistré. Le même thème doit couvrir menus en portail, paramètres, canevas et champs natifs.

## Organisation

- Rail : nouvelle mission, recherche, Workflows, équipe, moteurs/intégrations. Outils secondaires regroupés dans Plus ; audit accessible comme module métier.
- Création : trois étapes explicites Objectif → Équipe → Vérification. Champs métier nécessaires, choix avancés progressivement dévoilés. Retour et saisie conservée ; aucun enregistrement avant l’étape finale.
- Missions : espace central, suggestions courtes, composeur toujours accessible, résultat et revue réels. Contrôles techniques dans un niveau secondaire.
- Workflow : vue de travail occupant l’écran, canevas prioritaire et inspecteur contextuel, modèles et édition sans glisser-déposer accessibles à la demande.

Les anciennes routes métier peuvent encore présenter l’interface historique : cette livraison ne réécrit pas tous les écrans d’audit. Le nouveau système est limité au poste agentique et ne propage pas ses styles aux pages canoniques.
