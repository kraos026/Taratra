# Point de reprise Convex — 28 octobre 2026

MISSION: sauvegarder l’état fonctionnel et ses preuves avant nettoyage des caches locaux.
AFFECTED DOMAIN: documentation de reprise, aucune logique métier.
CANONICAL OWNER: services et moteurs existants ; les adaptateurs Convex remplacent progressivement leur stockage.
CURRENT STATUS: PARTIAL ; Auth → Organization → Company → Discovery → Interview fonctionne dans le pilote.
FILES EXPECTED: ce point de reprise et un bilan de validation expurgé de toute donnée privée.
DB IMPACT: aucun ; les sauvegardes de bases restent privées et conservées hors dépôt.
SECURITY IMPACT: aucune clé, compte de recette, session, réponse client ni archive de base dans cette sauvegarde Git.
TEST PLAN: vérifier le commit distant, les preuves de recette et la propreté Git après nettoyage.
OUT-OF-SCOPE: suppression de sources, de comptes, de bases Docker, des runtimes Codex ou publication Production.

## État sauvegardé

Le code fonctionnel est dans le commit `7dc37058326f67326d3c596092e36dc2dee04607`, branche `codex/optivos-hermes-ui`, PR #28. Le backend de développement est `beaming-ermine-530`. La Preview passe la build ; la CI de ce commit passe les jobs quality et database-security.

Le [bilan de recette](../validation/convex-pilot-2026-10-28.json) contient uniquement les résultats techniques. Les scénarios utilisent des comptes et entreprises de validation dédiés, sans appel de modèle payant. Les captures et archives privées ne sont pas nécessaires au fonctionnement du site et ne sont pas publiées dans Git.

Le parcours principal réutilise `DiscoveryService`, `InterviewService`, `InterviewEngine` et les deux écrans guidés existants. Les nouvelles couches utilisent Convex, contrôlent organisations et rôles, conservent les verrous et refusent la réouverture après validation. Le questionnaire historique reste séparé du parcours principal.

## Reprise du travail

1. Consulter [le plan de migration](convex-migration.md), [Discovery](convex-discovery-migration.md) et [Interview](convex-interview-migration.md).
2. Continuer avec Knowledge, cartographie, analyse, opportunités, ROI puis Executive Result. Aucun de ces moteurs ne doit être présenté comme déjà raccordé à Convex.
3. Garder le mode pilote et les protections tenant jusqu’à la validation de tout le parcours. L’e-mail vérifié, la récupération de compte et les invitations restent à réaliser.
4. Réinstaller avec `npm ci` les dépendances des anciens dossiers de certification uniquement si l’on souhaite les réutiliser. Le nettoyage des caches ne remplace pas la validation d’une nouvelle version.

Les sources et dépendances du checkout de travail actif sont conservées. Les installations, caches npm et traces temporaires peuvent être recréés ; ils ne constituent pas une sauvegarde du projet.
