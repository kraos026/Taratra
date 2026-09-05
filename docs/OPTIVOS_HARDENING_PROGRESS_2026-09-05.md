# Optivos — suivi de remédiation du 5 septembre 2026

Ce document complète l'audit initial `OPTIVOS_MASTER_AUDIT_2026-09-05.md`.
Un PASS local ne certifie ni Preview ni Production. Aucun déploiement Production,
changement DNS ou rotation de secret n'a été effectué pendant cette reprise.

## Corrections isolées

| Commit  | Périmètre                                                                               |
| ------- | --------------------------------------------------------------------------------------- |
| f0d541c | Callback de connexion sûr, cookies de session conservés, contexte utilisateur explicite |
| b59b799 | Accès exécutif inaccessible distingué d'une panne de lecture                            |
| dfb6053 | Garde des cibles de tests, contrôles de disponibilité et isolation réelle du compte B   |
| 1d8602f | Tests des réponses 400/404 et des pannes du Decision Center                             |
| 472b1bf | Validation Discovery interdite après échec de sauvegarde, sortie d'état occupé          |
| b08add4 | Historique Supabase comme autorité de certification des migrations                      |
| a2cb3c3 | Réhydratation des réponses Discovery et conservation des détails non édités             |
| c9bc957 | Entrée Auth cohérente, formulaires lisibles, erreurs réseau/fournisseur récupérables    |
| 28fc7c0 | Protections HTTP de base et écrans de reprise en français                               |
| 0762132 | Découverte de tous les tests pilote, sans liste manuelle incomplète                     |

Les modifications ne promeuvent pas Brain/Kimi et ne changent pas les règles
canoniques, les calculs ROI ou les migrations applicatives.

## Validation locale obtenue

Code applicatif de `07621326fd3148e1d2ff1f820dcf8ae727dcf6ea` :

- Vitest : 185 fichiers, 1119 tests PASS.
- Lint et typecheck : PASS.
- Build : PASS sur le code applicatif identique au commit `28fc7c0`.
- Playwright pilote : 25/25 PASS, dont erreurs Auth, affichage inscription
  390/820/1440 px, sauvegarde/rafraîchissement Discovery, feedback et isolation.
- Vérification visuelle de l'inscription : champs sombres et libellés lisibles.
- Réponse HTTP locale `/signup` : 200, en-têtes de sécurité présents.
- Format des fichiers modifiés : PASS.

La CSP ajoutée protège le cadrage, les objets embarqués et la base des URLs.
Ce n'est pas une CSP complète à nonce pour les scripts, ni une certification XSS exhaustive.
Les tests d'erreur du fournisseur Auth interceptent les réponses pour reproduire
les pannes ; le test positif de connexion utilise réellement Supabase local.

## Base jetable : preuve distincte

Copie Git dédiée : `optivos-disposable-cert-20260905`, SHA `0762132`.
La copie ne contient aucun fichier `.env.local` ni lien Vercel du workspace initial.
Deux ajustements locaux temporaires de `supabase/config.toml` sont explicitement exclus
de la release : identifiant Docker unique et désactivation du cache expérimental pg-delta.

Le premier démarrage a appliqué les 24 migrations puis est resté bloqué dans
le conteneur de sérialisation du catalogue pg-delta. Le redémarrage sans cette
option expérimentale a réussi. Aucune migration n'a été réécrite ni contournée.

Contrôles obtenus sur les nouveaux volumes :

- Historique : 24/24, aucune migration manquante, supplémentaire ou renommée.
- Migration de feedback `20260903090000` : présente.
- Tables publiques applicatives : 124 ; tables sans RLS : 0.
- pgTAP : 18 fichiers / 237 tests PASS.
- Prisma validate / generate : PASS.
- Build propre : PASS.
- Canonical complet : PASS, run `run-20260905161755-124c20bf`.
- Executive Result : READY, complete=true, 4 recommandations.
- Compte B authentifié : accès à l'entreprise A, résultats et Decision Center
  refusés en 404 avant et après publication ; PASS.
- Persistance après rafraîchissement : PASS.
- Playwright sur cette même base : 25/25 PASS (1,7 minute).
- Aucun P1000/P2028 ou 500 inattendu observé pendant ces contrôles.

Un essai supplémentaire de six POST simultanés de feedback, pour une entreprise
neuve de cette base jetable, a renvoyé six HTTP 200 et laissé une seule ligne.
Le risque de concurrence n'est pas reproduit dans cet essai, sans constituer une
preuve exhaustive de tous les entrelacements possibles.

L'avertissement pg a été reproduit avec une lecture GET de Specification (HTTP 200).
La trace pointe vers `@prisma/client/runtime/client.js` et l'adaptateur pg durant
l'hydratation relationnelle. Cela corrige l'attribution initiale au runner SQL :
le serveur applicatif l'émet. Aucun changement opportuniste du moteur ou de la
version pg n'a été effectué ; la compatibilité future pg 9 reste à traiter.

Les volumes du projet local initial `automatex` ont été conservés lors de son
arrêt temporaire. Aucun reset distant n'a été exécuté.

## Gates restant ouverts

1. Certification locale neuve obtenue pour le scénario nommé ; étendre la matrice
   négative au-delà des tests déjà présents avant de prétendre à une couverture exhaustive.
2. Concurrence feedback : essai six envois PASS, poursuivre les tests de charge ciblés.
3. Qualifier les dépendances signalées et l'avertissement pg de concurrence.
4. Déployer et certifier une Preview à partir d'un SHA propre final.
5. Traiter séparément les décisions nécessitant le propriétaire : rotation de la
   protection de déploiement signalée dans l'audit, sessions orphelines Production,
   DNS/SSL et autorisation de déploiement public.
6. V1 payante : récupération de compte autonome, support réel, conditions/prix,
   export et procédures d'exploitation ne sont pas encore certifiés.

**Statut : remédiation locale en cours ; Preview et Production NOT CERTIFIED.**
