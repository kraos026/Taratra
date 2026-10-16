# Atelier IA / Hermes — périmètre de l’intégration

MISSION: Réorganiser la navigation et ajouter le tableau Hermes Facile dans Optivos, sans modifier ses moteurs.
AFFECTED DOMAIN: Présentation, navigation, expérimentation des missions d’agents.
CANONICAL OWNER: Les services Auth/Organization/Company existants restent propriétaires de l’accès. Les moteurs d’audit, ROI et recommandation restent propriétaires des décisions.
CURRENT STATUS: SHADOW — démonstration, pas un runtime actif.
FILES EXPECTED: Module agent-workspace, pages Atelier IA, navigation des deux shells, proxy et documentation/tests associés.
DB IMPACT: Aucune migration ni écriture supplémentaire. La démonstration garde ses missions uniquement dans l’état React ; quitter ou actualiser la page les efface.
SECURITY IMPACT: Accès via Supabase et CompanyService existants ; identifiants d’entreprise vérifiés. Aucun secret fournisseur, appel de modèle ou outil externe. Accès expérimental désactivé par défaut et refusé en Production.
TEST PLAN: Contrôle du flag, accès à l’entreprise, isolation par contexte, états de simulation, liens/navigation, types/lint et aperçu visuel. La certification Supabase/RLS et STAGING du nouveau module reste NOT RUN tant qu’elle n’est pas exécutée.
OUT-OF-SCOPE: Moteurs, calculs, recommandations, campagne email, suppression de données, migrations, publication Production, activation de Hermes/OpenRouter/9Router/ArtCraft.

Base: `29ea642ba09215767258770d5e448fe9b0c0b6e2`. Travail isolé dans la branche `codex/optivos-hermes-ui`. Les fichiers de mesures non suivis du checkout principal restent en attente dans ce checkout ; ils ne sont ni incorporés ni modifiés.

Les échanges consultés confirment le positionnement: Optivos pour décider et spécifier ; un menu distinct « Atelier IA » pour les missions d’agents, avec « Studio créatif » comme extension éventuelle. Les anciennes certifications concernent leurs SHA et environnements, pas ce nouvel espace. Elles ne sont pas réutilisées comme preuve de certification.

## Regroupement de navigation — 14 octobre 2026

MISSION: Regrouper Mon entreprise → Résultats sous Audit, et réserver Orchestrateur & agents à l’Atelier IA et ses futures extensions.
AFFECTED DOMAIN: Présentation exclusivement, composants de navigation communs et adaptation mobile/tablette.
CANONICAL OWNER: Les routes et moteurs existants conservent leur responsabilité.
CURRENT STATUS: SHADOW, aucune connexion d’agent activée.
FILES EXPECTED: Deux shells, composant GroupedNavigation, CSS responsive, tests et aperçu.
DB IMPACT: Aucun.
SECURITY IMPACT: Flags et autorisations inchangés ; liens d’entreprise conservés.
TEST PLAN: Types, lint, tests de navigation existants, navigateur clavier/mobile/tablette avec API simulée.
OUT-OF-SCOPE: Moteurs, API, nouvelles connexions réelles, publication et appels payants.

Skill utilisée : UI UX Pro Max, complétée par Optivos UI UX. Menus à boutons natifs, état ouvert annoncé, emplacement courant indiqué, cibles de 44 px et libellés visibles. La recherche locale UX a retourné des recommandations de fil d’Ariane et de titres, sans correspondance directe pour les menus repliables ; le regroupement suit la demande et les règles d’accessibilité de la skill. Les extensions futures restent un texte « À venir », sans lien fictif.

## Connexion Hermes en lecture seule — 14 octobre 2026

MISSION: Vérification manuelle de la connexion Hermes dans le dossier entreprise, sans lancement.
AFFECTED DOMAIN: Agent-workspace SHADOW ; adaptateur serveur, endpoint de consultation et panneau Connexion.
CANONICAL OWNER: CompanyService/Auth/RLS contrôlent le dossier ; Hermes reste propriétaire de son runtime. Aucun moteur Optivos n’est modifié.
CURRENT STATUS: SHADOW, lecture seule, budget IA 0 €.
FILES EXPECTED: Adaptateur santé, contrat public minimal, route GET company-scoped, panneau et tests/documentation.
DB IMPACT: Aucun. Pas de registre parallèle de missions.
SECURITY IMPACT: Clé serveur privée, entreprise liée explicitement côté serveur, aucun identifiant de mission fourni par le navigateur, aucune redirection. Timeout et taille de réponse bornés.
TEST PLAN: Auth/flag/entreprise avant requête externe, isolation A/B, statut indisponible, réponse malformée, secret non exposé, endpoints exclusivement GET /v1/capabilities, UI navigateur simulée.
OUT-OF-SCOPE: Exécution, arrêt, approbations, sessions globales, historique des missions, achat, modification du VPS et déploiement.

