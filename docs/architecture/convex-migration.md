# Migration Optivos vers Convex

Décision utilisateur du 27 octobre 2026 : remplacer Supabase par Convex et conserver Optivos comme produit principal. Création du projet et utilisation de la CLI autorisées ; conditions Convex acceptées explicitement par l’utilisateur pendant l’initialisation.

MISSION: préparer et réaliser la migration des comptes, données et frontières serveur vers Convex, sans réécrire les moteurs métier.
AFFECTED DOMAIN: infrastructure, authentification, repositories et vérifications de migration.
CANONICAL OWNER: services métier existants pour calculs/contrats ; Convex devient la cible de persistance et d’autorisation après validation des parcours.
CURRENT STATUS: fondation Convex déployée en développement ; parcours pilote Auth → Organization → Company et cycle questionnaire d’audit raccordés séparément. Les étapes Discovery, opportunités, ROI et résultats exécutifs restent sur leur couche existante.
FILES EXPECTED: inventaire déterministe, schéma Convex, accès par identité/organisation, premier adaptateur métier, tests et documentation.
DB IMPACT: nouvelles tables sur le seul déploiement Convex de développement ; aucune suppression ou réinitialisation Supabase.
SECURITY IMPACT: remplacer les garanties RLS par des contrôles serveur dans chaque fonction Convex ; ne pas faire confiance à un identifiant de tenant/client.
TEST PLAN: conversions sans perte, UUID/versions/provenance, comptes et rôles, refus inter-tenant, parité métier et parcours complet avant bascule.
OUT-OF-SCOPE: achat, souscription, effacement des sources, suppression de comptes, migration destructive ou coupure prématurée de l’ancien service.

TARGET: projet `optivos`, équipe `taratramiarintsoa2`, déploiement `dev/optivos-migration` (`beaming-ermine-530`).
PRODUCTION?: non, déploiement de développement.
DISPOSABLE?: non présumé ; ne pas réinitialiser.
BACKUP?: export de la source et sauvegarde de la cible requis avant transfert réel ; aucun export complet vérifié à cette étape.
MIGRATION REQUIRED?: oui, PostgreSQL/Prisma ne se connecte pas directement au modèle documentaire Convex.
RLS IMPACT?: les politiques SQL ne sont pas importables comme droits Convex ; les fonctions doivent reproduire chaque protection utile.
TENANT IMPACT?: conserver organisations, rôles, utilisateurs et lignée des dossiers/résultats ; aucune adhésion par e-mail non vérifié.
ROLLBACK PLAN?: garder les données et le fonctionnement source tant que le déploiement Convex n’a pas passé les critères de bascule ; aucune double écriture implicite.

## Choix techniques

- CLI Convex ponctuelle, sans serveur MCP permanent ni watcher laissé actif. Projet créé avec `convex project create`, puis déploiement de développement sélectionné séparément.
- `convex` 1.48.0 ; intégration officielle `@convex-dev/better-auth` 0.12.6 et `better-auth` 1.6.15 pour Next.js. L’ancienne bibliothèque Convex Auth annonce encore un support Next.js expérimental ; elle n’est pas retenue ici.
- Conserver les identifiants métier UUID et les références existantes dans des champs explicites ; `_id` Convex reste distinct. Conserver exactement les décimaux lors du transfert, sans conversion monétaire silencieuse en flottants.
- Produire l’inventaire depuis le schéma Prisma et les migrations SQL, sans appeler de modèle. Une table SQL absente de Prisma doit être signalée et traitée, pas abandonnée.
- Aucune autorisation ne découle d’un manifeste ou d’un import. Les identités authentifiées doivent être associées aux utilisateurs existants par une migration contrôlée.

## Critères avant arrêt de Supabase

1. Export complet et vérifié : données métier, catalogues, tables hors Prisma, comptes/liaisons d’identité et fichiers éventuels.
2. Import vérifié avec comptages, doublons, références, versions et précision des données ; politiques de lecture/écriture reproduites et testées.
3. Connexion, déconnexion, récupération de compte et onboarding éprouvés avec la nouvelle authentification.
4. Parcours entreprise → audit → opportunités → ROI → résultats opérationnel sur Convex, avec résultats comparés aux moteurs canoniques.
5. Repositories et routes migrés, aucune dépendance Supabase résiduelle active sur les parcours retenus ; modification de configuration contrôlée.
6. Plan de retour et point d’arrêt des écritures source définis ; supprimer les dépendances devenues inutiles seulement après ce contrôle.

Les dates, prix, limites et coûts d’import éventuels ne sont pas présumés gratuits sans vérification. La création de ce déploiement ne vaut pas validation de capacité, migration achevée ou arrêt du service source.

## Avancement et choix du pilote

Le 28 octobre, l’utilisateur précise que les anciens comptes sont des tests sans importance. Le pilote démarre donc avec de nouveaux comptes et des organisations neuves ; aucun compte ni dossier source n’est effacé. La récupération de ces comptes de test ne bloque plus le pilote. Ce choix ne vaut pas validation d’un import ni autorisation de supprimer la source.

Le projet source de la Preview est confirmé par sa configuration Vercel : `automatex-staging`, `ajvncwsazrhqjlktzojm`. Le connecteur le signale inactif, une lecture de métadonnées SQL échoue (« Database is possibly not accessible ») et son nom DNS ne se résout pas lors du contrôle. Aucun export réel n’a pu être réalisé.

Le schéma cible est généré depuis 125 modèles / 1 469 champs scalaires, dont 85 décimaux. L’inventaire signale quatre créations historiques SQL hors Prisma : `private.privacy_request_events`, `private.privacy_request_operators`, `public.agent_company_workspaces`, `public.agent_mission_links`. Ce sont des éléments à examiner si une récupération est nécessaire, pas des tables déclarées couvertes par l’import.

