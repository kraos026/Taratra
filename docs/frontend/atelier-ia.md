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
