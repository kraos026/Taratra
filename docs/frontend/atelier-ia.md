# Atelier IA intégré à Optivos — laboratoire

## Organisation du produit

Optivos reste l’espace de décision: dossier entreprise, audit, opportunités, ROI, plan d’action et résultats. L’Atelier IA constitue une entrée distincte pour les missions d’agents, avec les rubriques Accueil, Missions, Résultats, À valider et Réglages. L’accueil d’Optivos présente les deux espaces lorsque le laboratoire est activé.

Le nom et le périmètre reprennent les échanges « OPTIVOS »: Atelier IA pour les entreprises, puis Studio créatif comme extension possible. Cette intégration porte le parcours de Hermes Facile dans les composants Optivos. Elle n’embarque pas le serveur, les comptes, la base SQLite ou les 900 dépendances de Mission Control.

## Routes et accès

- `/atelier-ia`: choix parmi les entreprises accessibles au compte, pagination de 20 dossiers.
- `/companies/[id]/atelier-ia`: atelier lié à un dossier vérifié.
- La navigation principale et mobile conservent le contexte entreprise courant.
- Le proxy existant couvre la nouvelle entrée; le chargement réutilise `withCompanyService`, `CompanyService.get/list/permissions`, donc Auth, Organization et l’accès RLS canoniques.
- Les dossiers archivés, supprimés et les identifiants incohérents sont refusés avant affichage du panneau. Les rôles de consultation ne disposent pas des commandes de simulation.

Il n’y a ni seconde connexion, ni clé fournisseur dans le navigateur, ni table supplémentaire. Aucune modification des moteurs, de leurs contrats, des calculs ou des recommandations n’est incluse.

## Activation limitée

L’option est désactivée par défaut. En LOCAL ou Preview seulement:

```text
NEXT_PUBLIC_OPTIVOS_ATELIER_IA_LAB=1
AUTOMATEX_CERTIFICATION_TARGET=local
```

Une Preview Vercel avec `VERCEL_ENV=preview` est également une cible admise, mais ce travail n’en publie aucune. `VERCEL_ENV=production` est refusé, même si le laboratoire et la cible locale sont renseignés. Aucun autre environnement n’est accepté implicitement. Les flags publics sont compilés avec l’interface; relancer le serveur ou reconstruire après un changement.

Configurer la base Supabase locale jetable avec la procédure existante avant d’essayer les routes authentifiées. Ne pas réutiliser des accès Production pour cette démonstration. Le paramètre n’active pas Hermes, OpenRouter, 9Router ou ArtCraft: tous les lancements réels restent absents de ce module.

## Fonctionnement de la démonstration

Les demandes passent par préparation, validation, simulation, résultat ou arrêt. Une simulation en cours par page; douze missions au maximum. Les résultats portent explicitement la mention EXEMPLE SIMULÉ. Aucun appel de modèle, outil, envoi externe ou effet métier ne résulte d’un bouton.

Les missions ne sont conservées que dans l’état React de la page. Actualiser, quitter ou changer de contexte les efface. Ce choix évite une persistance parallèle à Supabase pendant une réorganisation d’interface. Une persistance partagée nécessitera plus tard une migration Supabase, sa politique RLS et une certification distincte.

## Validation et limites

Les tests unitaires vérifient les flags, la projection minimale du contexte, les refus d’accès et les transitions de simulation. Les tests canoniques de navigation restent inclus. L’aperçu visuel de `scripts/atelier-ia-component-preview.mjs` utilise le véritable panneau et le shell Optivos, avec une entreprise et une navigation API factices. Il ne se connecte ni à Supabase ni à un moteur. Les liens Next y sont remplacés uniquement dans le harness visuel.

La réussite de cet aperçu ne constitue pas une certification des sessions, de la base RLS ou des parcours canoniques. Le build de production, les tests DB/RLS, l’E2E authentifié complet et STAGING restent NOT RUN pour cette version. Le module reste SHADOW et NOT CERTIFIED.

