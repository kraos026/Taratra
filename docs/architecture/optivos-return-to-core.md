# Revenir à Optivos et améliorer l’existant

Décision utilisateur du 27 octobre 2026 : reprendre Optivos comme produit principal et l’améliorer progressivement. Cette décision remplace la priorité précédente de construire une nouvelle plateforme universelle autour de l’audit.

MISSION: retrouver la référence conservée et remettre le parcours d’audit à l’accueil.
AFFECTED DOMAIN: entrée de l’application et direction produit.
CANONICAL OWNER: InteractiveDashboard et services métier existants, Auth/Organization et protections tenant.
CURRENT STATUS: retour au parcours canonique ; publication de cette modification sur Preview uniquement.
FILES EXPECTED: page d’accueil, tests de routage, présente décision, index et consignes de planification.
DB IMPACT: aucun ; aucune restauration de base nécessaire ou effectuée.
SECURITY IMPACT: aucun changement d’accès ou de rôle.
TEST PLAN: accueil audit sur Preview/Production et avec laboratoire activé ou désactivé ; types, lint, format et régression ciblée.
OUT-OF-SCOPE: suppression de l’Atelier, reset de branche, modification de moteur, migration, appel IA, merge ou déploiement Production.

## Référence retrouvée

Le dépôt `kraos026/Taratra` conserve la branche `astra/optivos-finalization-20260914` au commit `29ea642ba09215767258770d5e448fe9b0c0b6e2`, vérifié localement et sur GitHub le 27 octobre. Le checkout de référence existe dans `C:/AUTOMATEX_RECOVERY`. Ses artefacts locaux non suivis sont conservés.

Les évolutions de l’Atelier sont sur `codex/optivos-hermes-ui`, dans la PR #28 encore ouverte et en brouillon à cette vérification. La comparaison de `src/modules` entre la référence et le dernier commit avant ce retour ne montre des changements que dans `agent-workspace` : les modules métier d’audit n’ont pas été remplacés par l’orchestrateur.

## Retour concret

L’accueil `/` rend de nouveau directement `InteractiveDashboard`, comme dans la référence. La redirection automatique vers `/atelier-ia/entreprises` lorsque le laboratoire est activé en Preview est supprimée. Les liens existants avec `?view=audit` restent compatibles puisque la page d’accueil affiche désormais toujours le dashboard d’audit.

L’Atelier IA reste accessible par ses liens et routes explicites, avec ses contrôles existants. Son code, ses brouillons et les travaux précédents ne sont pas supprimés. Il est secondaire ; l’extension de l’orchestrateur n’est plus la priorité produit de cette étape.

## Suite proposée sur Optivos

1. Refaire le parcours entreprise → audit → opportunités → ROI → résultats pour identifier les difficultés réellement observées.
2. Corriger d’abord navigation, reprise du dossier, lisibilité des résultats et erreurs rencontrées, avec des changements courts.
3. Améliorer ensuite la présentation des preuves et des recommandations en conservant les calculs et contrats métier.
4. Ajouter une assistance IA seulement lorsqu’elle facilite une étape précise de ce parcours et respecte les coûts autorisés.

Ce document ne certifie pas une restauration des données ni le fonctionnement complet du parcours sur staging : aucune donnée n’a été restaurée ou recalculée. Chaque amélioration ultérieure devra disposer de ses propres preuves.