L’accès réel de santé a été vérifié par le connecteur Hermes de ce chat. Ce résultat ne prouve pas une configuration réseau ou des secrets dans le serveur Optivos. Un statut de mission réel exige d’abord une liaison persistante mission ↔ entreprise certifiée ; ce périmètre affiche seulement la santé et les capacités de suivi, sans importer les sessions d’autres clients.

## Recette réelle locale du raccordement — 14 octobre 2026

MISSION: Configurer la lecture de santé avec la clé Hermes existante et un tunnel déjà ouvert ; vérifier la route Optivos avec Auth/RLS réels pour deux comptes de certification locaux.
AFFECTED DOMAIN: Recette du module agent-workspace et script de lancement privé.
CANONICAL OWNER: Auth/CompanyService/RLS existants, runtime Hermes existant.
CURRENT STATUS: SHADOW, lecture seule, aucun appel de modèle.
FILES EXPECTED: Script de recette, documentation et preuves ; configuration privée hors Git.
DB IMPACT: Supabase LOCAL de certification déjà présent ; réutilisation des comptes A/B et entreprises existants sans écriture métier. Les connexions créent les sessions Auth normales.
SECURITY IMPACT: Secret DPAPI lu uniquement en mémoire, origine locale fixe, entreprise issue de la DB authentifiée, tests négatifs A/B.
TEST PLAN: GET authentifié via vrai serveur Next ; refus sans compte et entre entreprises ; aucun lancement.
OUT-OF-SCOPE: Modifications moteurs, écritures STAGING/PRODUCTION, déploiement public, sessions globales, appels payants.

TARGET: LOCAL uniquement, projet Supabase automatex de certification existant.
PRODUCTION?: NON.
DISPOSABLE?: OUI, données de certification uniquement.
BACKUP?: Aucun écrasement ni suppression de données existantes.
MIGRATION REQUIRED?: Aucune migration et aucune initialisation ; base existante uniquement.
RLS IMPACT?: Politiques existantes conservées et testées.
TENANT IMPACT?: Deux comptes de test locaux isolés.
ROLLBACK PLAN?: Fermer le serveur de recette ; conserver les conteneurs existants et fermer les processus créés par cette recette.

## Missions Hermes liées aux entreprises — 14 octobre 2026

MISSION: Persister les liaisons entreprise/mission puis consulter leur état réel, sans lancement.
AFFECTED DOMAIN: Agent-workspace SHADOW et registre Supabase.
CANONICAL OWNER: Auth/CompanyService pour l’accès, Supabase pour la persistance/RLS, Hermes pour l’état d’exécution.
CURRENT STATUS: SHADOW, suivi en lecture seule, budget IA 0 €.
FILES EXPECTED: Migration et test RLS dédiés, dépôt Supabase, client GET de statut, routes de consultation, panneau Activité réelle, tests et recette locale.
DB IMPACT: Nouvelle table agent_mission_links ; aucun moteur ni table métier existante modifié. Aucun modèle Prisma généré nécessaire pour ce dépôt PostgREST.
SECURITY IMPACT: Un run ne peut appartenir qu’à une entreprise ; FK composite organization/company ; lecture RLS ; aucune écriture accordée à anon/authenticated. Liaison créée par opérateur serveur, jamais par un run_id transmis depuis le navigateur.
TEST PLAN: Migration LOCAL, RLS A/B et refus d’écriture, consultation de run enregistré uniquement, erreur/timeout/contrat invalide, UI réelle et persistance au rechargement.
OUT-OF-SCOPE: Soumission de mission, inférence, arrêt, approbation, résultats bruts, sessions globales, migration STAGING/Production et déploiement.

TARGET: Supabase LOCAL de certification uniquement.
PRODUCTION?: NON.
DISPOSABLE?: OUI, comptes et liaisons de test.
BACKUP?: Aucun reset, drop ou écrasement de table existante.
MIGRATION REQUIRED?: OUI, additive et appartenant à Supabase.
RLS IMPACT?: Nouvelle politique de lecture par organisation et entreprise active, pas de privilège d’écriture client.
TENANT IMPACT?: Cloisonnement A/B et lignée entreprise/organisation vérifiés.
ROLLBACK PLAN?: Fermeture du serveur de recette ; migration non publiée et aucun reset distant. Les données locales restent disponibles pour les prochains tests.

## Accueil guidé pour novices — 14 octobre 2026

