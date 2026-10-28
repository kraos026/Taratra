# Audit sur Convex — lot de migration

MISSION: raccorder les audits, leurs questionnaires et réponses au pilote Convex existant.
AFFECTED DOMAIN: persistance Audit/Questionnaire et interface du pilote.
CANONICAL OWNER: `AuditService`, `validateAnswer`, `calculateProgress` et `evaluateCompletion` ; aucun nouveau moteur de calcul.
CURRENT STATUS: PARTIAL — le pilote Auth/Organization/Company fonctionne ; ce lot prépare le questionnaire et le cycle d’audit. Discovery, les opportunités et le ROI restent à raccorder.
FILES EXPECTED: contrat de repository, adaptateur Convex, catalogue issu de la migration SQL, fonctions protégées, interface et tests.
DB IMPACT: ajout de documents dans les tables Convex existantes et d’une trace d’installation du catalogue ; aucune suppression.
SECURITY IMPACT: traduire les contrôles des triggers SQL (entreprise/organisation, questionnaire publié et accessible, questions de la bonne version, audit verrouillé) en contrôles serveur.
TEST PLAN: mêmes validations et progression que le canonique, cycle réel, persistance, permissions, refus des références croisées, verrouillage après validation.
OUT-OF-SCOPE: réécriture des moteurs, faux résultats, import de comptes de test, dépenses de modèles, arrêt ou suppression de la source.

TARGET: `beaming-ermine-530`, développement, et Preview `codex/optivos-hermes-ui`.
PRODUCTION?: non.
DISPOSABLE?: non ; les espaces déjà créés sont conservés.
BACKUP?: export privé de la cible avant installation du catalogue.
MIGRATION REQUIRED?: oui ; catalogue et accès à adapter, pas de changement du calcul de progression.
RLS IMPACT?: chaque fonction utilise l’identité vérifiée, l’adhésion et le rôle ; les identifiants client n’octroient pas d’accès.
TENANT IMPACT?: chaque audit et réponse garde son organisation et sa lignée entreprise/questionnaire.
ROLLBACK PLAN?: conserver le code et les données existants ; ne retirer aucun objet pour revenir au commit précédent. Le nouveau parcours n’écrit pas dans Supabase.

Le catalogue fourni par le dépôt contient dix sections et un questionnaire système publié par la migration `20260722064705_add_audit_questionnaire.sql`. Sa copie vers Convex conserve textes, codes, options, contraintes et identifiants explicites. Les UUID des questions, auparavant générés au moment de l’installation PostgreSQL, sont déterministes pour cette nouvelle installation. Aucun audit ni réponse n’est fabriqué par l’installateur.

## Réalisation du lot

`AuditService` utilise désormais un contrat de repository, avec les mêmes DTO et aucune modification de ses décisions ni des fonctions de progression. L’adaptateur Prisma implémente ce contrat ; l’adaptateur Convex reprend les contrôles d’organisation, publication, version des questions et rôle. Les DTO de compatibilité importent encore les types Prisma exclusivement au typecheck ; aucune connexion Prisma n’est chargée dans les fonctions Convex.

Les opérations Convex sont atomiques. L’enregistrement d’une réponse et le recalcul de progression sont dans la même mutation ; une réponse invalide ou une référence étrangère ne laisse pas d’écriture partielle. Un audit validé ne peut pas être rouvert par l’appel de clôture ; un questionnaire vide ne permet pas de terminer un audit. Ces refus protègent le verrouillage et empêchent un faux audit terminé, même via un appel direct. Les listes ont des limites explicites de pilote (1 000 audits/réponses, 100 sections, 200 questions par section) et échouent plutôt que tronquer silencieusement les calculs.

Le catalogue est généré par `node scripts/convex-migration/audit-catalogue.mjs --generate`. Son installateur `auditCatalogue:install` est une mutation interne, jamais une fonction publique de gestion de questionnaires. Il conserve la provenance SHA-256, refuse les collisions et ne réécrit pas un catalogue publié. La trace d’installation est dans `catalogInstallations`.

La cible a été exportée avec fichiers avant l’installation, dans une sauvegarde privée hors dépôt. L’installation réelle a ajouté 10 sections et 24 questions, aucune réponse. Les espaces existants n’ont pas été réinitialisés.

Dans `/convex-pilot`, ouvrir « Voir les audits » sur une entreprise active, choisir le questionnaire publié puis « Commencer l’audit ». La route `/convex-pilot/audits/[id]` permet de reprendre par lien direct et après connexion. Les champs sont enregistrés explicitement ; changer de section est bloqué tant que les modifications ne sont pas enregistrées ou annulées. Un champ numérique vide n’est pas converti en zéro. Le résumé présente les réponses réellement stockées. La validation demande confirmation et met le questionnaire en lecture seule.

## Validation et limites

211 tests ciblés passent, avec TypeScript et lint ciblé. Les nouveaux tests couvrent le catalogue fidèle à la source, l’absence de réponses fabriquées, les valeurs invalides, la progression canonique, la clôture incomplète, le verrouillage, les rôles, les entreprises étrangères et les questions/sections provenant d’une autre version privée. La recette distante doit être attachée au commit publié ; ces tests en mémoire ne constituent pas à eux seuls une certification du staging.

Le questionnaire SQL initial est un catalogue de démonstration du dépôt, maintenant utilisable avec les réponses réelles du pilote ; il n’est pas une méthodologie nouvellement certifiée. Ce lot n’évalue aucune règle, ne produit aucune opportunité, n’invente aucun gain et ne calcule pas encore le ROI sur Convex. Les moteurs correspondants restent canoniques et leur raccordement constitue le lot suivant. Le site historique et ses routes ne sont pas basculés globalement par cette entrée pilote.