`/convex-pilot` constitue l’entrée temporaire de vérification sur la branche Preview `codex/optivos-hermes-ui`. Elle utilise le composant officiel Better Auth via `/api/auth`, puis les fonctions Convex d’organisation et d’entreprise. Pas de session Supabase, d’écriture double ou de données simulées dans ce parcours. Le reste du site n’est pas déclaré migré.

L’activation requiert `NEXT_PUBLIC_OPTIVOS_CONVEX_PILOT=1` dans la Preview et `OPTIVOS_CONVEX_FRESH_PILOT=1` dans le seul backend de développement. La Production ne reçoit pas ces réglages. Sans activation, la page est absente et la route Auth refuse les requêtes. L’identité JWT vérifiée est reliée à un nouvel UUID serveur ; aucun rapprochement ni octroi d’accès n’est fait par adresse e-mail.

Les comptes pilotes utilisent un mot de passe d’au moins 12 caractères. Leur adresse e-mail n’est pas vérifiée tant qu’aucun service d’envoi n’est configuré ; elle ne permet donc pas de revendiquer un compte, rôle ou dossier préexistant. Le rétablissement de mot de passe et l’invitation d’utilisateurs ne sont pas encore disponibles. Cette configuration sert à tester des espaces neufs et ne constitue pas l’authentification certifiée pour les clients.

La création d’organisation et d’adhésion propriétaire est atomique et idempotente par identité. Une adhésion révoquée ne peut pas être recréée par la même fonction. L’adaptateur entreprise réutilise `CompanyService` et ses validations : liste, lecture, création, modification, archivage et restauration. Les suppressions définitives restent refusées jusqu’à la traduction des dépendances SQL. La liste refuse explicitement plus de 1 000 entreprises dans une organisation ; sa collation texte n’est pas encore certifiée équivalente au PostgreSQL source.

## Commandes de travail

- `npm run convex:inventory` : inventaire déterministe, aucune lecture de données ni appel de modèle.
- `node scripts/convex-migration/inventory.mjs --generate` : régénération du schéma cible, puis revue du diff.
- `npm run test:convex` : tests de conversion, isolation et organisations neuves en mémoire.
- `npm run convex:codegen` : génération des liaisons typées à versionner.
- `npm run convex:dev:once` : déploiement ponctuel vers la cible sélectionnée, sans watcher.
- `node scripts/convex-migration/prepare-import.mjs SNAPSHOT_PRIVE_JSON NOUVEAU_DOSSIER_PRIVE` : préparation locale uniquement, aucune importation réseau. Le bundle version 1 fournit toutes les tables du contrat, même vides, sous `tables["schema.table"]`, avec colonnes SQL. Décimaux et BigInt sont des chaînes exactes ; dates ISO avec fuseau explicite ; Bytes en base64 canonique. Les tables/colonnes inconnues, doublons et références manquantes bloquent la préparation. Les fichiers restent hors dépôt. Comptes Auth, objets Storage et tables hors contrat ne sont pas déclarés migrés par cet outil.

## Prochains lots

Validation du socle : 164 tests ciblés réussis (dont 19 pour le contrat de migration, les conversions et les accès Convex), vérification TypeScript réussie et fonctions déployées sur `beaming-ermine-530`. Un appel HTTP réel sans identité vers `companies:list` est refusé. Ces preuves ne remplacent pas la recette navigateur de la Preview ni la certification du parcours d’audit complet.

Recette du 28 octobre sur le commit `4f71ee942bff0fd7ca4b207499505ae573c91643`, déploiement Preview `dpl_C9Zn5q5ZisC2gtS6KHVXvEksmnyo` : 13 contrôles HTTP réels passent, dont création, persistance après reconnexion et refus lecture/écriture inter-organisations. Le navigateur passe neuf contrôles : inscription neuve, organisation, entreprise, archivage/restauration, rechargement, déconnexion/reconnexion, absence d’erreur JavaScript et affichage mobile sans débordement horizontal. Les tests utilisent trois comptes de validation isolés, dont les identifiants restent hors dépôt ; aucun envoi d’e-mail ni appel à un modèle. La build Vercel et le job CI `quality` (installation propre, lint, format, types, tous les tests et build) passent sur ce commit. Cette recette ne certifie pas le parcours d’audit encore non migré. La lecture des captures a ensuite motivé une correction locale du contraste des libellés du formulaire entreprise.

1. Recetter le parcours neuf sur la Preview : inscription → connexion → organisation → entreprise → archivage/restauration → reconnexion, plus refus inter-organisations.
2. Migrer les repositories de l’audit et de Discovery, en réutilisant les services et calculs existants ; vérifier les contraintes et droits que SQL assurait auparavant. Le [lot audit/questionnaire](convex-audit-migration.md) ajoute le cycle de réponses, progression, clôture, validation et résumé ; Discovery et les résultats aval restent à raccorder.
3. Étendre progressivement aux étapes canoniques en aval, puis supprimer la dépendance active à Prisma/Supabase lorsque le parcours complet est prouvé sur Convex.
4. Configurer vérification e-mail, récupération, invitations et protections d’exploitation avant ouverture aux entreprises pilotes.

Sources vérifiées le 27 octobre 2026 : [CLI](https://docs.convex.dev/cli), [authentification et autorisation](https://docs.convex.dev/auth), [Convex Auth](https://docs.convex.dev/auth/convex-auth), [Better Auth pour Next.js](https://labs.convex.dev/better-auth/framework-guides/next), [import](https://docs.convex.dev/database/import-export/import), [schémas](https://docs.convex.dev/database/schemas).