MISSION: Guider l’utilisateur depuis son dossier vérifié vers la connexion, le suivi réel et une simulation explicitement identifiée.
AFFECTED DOMAIN: Présentation agent-workspace uniquement.
CANONICAL OWNER: Routes de consultation Company/Hermes/registre existantes, sans nouvel endpoint.
CURRENT STATUS: SHADOW, guide en lecture seule et simulation locale.
FILES EXPECTED: Panneau de prise en main, accueil, recettes visuelles et documentation.
DB IMPACT: Aucun nouveau schéma ou écriture métier.
SECURITY IMPACT: Deux GET manuels via les routes authentifiées existantes ; aucun secret, nouveau droit ou lancement.
TEST PLAN: Vérifications partielles/échouées, liste vide/non vide, absence d’appels automatiques, navigation vers les rubriques, mobile et UI authentifiée.
OUT-OF-SCOPE: Dispatch, dépenses, installation sur VPS, activation de compétences/modèles, publication et moteurs Optivos.

## Poste de commande réel — 14 octobre 2026

MISSION: Remplacer le parcours simulé par un tableau cohérent avec missions, discussion, capacités et installation ; préparer le raccordement réel.
AFFECTED DOMAIN: Présentation agent-workspace et diagnostic de connexion en lecture seule.
CANONICAL OWNER: Auth/CompanyService/RLS existants ; Hermes possède son runtime ; moteur d'audit inchangé.
CURRENT STATUS: SHADOW. Suivi des missions liées disponible ; discussion, dispatch et installation depuis Optivos restent non raccordés.
FILES EXPECTED: Panneaux, recettes UI, documentation de raccordement.
ADDITIONAL SCOPE: Inventaire manuel réel des skills et groupes d'outils, GET natifs bornés, projection sans secrets, autorisation Company avant toute lecture externe. Pas d'installation ni d'activation. Tester isolation, réponses invalides, absence d'appels automatiques et de fuite de champs privés.
DB IMPACT: Aucun changement de schéma ou de données.
SECURITY IMPACT: GET manuels existants ; aucun secret navigateur, dépense ou activation implicite. Budget de 0 € de nouveaux frais API conservé.
TEST PLAN: Navigation desktop/mobile, absence de faux résultats, diagnostics, erreurs et absence de mutations ; isolation existante.
OUT-OF-SCOPE: Production, moteur d'audit, achat, reset VPS, ouverture publique du serveur natif. Connexion HTTPS et contrôle des coûts requis avant exécution.

## Entreprises IA inspirées de Paperclip — configuration persistante

MISSION: Ajouter une option de création d'entreprise d'agents, indépendante d'un dossier d'audit et pouvant lui être reliée. Trois modes : guidé, modèle et manuel ; petite équipe d'abord.
AFFECTED DOMAIN: Agent-workspace SHADOW, configurations organisationnelles et liaison facultative au Company canonique.
CANONICAL OWNER: Auth/Organization et permissions Company existantes ; Supabase possède la nouvelle persistance ; Hermes reste le runtime, sans changement des moteurs d'audit.
CURRENT STATUS: Configuration persistante en préparation ; exécution non raccordée. Aucune équipe n'est annoncée opérationnelle sur la seule création de configuration.
FILES EXPECTED: Schéma/domain, routes et service de configuration, repository PostgREST/RLS, wizard/listing, migration et tests dédiés, documentation de l'analyse Paperclip/REA.
DB IMPACT: Table agent_company_workspaces additive ; organization_id obligatoire, company_id facultatif avec FK composite ; pas de modèle Prisma supplémentaire ni duplication d'Auth.
SECURITY IMPACT: Organisation sélectionnée selon le repository canonique ; droits owner/admin/consultant pour créer et lier, viewer pour consulter ; secrets exclus, état preparation et budget API 0 contraints en DB ; maximum trois profils et une exécution simultanée prévue.
TEST PLAN: Validation stricte, replay idempotent, accès avant lecture/écriture, origine/JSON bornés, RLS A/B/viewer/anonyme, FK/liaison inactive, persistence et UI des trois modes. CI utilise Supabase LOCAL jetable avant application staging.
OUT-OF-SCOPE: Dispatch, scheduler, installation complète de Paperclip, comptes clients, Production, moteur d'audit, abonnement, achats et inférence.

TARGET: Supabase LOCAL CI jetable, puis automatex-staging ajvncwsazrhqjlktzojm seulement.
PRODUCTION?: NON.
DISPOSABLE?: CI oui ; staging persistante, aucun reset.
BACKUP?: Migration additive, aucune donnée existante écrasée.
MIGRATION REQUIRED?: Oui, agent_company_workspaces, propriété Supabase.
RLS IMPACT?: Nouvelles politiques SELECT/INSERT et UPDATE de la seule liaison company_id. Pas de DELETE, déplacement de tenant ou activation.
TENANT IMPACT?: Organisation obligatoire dès la création indépendante ; liaison uniquement à une entreprise active du même tenant.
ROLLBACK PLAN?: Revenir à la Preview précédente ; conserver les configurations et la table, aucune suppression distante.

