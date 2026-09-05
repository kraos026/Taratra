# Optivos — audit de reprise, 5 septembre 2026

## Mandat et limites

MISSION: reprendre, auditer et durcir la V1 sans réécrire le moteur validé.
AFFECTED DOMAIN: authentification, certification, lectures exécutives, onboarding, exploitation.
CANONICAL OWNER: les modules existants Discovery → Executive Result restent propriétaires.
CURRENT STATUS: moteur CANONICAL; Brain/Kimi SHADOW; Generator PARTIAL; Runtime FUTURE.
FILES EXPECTED: tests/scripts de certification, callback/proxy Auth, Next config,
présentations d'entrée et Discovery, lectures exécutives; documentation associée.
DB IMPACT: inspection distante uniquement; fixtures locales; aucune migration distante autorisée.
SECURITY IMPACT: retours Auth, garde de cible des tests, RLS, erreurs, en-têtes.
TEST PLAN: régression ciblée, Vitest, lint/typecheck/build/format, pgTAP, navigateur,
parcours canonique local puis Preview au SHA propre.
OUT-OF-SCOPE: DNS, rotation de credentials, écriture Production, refonte des formules,
promotion de Brain/Kimi, réalisation d'un runtime V2.

Source examinée: `ea7e81a247881f6e457f0b148e1aabca84e7a7b3`.
Branche de travail créée: `audit/optivos-v1-hardening-20260905`.
Les éléments préexistants `.vercel/`, `artifacts/` et
`scripts/run-brain-kimi-benchmark.mjs` sont exclus des commits.

Ce rapport est le premier état avant implémentation, pas une certification finale.
PROVEN signifie constat source/test/SQL; LIKELY signifie hypothèse à reproduire.
Une inspection statique ne prouve pas chaque combinaison de données/concurrence.

## Carte du système

| Couche                                                                   | Réalité observée                                                                                            | Classe                                          |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------- |
| Next.js 16 / React 19                                                    | App Router, shell client, pages et API serveur                                                              | SUPPORTED                                       |
| Auth / organisations / entreprises                                       | Supabase Auth, membership SQL, rôle PostgreSQL `authenticated` dans chaque transaction                      | CANONICAL                                       |
| Discovery / Interview / Knowledge                                        | réponses versionnées, verrou optimiste, validation, preuves                                                 | CANONICAL                                       |
| Process Mapping / Analysis / AI Opportunities / Automation Opportunities | règles déterministes, catalogues, génération et publication versionnées                                     | CANONICAL                                       |
| ROI / Portfolio / Blueprint / Specification                              | hypothèses, métriques, validations, références parentales                                                   | CANONICAL                                       |
| Executive Result / Decision Center                                       | projections à la lecture, pas une table de résultats exécutifs persistés                                    | CANONICAL                                       |
| Pilot Feedback                                                           | avis utilisateur/entreprise/audit, récupération pré-audit, attachement à la sauvegarde                      | SUPPORTED                                       |
| company-intake / work-intelligence                                       | mix de projections de production et contrats avancés; vérifier chaque point d'entrée, pas promotion globale | SUPPORTED / PARTIAL                             |
| questionnaires / règles / ancien ROI / reports                           | fondations historiques encore référencées par les audits; pages secondaires accessibles                     | LEGACY, à isoler sans supprimer les dépendances |
| `src/brain-evaluation`                                                   | benchmarks, adapters Kimi et gates déterministes; aucune importation applicative identifiée par le scan     | SHADOW                                          |
| Automation Generator                                                     | domaine, idempotence, outbox et repository; `DefaultGenerationCompiler` lève explicitement NotImplemented   | PARTIAL / KEEP_HIDDEN                           |
| Agents / n8n / Make / Runtime / Monitoring / Optimization                | architecture cible, aucune chaîne d'exécution client certifiée                                              | FUTURE                                          |

Navigation V1: Connexion → espace → entreprise → audit → compréhension → entretien →
générations/validations → opportunités → ROI → plan → décisions/résultats.
Ne pas présenter une estimation comme une économie réalisée ni un blueprint comme un workflow déployé.