Commande de contrôle ciblé:

```text
node node_modules/vitest/vitest.mjs run src/modules/agent-workspace src/components/dashboard/dashboard-navigation.test.ts src/components/dashboard/company-navigation.test.ts --maxWorkers=1
node scripts/atelier-ia-component-preview.mjs
```

Les rendus sont générés dans un dossier ignoré; `OPTIVOS_ATELIER_EVIDENCE_DIR` peut désigner le dossier de preuves. Le harness ne modifie pas la CSS du produit: il retire les polices externes uniquement dans sa copie de test. Il ferme son serveur et son navigateur après la recette.

## Suite prévue

Brancher la passerelle HTTP Hermes déjà testée dans le projet Hermes, puis définir les missions persistantes et leurs droits par entreprise. Les validations d’outils, arrêts confirmés, budgets vérifiables et versions de compétences devront être testés au niveau du runtime. Aucune autorisation permanente, promesse d’IA illimitée ou promotion en moteur canonique n’est créée par cette interface.

## Navigation regroupée

Vue d’ensemble reste au premier niveau. Audit regroupe Mon entreprise, Parcours d’audit, Opportunités, ROI, Plan d’action et Résultats. Orchestrateur & agents regroupe l’Atelier IA ; compétences, connexions et Studio créatif sont annoncés comme extensions futures. Ce groupe suit le flag du laboratoire.

Le groupe de la page courante s’ouvre initialement. Les groupes se déplient indépendamment ; leurs liens conservent les destinations canoniques et le contexte entreprise. Les boutons exposent aria-expanded/aria-controls, les liens aria-current. Sous 1024 px, un bouton Menu affiche la navigation avec défilement vertical borné ; Échap ferme le menu et rend le focus au bouton. Aucun menu exclusivement à icônes ni défilement horizontal.

## Connexion Hermes en lecture seule

La rubrique Connexion effectue une vérification manuelle via `GET /api/companies/[id]/atelier-ia/connection`. Aucun polling, chargement automatique de sessions ou appel de modèle. Chaque consultation passe d’abord par l’accès authentifié au dossier et les flags du laboratoire. Les réponses ne sont jamais mises en cache.

Configuration exclusivement côté serveur :

```text
OPTIVOS_HERMES_COMPANY_ID=<UUID du dossier autorisé>
OPTIVOS_HERMES_API_URL=http://127.0.0.1:8642
OPTIVOS_HERMES_API_KEY=<clé privée de l’API Hermes>
```

Le serveur Optivos doit pouvoir joindre cette origine : localhost désigne sa propre machine. Depuis un PC, utiliser un tunnel SSH privé vers le VPS existant ; depuis un autre hébergement, fournir une origine HTTPS protégée déjà configurée. Ne pas ouvrir publiquement le port natif pour cette étape. La clé n’est jamais une variable NEXT_PUBLIC ni une clé OpenRouter. Elle ne doit pas être versionnée.

Une seule entreprise est liée pour ce pilote ; toute autre entreprise reçoit « Ce dossier n’est pas lié à Hermes » sans requête externe. En l’absence des paramètres serveur, la vérification annonce « Connexion non configurée ». La destination provient exclusivement de la configuration : HTTPS ou HTTP sur 127.0.0.1/::1, sans identifiants dans l’URL, chemin, paramètres, fragments ou redirections. Lecture de /v1/capabilities uniquement, timeout de 3 secondes, réponse limitée à 16 Kio et contrat Hermes validé. Seuls l’état de connexion, l’heure et les deux capacités de suivi sont projetés au navigateur.

La clé du connecteur Hermes de ce chat n’a pas été copiée dans Optivos. Une réponse positive obtenue via ce connecteur ne certifie pas la connexion serveur Optivos. Le suivi réel des missions reste FUTURE jusqu’à une liaison persistante mission ↔ entreprise et des tests RLS dédiés. Aucun historique global n’est exposé et aucun lancement, arrêt, approbation ou envoi réel n’est proposé.

