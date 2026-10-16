# Espace de travail Optivos — refonte UI/UX

MISSION: organiser le travail dans une interface conversationnelle accessible, avec personnages d’agents.
AFFECTED DOMAIN: présentation du workspace et navigation partagée.
CANONICAL OWNER: composants dashboard et présentation agent-workspace ; aucun nouveau moteur.
CURRENT STATUS: SHADOW / Preview pour l’Atelier, parcours audit inchangé.
FILES EXPECTED: CompanyShell, styles partagés, navigation, panneaux équipe/missions, avatars SVG et recette UI.
DB IMPACT: aucun ; contrats et persistance existants conservés.
SECURITY IMPACT: mêmes contrôles Auth/organisation/rôle/origine ; aucune lecture automatique ajoutée.
TEST PLAN: navigation, sélection d’équipe et mission, clavier, états vides/erreurs, permissions, mobile, build et CI.
OUT-OF-SCOPE: backend, frais API, production, code métier, délégation et actions externes.

## Direction retenue

La skill UI/UX Pro Max recommande minimalisme, hiérarchie fonctionnelle, progression et cibles de 44 px. Sa première proposition de landing page n’est pas adaptée : la recherche ciblée « enterprise productivity dashboard » confirme l’approche outil de productivité. Conserver le bleu/violet Optivos, les surfaces sobres et la typographie existante, sans nouvelle dépendance ni police distante.

Une navigation générale sépare Audit et agents. Dans l’Atelier, la liste des équipes précède un espace central : Missions, Équipe, Connexion, Réglages. La création devient une action explicite lorsqu’une équipe existe. Le fil montre une mission sélectionnée, sa demande, son résultat et sa relecture. Les réglages restent hors du fil.

Les personnages sont des SVG originaux légers : coordinateur, exécutant et spécialiste. Ils illustrent les profils configurés et n’attestent ni présence ni délégation active. Le pilote est exécuté par Hermes ; aucune attribution fictive du résultat à un profil.

## Analyse de référence

Analyse statique bornée de cinq modules UI livrés dans Codex Desktop 26.1007.9446.0, extraits de l’archive applicative en texte inerte : sidebar, barre du composeur, panneaux et liste virtualisée. REA sur le VPS, sans inférence, sans exécution des bundles et sans lecture des conversations ou identifiants. Les preuves restent hors dépôt. L’analyse ne prétend pas reconstruire le moteur interne ni certifier les performances ; aucun code propriétaire n’est incorporé dans Optivos.

REA : cinq fichiers JavaScript analysés, 423 912 octets et 139 554 nœuds AST, zéro échec de parsing ; graphe sémantique partiel et tronqué par les limites de ressources. Preuve `ev_3b5a62cdae5fdcd19be84949917502473b8f91de81f7c764e474760f3f04349e`. Ces observations de structure ne démontrent pas l’exécution ni la performance de Codex. L’organisation d’Optivos reste une décision de design propre au produit.
