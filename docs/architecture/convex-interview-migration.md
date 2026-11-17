# Migration de l’entretien adaptatif

MISSION: raccorder Interview après une Discovery validée, sans remplacer son moteur.
AFFECTED DOMAIN: catalogue, sessions, réponses, décisions, progression et interface d’entretien.
CANONICAL OWNER: `InterviewService`, `InterviewEngine` et schémas/provenance existants.
CURRENT STATUS: PARTIAL ; Discovery est opérationnel, les moteurs Knowledge → Executive Result restent à raccorder.
FILES EXPECTED: contrat de repository, adaptateur Convex, catalogue issu du SQL, transport optionnel du wizard et tests.
DB IMPACT: nouvelles questions système et métadonnées, écritures dans les tables de sessions existantes.
SECURITY IMPACT: organisation, rôle, lignée Discovery/entreprise, verrou optimiste et validation définitive.
TEST PLAN: conditions adaptatives, réponses invalides, confiance, questions retirées, verrouillage, reprise et isolation tenant.
OUT-OF-SCOPE: faux résultats, modification du moteur de décision, activation d’un modèle payant ou bascule Production.

TARGET: `beaming-ermine-530`, Preview de la branche dédiée.
PRODUCTION?: non.
DISPOSABLE?: non.
BACKUP?: export privé de la cible avant installation du catalogue.
MIGRATION REQUIRED?: adaptation du stockage et du transport, moteur inchangé.
RLS IMPACT?: contrôles serveur dans chaque opération.
TENANT IMPACT?: sessions, réponses et décisions restent rattachées à la même organisation et entreprise.
ROLLBACK PLAN?: aucun effacement de source ou des sessions existantes ; revenir au code précédent sans reset.

## Réalisation

Le catalogue de 20 questions est généré depuis `20260726042817_add_adaptive_interview_engine.sql`, avec les mêmes codes, conditions, poids, options et contraintes. L’installation est interne, idempotente et tracée par SHA-256 ; elle refuse les collisions et ne crée aucune réponse. Une nouvelle sauvegarde privée de la cible précède son installation réelle.

`InterviewService` et `InterviewEngine` conservent leurs décisions ; seul le contrat de repository est extrait. La persistance d’une réponse, la décision associée, le retrait des réponses devenues inéligibles et le stockage de progression sont atomiques sur Convex. Les tableaux de progression conservent les précisions NUMERIC de la source sous forme de chaînes. Les questions et les faits proviennent du système ou de l’organisation authentifiée. Le démarrage exige une Discovery validée de la même entreprise et un catalogue non vide.

Le verrou optimiste protège les révisions. La complétion et la validation ne rouvrent pas un entretien déjà validé. Les sources documentaires gardent le schéma existant et la mention serveur `USER_REVIEWED_NOT_AUTHENTICATED` : une relecture utilisateur ne devient pas une vérification indépendante. La confiance est calculée par le moteur existant, sans appel de modèle.

Le wizard existant reçoit un transport optionnel, sa configuration historique restant inchangée. Dans le pilote, la validation de Discovery ouvre `/convex-pilot/companies/[id]/interview`. Après validation de l’entretien, aucun lien ne conduit encore aux moteurs aval non migrés. Knowledge, cartographie, opportunités, ROI et Executive Result restent des lots distincts.

317 tests ciblés passent : branche sectorielle, branche activée par réponse, retrait des réponses devenues inapplicables, provenance, confiance, conflit atomique, cycle complet et droits. Ces tests incluent les suites existantes des services et du moteur. La recette distante et navigateur doit ensuite porter sur le commit publié.

Le backend passe 18 contrôles HTTP réels sur une entreprise de recette déjà dotée d’une Discovery validée : catalogue réel sans réponses fabriquées, démarrage idempotent, installateur non public, refus de complétion prématurée, branche conditionnelle et retrait des réponses inapplicables, conflit de révision, provenance documentaire, effet de l’incertitude sur la confiance, refus inter-organisations, préparation réelle, complétion, validation, verrouillage, reconnexion et refus anonyme. La recette navigateur reste une preuve distincte.