## Recette avec Auth/RLS et Hermes réels

La recette `scripts/certify-hermes-connection.mjs` utilise les deux comptes et dossiers A/B existants de Supabase LOCAL. Elle ne crée pas de compte, n’applique pas de migration et ne modifie pas les données métier. Elle vérifie un refus 401 anonyme, la connexion depuis le serveur Optivos pour A, le refus de B sur le dossier A, l’état non lié pour le propre dossier B et la vérification depuis la véritable interface authentifiée. Aucun appel de modèle.

Sous Windows, `scripts/Certifier-Connexion-Hermes.ps1 -BridgeConfigPath <connection.json du pont>` réutilise un tunnel API déjà ouvert. Le port est retrouvé automatiquement, sans nouvelle commande SSH. Une référence locale au fichier peut rester dans `artifacts/hermes-connection-live/connection-local.json`, ignoré par Git. Le pont doit avoir été vérifié dans Codex et Supabase LOCAL doit être disponible.

La clé Hermes existante est déchiffrée par le helper Read-Key.ps1 du pont, capturée en mémoire et fournie uniquement au processus serveur. Aucun fichier .env contenant cette clé n’est créé. Le serveur Next de recette et le navigateur sont fermés à la fin ; les services Supabase préexistants et le tunnel Codex ne sont pas arrêtés. Les fichiers de types et le bloc AGENTS automatiquement ajoutés par Next dev sont restaurés seulement lorsqu’ils correspondent exactement aux changements générés par la recette.

La vérification réelle a révélé que le contrat de capacités vient de `/v1/capabilities`, et non de `/health`. Le client a été corrigé sur cette base ; les tests contrôlent désormais ce chemin natif. Le mode reste LOCAL / SHADOW ; aucune publication ou certification Production n’est impliquée.

## Activité réelle : registre et droits

La migration 20261014153000_agent_mission_links.sql ajoute uniquement le registre SHADOW. Chaque run Hermes n’appartient qu’à une entreprise (unicité globale) et la FK composite garantit organization_id/company_id. Les utilisateurs authentifiés disposent seulement de SELECT sous RLS ; même un propriétaire ne peut saisir, déplacer ou supprimer une liaison. Les écritures appartiennent au serveur privilégié après vérification administrative de provenance. Aucune route POST de création ou de soumission n’est exposée.

Le listing GET /api/companies/[id]/atelier-ia/missions projette seulement id de liaison, titre et date ; vingt éléments récents au maximum. GET .../missions/[missionId]/status résout la liaison dans l’entreprise vérifiée avant de consulter Hermes. Un run_id brut, une liaison absente ou étrangère est refusé avant consultation. Le client natif lit GET /v1/runs/{run_id}, valide l’identité retournée et un état reconnu, puis expose seulement l’état et l’heure. Aucun prompt, résultat brut, session, clé ou données d’une autre mission ne passe au navigateur.

La rubrique Activité réelle charge la liste à la demande puis chaque état individuellement ; aucun polling et aucun lancement. Une indisponibilité remplace l’ancien état. La liaison est persistante, les observations sont des relevés horodatés non persistés. Une mission non retrouvée après la rétention de Hermes n’est pas affichée comme terminée.

La recette accepte OPTIVOS_HERMES_CERT_RUN_ID uniquement pour vérifier et enregistrer une ancienne mission de test terminée dans le dossier LOCAL A. Elle ne soumet aucune nouvelle tâche. Cette opération crée au plus une liaison de recette ; un conflit appartenant à une autre entreprise n’est jamais réassigné. Le fichier de preuves live-missions.json distingue cette écriture locale des sessions Auth. Les tests SQL roulent leur transaction de fixture en arrière. Migration STAGING/Production et dispatch réel restent hors périmètre.