Inventaire fonctionnel des routes: `/login`, `/signup`, `/onboarding`, `/auth/*`, `/`,
`/companies` et création/édition/détail, `/companies/[id]/discovery`, `/interview`,
`/automation-audit` et sous-vues résultats/décisions/ROI, `/process-maps/[id]`,
`/analysis/[id]`, `/ai-opportunities/[id]`, `/automation-opportunities/[id]`, `/roi/[id]`,
`/recommendations` et détail, `/solution-blueprints/[id]`. Surfaces historiques:
`/audits` et détails/questionnaire/report/summary/new, `/questionnaires` et versions,
`/reports`, `/settings`. Les API suivent ces ressources avec commandes explicites
generate/build, validate, publish, rebuild, archive; feedback et evidence ont leurs API dédiées.
Les routes Specification sont API-only. Aucune route d'exécution publique identifiée.

## Preuves de référence

- Vitest initial: **174 fichiers / 1055 tests PASS**.
- Canonical local, run `run-20260905051400-dfd487da`: toutes les 12 étapes PASS,
  4 recommandations, Executive Result READY, `complete=true`, relecture PASS.
- Entreprise de ce run: `04836b27-1a8a-44dd-b2d9-ced75fd73358` (locale uniquement).
- Docker initialement indisponible; lancé sans reset, moteur 29.6.2 joignable.
- Staging `ajvncwsazrhqjlktzojm` et Production `mekihopfrfmqnhmtktgr`:
  24 migrations, dont feedback, 124 tables public, toutes avec RLS activée.
- Production ACTIVE_HEALTHY, PostgreSQL 17, région eu-west-1.
- Production Vercel `dpl_FnH6SGcrP6oNhaiAam4RvVF7oFM2`: READY, SHA ea7e81a,
  cible production, région iad1. Aucun nouveau déploiement Production.
- DNS lu: `optivos.vip` A `185.53.179.128`; pas de CNAME www retourné.
- Navigateur local: connexion A réussie; audit du nouveau run terminé;
  lien final encore `View recommendations`; inscription blanche/contraste faible.
- La présence historique de PASS ne vaut pas test actuel de toute la Production.

## Constats priorisés avant correction

