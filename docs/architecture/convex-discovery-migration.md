# Migration du parcours Discovery

MISSION: raccorder la première étape du parcours principal Discovery → Interview à Convex.
AFFECTED DOMAIN: Discovery et matérialisation du contexte entreprise.
CANONICAL OWNER: `DiscoveryService`, ses schémas et le wizard existant ; règles et données de contexte conservées.
CURRENT STATUS: PARTIAL ; questionnaire historique déjà porté, moteur principal encore à raccorder progressivement.
FILES EXPECTED: contrat de repository, adaptateur Convex, transport optionnel du wizard, tests de verrouillage et de lignée.
DB IMPACT: écritures de session, réponses et contexte entreprise dans les tables Convex déjà définies.
SECURITY IMPACT: contrôle du tenant et du rôle, verrou optimiste, validation complète et immutabilité après validation.
TEST PLAN: six étapes, matérialisation atomique, données décimales, conflits d’édition, reprise, refus inter-organisations.
OUT-OF-SCOPE: modification des moteurs de décision, faux résultats, suppression de la source ou dépense de modèle.

TARGET: développement `beaming-ermine-530`, Preview de la branche dédiée.
PRODUCTION?: non.
DISPOSABLE?: non.
BACKUP?: sauvegarde privée réalisée avant le lot audit ; aucun reset ou import destructif.
MIGRATION REQUIRED?: adaptation des repositories, sans réécriture du service.
RLS IMPACT?: contrôles serveur explicites à chaque opération.
TENANT IMPACT?: réponses et contexte liés à la même entreprise et organisation.
ROLLBACK PLAN?: garder les objets et données existants, retour du code sans effacement.

Les questionnaires/règles historiques sont classés LEGACY dans l’audit maître du dépôt. Leur port ne remplace pas Discovery, Interview, Knowledge et les moteurs aval canoniques. Ce lot réutilise le véritable wizard de compréhension ; le nouveau transport déclenche des fonctions Convex réelles, sans données de substitution.

## Implémentation

`DiscoveryService` conserve ses décisions et dépend d’un contrat de repository. L’adaptateur Prisma et son comportement historique restent disponibles ; le nouvel adaptateur Convex matérialise les mêmes profils, offres, objectifs, difficultés, équipes, rôles, outils et processus. La réponse, sa matérialisation et l’incrément du verrou sont atomiques. Une référence de département incohérente provoque un refus et un retour intégral à l’état précédent. Les remplacements de listes restent limités à l’entreprise et au brouillon concernés ; une session validée n’est plus modifiable.

Les champs NUMERIC sont des chaînes dans Convex. La conversion des entrées numériques reprend la précision et l’arrondi PostgreSQL via leur représentation décimale et BigInt, sans `toFixed` binaire ; les dépassements de capacité sont refusés. Les index composés organisation/entreprise sont ajoutés par le générateur de schéma cible afin d’éviter des lectures de toute l’organisation. Les catégories de processus se limitent au système et à l’organisation courante ; une catégorie absente reste nulle comme dans l’adaptateur source, aucune catégorie n’est inventée.

Le wizard existant reçoit un transport optionnel. Sa configuration par défaut conserve les appels HTTP historiques ; dans le pilote, le transport traduit les mêmes opérations vers Convex avec la session authentifiée. Le prochain lien vers Interview n’est pas exposé tant que son adaptateur n’est pas disponible. L’entrée principale de chaque entreprise devient « Commencer l’audit guidé » ; le questionnaire historique reste identifié séparément.

236 tests ciblés passent à cette étape. Les nouveaux tests vérifient la matérialisation complète, les arrondis décimaux, l’idempotence du démarrage, le conflit de verrou, le retour atomique sur erreur, le verrouillage validé, les droits et la séparation des entreprises d’une même organisation. La recette du staging doit confirmer le wizard et les données réellement enregistrées sur le commit publié.

Le backend de développement passe également 12 contrôles HTTP réels : démarrage idempotent sans réponses préfabriquées, validation prématurée refusée, édition concurrente avec un seul succès et un conflit, absence de doublon, lectures/écritures inter-organisations refusées, six étapes complétées, validation, verrouillage, reconnexion et accès anonyme refusé. Les contrôles utilisent uniquement une entreprise réservée à la validation technique. La recette du wizard dans le navigateur reste distincte de cette preuve API.