## Espace pilote personnel et consultation Hermes — 15 octobre 2026

MISSION: Creer l'espace reel demande par l'utilisateur et raccorder sa consultation Hermes.
AFFECTED DOMAIN: Agent-workspace SHADOW uniquement.
CANONICAL OWNER: Auth/Organization existants, agent_company_workspaces et Hermes.
CURRENT STATUS: Configuration persistante et consultation ; aucun dispatch.
FILES EXPECTED: Clients Hermes partages avec scope entreprise IA, routes Auth/RLS et panneaux existants reutilises, tests.
DB IMPACT: Une configuration personnelle creee dans la table existante ; aucune migration ni table metier modifiee.
SECURITY IMPACT: Proprietaire reel verifie par adresse connue et membership canonique ; ecriture sous role authenticated/RLS ; binding explicite par workspace, distinct des dossiers d'audit. Aucun run global.
TEST PLAN: Refus anonyme/autre org/espace inconnu avant reseau ; scope configure exact ; sante/inventaire publics ; UI de composants ; CI.
OUT-OF-SCOPE: Moteurs d'audit, Production, inférence, budget payant, execution, modifications du modele global.

TARGET: automatex-staging ajvncwsazrhqjlktzojm, compte reel kraosltd2@gmail.com et son organisation existante.
PRODUCTION?: NON.
DISPOSABLE?: NON ; donnees personnelles du pilote demandees par l'utilisateur.
BACKUP?: Aucune donnee existante ecrasee ; ajout unique avec UUID fixe pour eviter les doublons.
MIGRATION REQUIRED?: NON.
RLS IMPACT?: Politiques existantes conservees ; role authenticated et auth.uid du proprietaire verifie.
TENANT IMPACT?: Organisation canonique du compte uniquement ; aucun dossier CERT reutilise.
ROLLBACK PLAN?: Revenir a la Preview precedente, conserver la configuration ; aucune suppression distante.

## Premier contrôle zéro frais — 15 octobre 2026

MISSION: Vérifier puis construire une barrière effective avant le premier dispatch réel.
AFFECTED DOMAIN: Agent-workspace SHADOW, adaptateur runtime du pilote.
CANONICAL OWNER: Auth/Organization et registre agent-workspace existants ; Hermes pour l'exécution.
CURRENT STATUS: Consultation raccordée ; lancement interdit tant que la barrière n'est pas éprouvée.
FILES EXPECTED: Politique déterministe de prix/outils/fallback et tests, documentation ; éventuel proxy privé borné du pilote.
DB IMPACT: Aucun au diagnostic. Toute persistance de nouvelles missions sera cadrée séparément avant migration.
SECURITY IMPACT: Modèle explicitement gratuit, tarification fraîche, aucun repli payant ; aucune modification des accès canoniques ou du modèle global existant.
TEST PLAN: Prix inconnu/payant/refusé, modèle non autorisé, prix/cache périmé, repli, outils externes payants ; contrôles négatifs avant toute inférence.
OUT-OF-SCOPE: Production Optivos, moteurs d'audit, achat/abonnement et appels payants.

## Mission 2026-10-16 : relecture humaine du pilote

MISSION: accepter un résultat ou enregistrer une demande de correction, sans génération automatique.
AFFECTED DOMAIN: Atelier IA / pilote textuel.
CANONICAL OWNER: agent-workspace pour les accès ; adaptateur VPS pour les missions.
CURRENT STATUS: SHADOW / Preview.
FILES EXPECTED: free-pilot domaine/application/UI, API review, adaptateur et tests.
DB IMPACT: table SQLite additive de relectures ; aucune évolution Supabase.
SECURITY IMPACT: rôle écrivain, origine, organisation et espace vérifiés ; historique immuable.
TEST PLAN: persistance, idempotence, concurrence, refus des états non terminés, contrôles API et compilation.
OUT-OF-SCOPE: moteur d’audit, production, actions externes, inférence automatique.

TARGET: SQLite privé du pilote VPS ; PRODUCTION? non, pilote staging.
DISPOSABLE? non ; BACKUP? sauvegarde SQLite cohérente avant déploiement.
MIGRATION REQUIRED? création additive versionnée dans l’adaptateur.
RLS IMPACT? aucun ; TENANT IMPACT? même liaison espace/organisation, aucune réaffectation.
ROLLBACK PLAN? restaurer le service précédent ; conserver la table additive et la sauvegarde.