| ID / priorité            | Preuve et cause                                                                                                                                       | Impact                                                                              | Correction prévue / risque                                                                            |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| SEC-01 P1 PROVEN         | `src/app/auth/callback/route.ts`: garde startsWith('/') accepte `/\\example.org`; `new URL` retourne un domaine externe                               | redirection ouverte après échange de code                                           | normaliser et vérifier même origine, tests attaques; faible                                           |
| SEC-02 P1 PROVEN         | `playwright.config.ts` et support/env classent tout `.vercel.app` comme Preview, y compris la Production observée                                     | tests créant des données exécutables sur une mauvaise cible                         | garde explicite environnement + projet staging + déploiement vérifié; faible/moyen                    |
| SEC-03 P1 PROVEN         | SQL Production: 3 sessions Auth orphelines, 0 identities/memberships orphelins, 0 organisation sans owner                                             | résidu d'anciens comptes de contrôle; révocation non démontrée                      | revue/révocation via Auth, autorisation Production séparée; aucun DELETE automatique                  |
| SEC-04 P1 HISTORICAL     | ancien contrôle a exposé un objet Vercel contenant des champs protectionBypass; aucune valeur reproduite ici                                          | secret de protection de déploiement potentiellement divulgué                        | rotation à autoriser, revue des journaux; ne pas prétendre «aucun secret imprimé» pour l'historique   |
| REL-01 P1 PROVEN         | `waitForAppReadiness` compte les résultats même si le dernier check échoue                                                                            | faux PASS de disponibilité                                                          | exiger tous les codes/types attendus; tests dernier check; faible                                     |
| REL-02 P1 PROVEN         | canonical runner `countsFor` compte toute la table; `assertTenantBIsolation` utilise un filtre SQL privilégié et pas une session B                    | artefacts historiques masquant un manque; fausse preuve RLS                         | compter par lineage et authentifier B; faible/moyen                                                   |
| UX-01 P1 PROVEN          | Discovery `validate()` appelle `save()` puis validation sans contrôler son résultat; statut local non remplacé après validation                       | validation de données anciennes, retour visuel trompeur, prochaine étape peu claire | séquence save réussi → validate → état relu/navigation; tests réseau/409; moyen                       |
| REL-03 P1 PROVEN         | Executive repository `.get(...).catch(() => null)`                                                                                                    | timeout/erreur DB masqué comme résultat absent                                      | ne convertir que le 404 métier; laisser remonter les erreurs; faible                                  |
| API-01 P2 PROVEN         | Decision Center renvoie UNAVAILABLE/200 pour entreprise hors scope; `id` non validé                                                                   | contrat 404 incohérent; pas de fuite A observée                                     | distinguer entreprise inaccessible de preuves manquantes; tests 401/404/400; faible                   |
| SEC-05 P2 PROVEN         | Next config sans politique d'en-têtes explicite                                                                                                       | protection clickjacking/MIME/referrer non garantie par source                       | en-têtes statiques compatibles, CSP progressive sans casser hydration; faible/moyen                   |
| UX-02 P2 PROVEN          | signup et onboarding `bg-neutral-50`, champs sans label explicite; erreurs Auth anglaises; absence de catch réseau                                    | expérience d'entrée incomplète, états bloqués                                       | réutiliser AuthShell, français, labels, récupération réseau; faible                                   |
| UX-03 P2 PROVEN          | pas de `error.tsx`/`global-error.tsx`; pages secondaires et Interview termes internes                                                                 | erreur générique et incohérences de navigation                                      | états d'erreur utiles et textes V1, sans inventer résultat; faible                                    |
| SEC-06 P2 PROVEN         | proxy perd les cookies rafraîchis lorsqu'il construit une nouvelle redirection; query membership sans filtre user explicite                           | fragilité de session; intention de contexte ambiguë                                 | transférer les cookies, filtre user; régression; faible                                               |
| REL-04 P2 PROVEN         | scripts `db:certification`/pilot invoquent `prisma migrate status`                                                                                    | divergence avec autorité Supabase                                                   | comparaison de l'historique Supabase, pas migration Prisma; faible                                    |
| PERF-01 P2 PROVEN/LIKELY | Vercel iad1 vs DB eu-west-1; tx locales 5/10s; hydratations parfois regroupées                                                                        | latence intercontinentale probable; impact exact à mesurer                          | région Preview proche DB et mesures, aucune hausse timeout globale; moyen                             |
| PERF-02 P2 PROVEN        | advisors Production: 215 FK sans index couvrant, 93 politiques permissives multiples, 34 index inutilisés                                             | coût potentiel à volume; pas preuve de lenteur pour chaque alerte                   | EXPLAIN/charge représentative avant index, ne pas supprimer index sur base vide; moyen                |
| SEC-07 P2 PROVEN         | `npm audit --omit=dev`: 8 high, dont Playwright, Prisma config/mysql2, nanoid/fast-uri                                                                | supply chain/build à qualifier, aucune exploitation HTTP démontrée                  | mises à jour ciblées, pas downgrade automatique Prisma; moyen                                         |
| REL-05 P2 LIKELY         | feedback find-then-create + index unique partiel sans sérialisation                                                                                   | deux envois concurrents peuvent donner 500 sans doublon                             | reproduire concurrence puis garde locale de sauvegarde; moyen                                         |
| UX-04 P2 PROVEN          | questionnaires accessible sans redirection Auth dans navigateur; shell vide, API protégées                                                            | ancienne surface publique confuse, pas fuite de lignes prouvée                      | protéger toutes les pages applicatives et isoler legacy; faible                                       |
| COMM-01 P2 PROVEN        | aucune récupération de mot de passe dans les routes; pages publiques d'entrée limitées; feedback oui mais pas parcours achat/export exécutif certifié | V1 payante self-service non prête                                                   | récupération Auth et entrée cohérente d'abord; tarification/support/export à cadrer, pas faux boutons |
| OPS-01 P1 PROVEN         | DNS parking; SSL custom-domain non certifié; incidents/rollback non exercés cette mission                                                             | pas de lancement public autorisé                                                    | gate DNS/SSL/rollback séparé après Preview; aucun changement automatique                              |
| DOC-01 P3 PROVEN         | README/PROJECT_STATE historiques décrivent CRM et futures fonctionnalités déjà existantes                                                             | confusion de maintenance et de vente                                                | index de vérité daté; conserver l'historique marqué; faible                                           |
| PERF-03 P3 PROVEN        | avertissement pg client.query concurrent dans le runner canonical                                                                                     | incompatibilité future pg9; pas échec actuel                                        | séquencer les queries sur client unique du harness; faible                                            |
| SEC-08 P2 PROVEN         | protection Supabase mots de passe divulgués désactivée dans les deux projets                                                                          | contrôle Auth additionnel manquant                                                  | configuration distante revue séparément; pas rotation implicite                                       |

