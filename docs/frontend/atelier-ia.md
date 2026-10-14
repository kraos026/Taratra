# Atelier IA : poste de commande Hermes

## Organisation actuelle

Optivos conserve son audit et ses moteurs. L’Atelier IA, lié à une entreprise authentifiée, comporte cinq rubriques : Vue d’ensemble, Missions, Discussion, Capacités et Installation. Le parcours simulé et ses résultats fictifs ont été retirés.

- Vue d’ensemble : prise en main, vérification manuelle de connexion et accès aux rubriques.
- Missions : registre persistant et consultation des états Hermes ; création, arrêt, approbations et récupération des résultats restent à raccorder.
- Discussion : session privée et historique à raccorder ; aucun faux échange.
- Capacités : périmètre skills, plugins, API et MCP. Aucun inventaire installé n’est annoncé sans lecture effective.
- Installation : diagnostic de connexion, prérequis VPS, fournisseurs IA, budget, autonomie et isolation des clients. Installation automatisée et réglages effectifs restent à construire.

Le budget reste fixé à 0 € de nouveaux frais API. Priorité au VPS Hostinger existant. Déploiement personnel avant clients pilotes avec leur propre VPS ; offre hébergée ultérieurement, après isolation certifiée.

## Accès et activation

`/atelier-ia` liste les entreprises accessibles (20 par page). `/companies/[id]/atelier-ia` réutilise Auth/CompanyService/RLS canoniques et refuse les dossiers archivés ou supprimés. Le flag `NEXT_PUBLIC_OPTIVOS_ATELIER_IA_LAB=1` est limité à LOCAL ou Preview ; Production est refusée même si le flag est présent.

Le registre `agent_mission_links` persiste les liaisons entreprise/run, via une migration Supabase additive et une politique RLS SELECT. Aucun secret fournisseur n’est exposé au navigateur. Aucun endpoint de dispatch n’existe actuellement. Le contrôle `canWrite` projette les droits du dossier sans autoriser d’exécution par lui-même.

## Vérification de cette réorganisation

Les tests du module couvrent accès, flags, isolation, contrats et erreurs. `scripts/atelier-ia-component-preview.mjs` vérifie les véritables composants avec des réponses API de recette : navigation clavier, mobile/tablette, absence de simulation et de faux résultats, diagnostics manuels, erreurs sans état périmé et absence de mutations. Il ferme son navigateur et son serveur.

Cette recette de composants ne constitue pas une preuve de connexion staging à Hermes. La recette authentifiée locale existante est conservée avec les nouveaux libellés. Les preuves historiques restent attachées à leurs anciens SHA. Aucune certification Production n’est annoncée.

## Navigation regroupée

Vue d’ensemble reste au premier niveau. Audit regroupe Mon entreprise, Parcours d’audit, Opportunités, ROI, Plan d’action et Résultats. Orchestrateur & agents regroupe l’Atelier IA ; compétences, connexions et Studio créatif sont annoncés comme extensions futures. Ce groupe suit le flag du laboratoire.

Le groupe de la page courante s’ouvre initialement. Les groupes se déplient indépendamment ; leurs liens conservent les destinations canoniques et le contexte entreprise. Les boutons exposent aria-expanded/aria-controls, les liens aria-current. Sous 1024 px, un bouton Menu affiche la navigation avec défilement vertical borné ; Échap ferme le menu et rend le focus au bouton. Aucun menu exclusivement à icônes ni défilement horizontal.

## Connexion Hermes en lecture seule

La rubrique Installation effectue une vérification manuelle via `GET /api/companies/[id]/atelier-ia/connection`. Aucun polling, chargement automatique de sessions ou appel de modèle. Chaque consultation passe d’abord par l’accès authentifié au dossier et les flags du laboratoire. Les réponses ne sont jamais mises en cache.

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

La migration 20261014162545_agent_mission_links.sql ajoute uniquement le registre SHADOW. Chaque run Hermes n’appartient qu’à une entreprise (unicité globale) et la FK composite garantit organization_id/company_id. Les utilisateurs authentifiés disposent seulement de SELECT sous RLS ; même un propriétaire ne peut saisir, déplacer ou supprimer une liaison. Les écritures appartiennent au serveur privilégié après vérification administrative de provenance. Aucune route POST de création ou de soumission n’est exposée.

Le listing GET /api/companies/[id]/atelier-ia/missions projette seulement id de liaison, titre et date ; vingt éléments récents au maximum. GET .../missions/[missionId]/status résout la liaison dans l’entreprise vérifiée avant de consulter Hermes. Un run_id brut, une liaison absente ou étrangère est refusé avant consultation. Le client natif lit GET /v1/runs/{run_id}, valide l’identité retournée et un état reconnu, puis expose seulement l’état et l’heure. Aucun prompt, résultat brut, session, clé ou données d’une autre mission ne passe au navigateur.

La rubrique Missions charge la liste à la demande puis chaque état individuellement ; aucun polling et aucun lancement. Une indisponibilité remplace l’ancien état. La liaison est persistante, les observations sont des relevés horodatés non persistés. Une mission non retrouvée après la rétention de Hermes n’est pas affichée comme terminée.

La recette accepte OPTIVOS_HERMES_CERT_RUN_ID uniquement pour vérifier et enregistrer une ancienne mission de test terminée dans le dossier LOCAL A. Elle ne soumet aucune nouvelle tâche. Cette opération crée au plus une liaison de recette ; un conflit appartenant à une autre entreprise n’est jamais réassigné. Le fichier de preuves live-missions.json distingue cette écriture locale des sessions Auth. Les tests SQL roulent leur transaction de fixture en arrière. Migration STAGING/Production et dispatch réel restent hors périmètre.

## Prise en main guidée

L’accueil commence par trois repères : accès au dossier déjà vérifié par le serveur, connexion Hermes et disponibilité des missions liées. Vérifier mon atelier appelle uniquement les deux GET authentifiés existants, regroupés à la demande. Il n’y a aucune vérification automatique, aucune écriture et aucun appel de modèle. Une liste vide est annoncée comme telle ; une erreur de registre n’est pas traitée comme une liste vide. Chaque nouvelle vérification efface les anciens indicateurs avant de lire les services.

Les actions conduisent aux rubriques Installation et Missions, sans parcours simulé. Les compétences et le lancement réel restent explicitement futurs. Une connexion prête pour le suivi ne signifie jamais que l’exécution est activée. L’état du guide est un relevé de la page, pas une configuration persistée.

## Inventaire réel des capacités

GET `/api/companies/[id]/atelier-ia/inventory` autorise d'abord le dossier via CompanyService, puis consulte uniquement `/v1/skills` et `/v1/toolsets` sur le serveur lié explicitement à cette entreprise. Deux lectures indépendantes, timeout de trois secondes et 64 Kio par réponse, listes limitées à 100 éléments. La réponse expose les noms/descriptions des skills et noms/libellés/états de configuration des groupes ; les instructions, outils internes et champs supplémentaires sont retirés. Chaque liste peut être indisponible indépendamment. Aucun détail de secret, chemin ou configuration fournisseur n'est importé.

Le panneau Capacités lit cet inventaire uniquement sur clic, efface les anciennes données avant une nouvelle lecture et distingue présence, activation et configuration. Il n'installe ni n'active aucune extension. Les API, MCP et plugins détaillés restent à raccorder.

Le 14 octobre 2026, le nouveau client a lu le vrai serveur via le tunnel privé existant : 64 skills et 27 groupes d'outils, sans inférence. Cette preuve concerne le contrat natif et la projection du client ; elle ne constitue pas une recette Auth/RLS ni une connexion depuis Vercel.