P0: aucune fuite inter-tenant ou perte client directement démontrée dans ce premier audit.
Cela ne constitue pas une certification exhaustive d'absence de faille.

## Contrôles positifs et réserves

- SQL brut applicatif identifié: paramètres Prisma; `SET LOCAL ROLE authenticated` est constant,
  pas une injection de nom de rôle utilisateur.
- `create_first_organization`: anon/PUBLIC sans EXECUTE, authenticated intentionnel;
  auth.uid non nul, search_path vide, advisory lock, membership existant interdit.
  Ne pas la transformer en SECURITY INVOKER sans préserver le bootstrap.
- Feedback: index uniques empêchent les doublons persistés; lecture ne lazy-attache pas,
  la sauvegarde attache. Une concurrence reste à tester.
- Les lectures ROI sont réparties en transactions authentifiées courtes; aucun accès
  privilégié hors RLS ne sera introduit sous prétexte d'optimisation.
- Migration et Prisma: modèle applicatif présent; contrôle complet colonnes/contraintes
  et application fraîche des 24 migrations encore à exécuter sur DB jetable.
- Publication, lockVersion et provenance ont des tests métier; les tests mockés ne suffisent
  pas à prouver une charge concurrente distante.
- RLS activée partout n'est pas synonyme de politique correcte: pgTAP et matrice API requis.
- Auth abuse/rate-limit, CSRF, rétention des logs, backups et récupération restent des
  contrôles d'exploitation à compléter; ne pas inventer des garanties commerciales.

## Plan d'exécution borné

### Avant pilote

1. Corriger callback/proxy, erreurs exécutives et preuve de cible des tests.
2. Corriger fausses assertions, migration guard et couverture B réelle.
3. Stabiliser Discovery save/validate, entrée Auth et messages d'erreur V1.
4. Ajouter les en-têtes de sécurité compatibles et tester le navigateur.
5. Tester feedback concurrent; corriger uniquement si reproduit.
6. Local jetable migrations/RLS/canonical/négatifs, SHA propre puis Preview certifiée.
7. Signaler sessions/credentials Production pour autorisation séparée; DNS non touché.

### Avant V1 payante

- Accès et récupération de compte autonomes, support réel et responsable identifié.
- Contrat commercial/prix/conditions/confidentialité validés par le propriétaire;
  pas de promesse de conformité ni de support fictif.
- Export exploitable du résultat et partage contrôlé à spécifier avec retours pilotes.
- Backup/restore exercé, alertes et procédure d'incident, revue sécurité indépendante.
- Mesure du temps jusqu'à la première recommandation sur des entreprises réelles,
  coût support et volonté de payer via feedback, pas métriques synthétiques de vente.

### Soon / V1.5 / V2 / Drop

- Soon: index guidés par EXPLAIN, pagination dashboard, matrice de concurrence étendue,
  accessibilité clavier/lecteur, documentation d'exploitation à jour.
- V1.5: durcir Specification → contrat de Harness, dry-run et export workflow seulement
  après validation des permissions, approvals, erreurs et idempotence.
- V2: compilateurs n8n/Make, sandbox, déploiement contrôlé, runtime, monitoring,
  ROI observé et boucle d'optimisation; agents spécialisés derrière les mêmes gates.
- KEEP_HIDDEN: Generator incomplet, Brain/Kimi shadow, intégrations non fonctionnelles.
- DROP: CRM/ERP générique, clone n8n, graphiques à faux chiffres, promotion LLM en vérité,
  contrôle d'exécution sans autorité humaine.

## Gate actuel

**FIX_FIRST — ni Production ni V1 payante certifiées par cet audit initial.**
Le succès canonique local est acquis sur le scénario nommé; les corrections et la
certification de la nouvelle release restent à effectuer. Les décisions de rotation,
nettoyage Production et DNS seront présentées explicitement, sans action cachée.
