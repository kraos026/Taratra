# AUTOMATEX_MASTER / OPTIVOS

Dernière reconstruction forensique : 2026-09-09 (Europe/Moscow).

Ce document est la mémoire canonique de reprise du produit. Les mentions `PROVEN`, `INFERRED` et
`UNKNOWN` distinguent respectivement ce qui est observé directement, ce qui est fortement déduit et
ce qui ne peut pas être établi avec les preuves disponibles. Un PASS historique ne vaut pas
certification du worktree sale actuel.

## 1. Identité du projet

- **PROVEN — dépôt et architecture historique :** le dépôt, les packages et une grande partie de la
  documentation utilisent encore le nom **AutomateX / AUTOMATEX**.
- **PROVEN — identité produit affichée :** les surfaces produit récentes affichent **Optivos** et
  remplacent explicitement certaines chaînes `AutomateX` par `Optivos` dans les présentateurs.
- **Décision canonique de reprise :** **AUTOMATEX et OPTIVOS sont le même projet.** OPTIVOS est
  l'évolution et l'identité produit d'AUTOMATEX_MASTER, jamais un projet ou un moteur séparé.
- La question produit historique reste : « What should I automate first? ». Le principe de
  gouvernance reste : **AI explains. Rule engines decide. User validates.**

## 2. Repository canonique

- **PROVEN — chemin de travail :**
  `C:\Users\Admin\Documents\rsume film\automatEx-clean-certification`
- **PROVEN — branche :** `audit/optivos-v1-hardening-20260905`
- **PROVEN — HEAD :** `d9bfb1d4cefafd9457f7ef9af2372cff64d9a449`
- **PROVEN — HEAD court / sujet :** `d9bfb1d` — `fix: harden executive output and canonical status`
- **PROVEN — remote :** `origin = https://github.com/kraos026/Taratra.git`
- **PROVEN — upstream de la branche courante :** aucun upstream affiché par `git branch -vv`.
- **PROVEN — stockage Git commun :**
  `C:\Users\Admin\Documents\rsume film\automatEx\.git`
- **PROVEN — gitdir de ce worktree :**
  `C:\Users\Admin\Documents\rsume film\automatEx\.git\worktrees\automatEx-clean-certification`
- Le nom est affiché avec une casse normalisée différente par Windows (`automatex-...`), sans
  différence de chemin sur ce volume insensible à la casse.

## 3. Objectif produit actuel

Le produit V1 guide une PME depuis l'authentification et la description de son entreprise jusqu'à
des décisions exécutives traçables sur ce qu'il faut corriger, investiguer, automatiser ou ne pas
automatiser. Les décisions canoniques restent déterministes et doivent être liées aux preuves,
versions publiées, prérequis et hypothèses ROI. Le texte génératif ou le Brain SHADOW ne doit pas
devenir l'autorité de publication.

**PROVEN — objectif du dernier chantier :** empêcher une projection exécutive d'hériter de preuves,
d'un ROI ou de prérequis appartenant à une autre opportunité, et bloquer les recommandations lorsque
les preuves sont manquantes, supposées, inférées, contradictoires ou lorsque des prérequis restent
non résolus.

## 4. Architecture actuelle

### Chaîne canonique

`Auth → Organization/Tenant → Company → Audit → Discovery → Interview → Enterprise Knowledge →
Process Map → Business Analysis → AI Opportunities → Automation Opportunities → ROI Evaluation →
Recommendation Portfolio → Solution Blueprint → Automation Specification → Executive Result /
Decision Center`

- **PROVEN :** application Next.js App Router, React, TypeScript, modules sous `src/modules`, routes
  UI/API sous `src/app`.
- **PROVEN :** PostgreSQL/Supabase est la persistance; les migrations Supabase sont l'autorité du
  schéma. Prisma est le client/mapping serveur et utilise une transaction avec identité tenant/RLS.
- **PROVEN :** les moteurs de domaine calculent; les services choisissent les parents, autorisent et
  valident les transitions; les repositories persistent des snapshots versionnés et leur lignée.
- **PROVEN :** Executive Result est une projection de lecture assemblée depuis les artefacts publiés,
  pas une table autonome de résultats exécutifs.
- **PROVEN :** le dépôt contient également des modules historiques (`rules`, ancien `roi`,
  `recommendations`, `reports`, `questionnaires`) qui restent présents pour compatibilité.
- **PROVEN :** Brain/Kimi se trouve sous `src/brain-evaluation` et reste SHADOW/EXPÉRIMENTAL.
- **PROVEN :** Automation Generator possède domaine/application/infrastructure, mais le compilateur
  réel et l'interface publique restent partiels. Runtime, déploiement métier, monitoring,
  optimisation et agents ne sont pas un chemin produit canonique certifié.

## 5. Fonctionnalités réellement terminées

Dans cette section, « terminée » signifie prouvée dans le code et par des preuves historiques
identifiées; cela ne signifie pas « production certifiée au HEAD sale actuel ».

- **PROVEN — ACTIVE/CANONICAL :** Auth, organisations/tenants, entreprises et audit.
- **PROVEN — ACTIVE/CANONICAL :** chaîne Discovery, Interview, Knowledge, Process Map, Business
  Analysis, AI Opportunities déterministes, Automation Opportunities, ROI, Recommendation
  Portfolio, Solution Blueprint, Automation Specification et projections Executive Result /
  Decision Center.
- **PROVEN — ACTIVE :** RLS multi-tenant, transactions Prisma authentifiées, snapshots versionnés,
  publication/validation et lignée parentale sont implémentés dans les migrations et modules.
- **PROVEN — ACTIVE :** feedback pilote avec migration `20260903090000_add_pilot_feedback.sql`.
- **PROVEN — historique au SHA `0762132` :** base locale jetable reconstruite avec 24/24 migrations,
  18 fichiers pgTAP / 237 tests PASS, Prisma validate/generate PASS, build PASS, parcours canonique
  complet PASS, isolation Tenant B PASS, Playwright pilote 25/25 PASS.
- **PROVEN — historique au SHA `4704089` :** Preview READY et navigation publiée vérifiée en lecture à
  390/820/1440 px, avec isolation de lecture Tenant B sur le scénario documenté.
- **PROVEN — avant le patch de sûreté non commité :** artefact Vitest
  `artifacts/v1-output-status-tests.json`, 398 suites / 1165 tests PASS. L'artefact ne porte pas un
  SHA, donc il ne prouve pas à lui seul un clean-SHA certifié.

## 6. Fonctionnalités partielles

- **PARTIAL — sûreté décisionnelle par opportunité :** code et benchmark présents dans le worktree,
  mais source non suivie, patch non commité et 2 régressions ciblées encore rouges.
- **PARTIAL — Executive completeness :** la projection actuelle distingue des états de décision,
  mais le drapeau de complétude ne signifie pas nécessairement que les 12 étapes, notamment
  Blueprint/Specification, sont publiées.
- **PARTIAL — qualité de preuve de bout en bout :** le patch transporte une qualité
  `SUPPORTED/INFERRED/ASSUMED/MISSING/CONTRADICTORY`, mais sa dérivation depuis les enregistrements
  persistés utilise encore des conventions d'`evidenceType`; aucune migration ne matérialise un
  nouveau contrat dédié.
- **PARTIAL — prérequis opérationnels :** la présence d'un connecteur dans un catalogue ne prouve ni
  connexion active ni permission. Le patch utilise `null` pour les contrôles à vérifier et ajoute
  une validation humaine heuristique pour certains domaines sensibles.
- **PARTIAL — Automation Generator :** internals présents; compilateur réel, REST, sandbox et
  livraison publique non terminés.
- **SHADOW — Brain/Kimi :** benchmark et garde déterministe présents; `promotionEligible=false` dans
  l'artefact synthétique. Aucun droit de publication canonique.
- **PARTIAL/FUTURE :** runtime, déploiement d'automatisations, monitoring et optimisation.
- **UNKNOWN :** état commercial complet de la V1 payante (récupération autonome, support, prix,
  export et procédures d'exploitation) non certifié.

## 7. Travail non commité actuel

### État exact avant la création de ce HANDOFF

- 4 fichiers suivis modifiés, 0 fichier indexé, 562 fichiers non suivis, soit 566 chemins sales.
- Diff suivi : 131 insertions, 36 suppressions.
- Répartition non suivie : `.vercel/` 2, `artifacts/` 557, `scripts/` 1, `src/` 2.

### Fichiers suivis modifiés

| Fichier | Changement / fonctionnalité | Intention | Complétude |
| --- | --- | --- | --- |
| `scripts/run-canonical-certification.mjs` | Chronométrage mural des 12 étapes, sortie JSON dans `artifacts/`, signalement >5 s, option `--trace-pg` | **PROVEN volontaire** : un artefact de timings a été produit | **PARTIAL comme livraison** : distinct du patch décisionnel, non commité et sans test/documentation de clôture |
| `src/modules/company-intake/application/production-executive-decision-view.ts` | Applique le filtre de sûreté par opportunité, ROI lié par `automationOpportunityId`, contradictions, remédiations et actions | **PROVEN volontaire** : répond directement aux P0 du dernier audit | **PARTIAL** : deux tests existants échouent encore |
| `src/modules/executive-results/application/executive-result-model.ts` | Ajoute le contrat de qualité de preuve, observations/prérequis et lien ROI→opportunité | **PROVEN volontaire** | **PARTIAL** : contrat non commité, pas de certification complète actuelle |
| `src/modules/executive-results/infrastructure/prisma-executive-result-repository.ts` | Hydrate preuves, faits, connecteurs, règles et prérequis tenant/company/opportunity-scoped | **PROVEN volontaire** | **PARTIAL** : pas de preuve E2E persistée du patch actuel; permissions/connexion réelles non prouvées |

### Fichiers non suivis hors artefacts

| Fichier | Nature | Relation au dernier travail | État |
| --- | --- | --- | --- |
| `src/modules/executive-results/application/opportunity-decision-safety.ts` | Nouveau filtre déterministe de sûreté | Cœur du chantier actuel | **PARTIAL / requis**, non suivi |
| `src/modules/company-intake/decision-safety-benchmark.test.ts` | 20 cas synthétiques de décisions sûres/contradictoires/ROI/prérequis/lignée | Benchmark direct du chantier actuel | **PROVEN 20/20 PASS**, mais insuffisant pour clôturer le patch |
| `scripts/run-brain-kimi-benchmark.mjs` | Runner live Kimi avec checkpoint | Travail antérieur Brain SHADOW, daté du 27 août | **EXPÉRIMENTAL**, sans rapport direct avec le patch V1 courant |
| `.vercel/project.json` | Lien local vers le projet Vercel nommé `taratra` | Métadonnée d'exploitation locale | **Volontaire probable**, à ne pas committer sans décision explicite |
| `.vercel/README.txt` | Documentation générée du lien Vercel | Métadonnée d'exploitation locale | **Volontaire probable**, à conserver localement |

### Artefacts non suivis

Les 557 artefacts sont des preuves générées, scripts de contrôle et captures, pas 557 changements
fonctionnels indépendants. Ils étaient tous présents avant cette mission.

| Groupe | Nombre | Nature principale |
| --- | ---: | --- |
| racine `artifacts/` | 26 | résultats décisionnels avant/après, tests, timings, scripts et captures Preview/navigation |
| `brain-benchmark/` | 29 | cas, résumé, checkpoint et résultats Brain/Kimi SHADOW |
| `optivos-company-audit-qa/` | 9 | captures entreprise/audit responsive |
| `optivos-downstream-p2028-fix/` | 7 | captures de vérification après incident P2028 |
| `optivos-downstream-ux-pass/` | 7 | captures UX downstream |
| `optivos-executive-frontend-qa/` | 69 | séries de captures Executive UI responsive |
| `optivos-frontend-final-qa/` | 22 | captures QA frontend finale historique |
| `optivos-frontend-reset-qa/` | 18 | captures de reprise/reset UI historique |
| `optivos-opportunities-qa/` | 3 | captures opportunités responsive |
| `optivos-presentation/` | 4 | captures présentation/login/overview |
| `optivos-visual-qa/` | 72 | scripts, rapport et captures QA visuelle/Preview |
| `staging-pilot/` | 1 | runner staging canonique |
| `ux-reference-after/` | 101 | captures/textes/revue après passe UX |
| `ux-reference-before/` | 78 | captures/textes/revue avant passe UX |
| `ux-reference-final/` | 101 | captures/textes/revue finale UX |
| `visual-identity-final/` | 10 | captures d'identité visuelle Optivos |

Les artefacts racine les plus récents et directement liés au travail courant sont :

- `v1-output-status-tests.json` : 1165/1165 PASS avant le patch de sûreté courant;
- `v1-decision-safety-before.json` : 2/20 PASS;
- `v1-decision-safety-after.json` : 20/20 PASS;
- `v1-safety-targeted.json` : **40/42 PASS, 2 échecs**;
- `canonical-timings-run-20260908171025-13e181b7.json` : 12 mesures locales, aucune >5 s;
- les paires `decision-engine-*-baseline/after.json` et `decision-engine-full-tests.json` : preuves
  du durcissement commité précédent (`f526b09`), pas certification du patch sale actuel.

### Régressions actuellement prouvées

`artifacts/v1-safety-targeted.json` prouve deux échecs dans
`src/modules/company-intake/production-executive-decision-view.test.ts` :

1. le cas « medium finding requiring remediation » attend une complétude `YES`, reçoit `NO`;
2. le cas « medium opportunity without a fix-before decision » attend `AUTOMATE_NOW`, mais le
   nouveau filtrage fail-closed modifie ce résultat.

Ces échecs peuvent révéler un ancien test devenu incompatible ou un comportement produit incomplet;
la classification racine reste **UNKNOWN** tant que le contrat métier attendu n'est pas tranché.

## 8. Supabase

- **PROVEN — local :** `supabase/config.toml`, project id local `automatex`, API `55021`, PostgreSQL
  `55022`, shadow DB `55020`, PostgreSQL major 17.
- **PROVEN :** 24 fichiers SQL sous `supabase/migrations`; la dernière migration est le feedback
  pilote du 3 septembre 2026.
- **PROVEN :** `public` et `graphql_public` sont exposés; l'auto-exposition des nouveaux objets est
  laissée désactivée/non définie dans la configuration actuelle.
- **PROVEN :** migrations avec tables tenant-scoped, index, fonctions privées, triggers
  d'immutabilité/lignée, RLS et policies par rôle.
- **PROVEN :** `scripts/check-local-migrations.mjs` effectue une transaction `READ ONLY` et compare
  strictement versions, noms, migrations manquantes/supplémentaires/renommées.
- **PROVEN historique :** 24/24 migrations et 237 tests pgTAP PASS dans la base locale jetable au
  SHA `0762132`; 24/24 migrations également documentées lors de la certification locale du
  durcissement décisionnel précédent.
- **UNKNOWN actuel :** disponibilité de Docker/Supabase local et parité live au worktree sale non
  revérifiées pendant cette reconstruction.
- **UNKNOWN actuel :** état distant staging/production non interrogé pendant cette mission. Les
  documents du 5 septembre rapportent 24 migrations et 124 tables publiques avec RLS, mais cette
  information est historique.
- Aucun secret n'est reproduit ici. Ne jamais exposer de service-role, URL de connexion ou valeur
  d'environnement dans le HANDOFF ou les logs.

## 9. Vercel / déploiement

- **PROVEN :** `.vercel/project.json` relie localement le worktree au projet Vercel `taratra`.
- **PROVEN :** aucun `vercel.json` n'est présent; les réglages de projet sont principalement externes.
- **PROVEN historique :** Preview du SHA `4704089` documentée READY avec navigation publiée et
  contrôles de lecture/isolation ciblés.
- **PROVEN historique :** le rapport du 5 septembre identifie un déploiement Production READY au SHA
  `ea7e81a`; ce n'est pas une preuve du code actuel.
- **PROVEN :** aucun document ne prouve un déploiement de `d9bfb1d`, encore moins du worktree sale.
- **VERDICT : RED — NOT READY** pour une release du worktree actuel. Un worktree sale, des fichiers
  requis non suivis et 2 tests ciblés rouges interdisent toute Preview de certification ou Production.

## 10. Tests et certification

Scripts disponibles dans `package.json` : lint, format check, typecheck, Vitest, build, pgTAP/RLS,
certification DB, pilote E2E, certification locale et certification canonique.

- **PROVEN historique `0762132` :** 1119 tests Vitest, build, 237 pgTAP et 25 Playwright PASS; parcours
  canonique local et isolation Tenant B PASS.
- **PROVEN historique `f526b09` / audit du 8 septembre :** 1153/1153 Vitest PASS, lint/typecheck/build,
  24/24 migrations, parcours canonique local, isolation Tenant B et pilote 25/25 PASS.
- **PROVEN historique avant patch actuel :** 1165/1165 Vitest PASS dans l'artefact local.
- **PROVEN patch actuel :** benchmark nouveau 20/20 PASS.
- **PROVEN patch actuel :** sélection ciblée 40/42 PASS, donc statut global **FAIL**.
- **UNKNOWN patch actuel :** full Vitest, format, lint, typecheck, build, 24-migration parity, pgTAP,
  parcours canonique persistant, Playwright, Preview et staging exact-SHA n'ont pas de preuve finale.
- Les timings locaux enregistrés sont du wall-clock incluant API, validation, publication et
  relecture; ils ne sont pas une mesure de compute pur ou de latence Production.

## 11. Bugs / blockers

1. **BLOCKER PROVEN :** deux régressions de projection exécutive dans la suite ciblée actuelle.
2. **BLOCKER PROVEN :** le fichier cœur `opportunity-decision-safety.ts` est non suivi.
3. **BLOCKER PROVEN :** patch métier, instrumentation de certification et artefacts expérimentaux
   coexistent dans un même worktree sale.
4. **BLOCKER PROVEN :** aucune certification clean-SHA du patch actuel.
5. **PROVEN limitation :** connecteur catalogué ≠ connexion active/permission accordée.
6. **PROVEN limitation :** la sûreté dépend encore de conventions de qualité des preuves et de
   quelques heuristiques; elle n'est pas calibrée sur un benchmark métier représentatif.
7. **PROVEN limitation :** DO_NOT_AUTOMATE n'est pas encore prouvé de bout en bout jusqu'à
   l'éligibilité de Specification/déploiement.
8. **PROVEN limitation :** doublons sémantiques, ambiguïtés de dépendances, unités/fréquences et
   double comptage d'économies restent des travaux séparés documentés.
9. **KNOWN historique / UNKNOWN actuel :** avertissement de concurrence client `pg`; pas de requête
   échouée prouvée, mais compatibilité future à qualifier.
10. **UNKNOWN actuel :** vulnérabilités de dépendances et disponibilité Docker n'ont pas été
    réévaluées pour ce HANDOFF.

## 12. Décisions architecturales importantes

- Un moteur canonique ne doit pas être dupliqué sans décision d'architecture explicite.
- Les migrations Supabase possèdent l'évolution DB; Prisma ne possède pas les migrations.
- Les sorties publiées sont versionnées, immuables et reliées à leurs parents/catalogues.
- L'identité tenant/company doit être conservée dans toute lecture, écriture et preuve.
- Une projection exécutive doit échouer de façon fermée lorsque la lignée ou la preuve est invalide.
- Un ROI brut/positif ne justifie pas une automatisation si le ROI net est absent ou négatif.
- Un blueprint ou une specification décrit une solution; il ne prouve ni déploiement ni permission.
- Brain/Kimi reste SHADOW jusqu'à benchmark représentatif, provenance, sûreté tenant, override humain
  et certification répétable.
- Un PASS local n'implique ni Preview, ni staging, ni Production. GREEN exige un SHA propre et une
  preuve sur l'environnement cible.

## 13. Derniers commits significatifs

Les 30 derniers commits ont été inspectés; les plus significatifs pour la reprise sont :

| Commit | Date | Signification |
| --- | --- | --- |
| `d9bfb1d` | 2026-09-08 | durcissement des sorties exécutives et statuts canoniques |
| `f526b09` | 2026-09-08 | invariants des moteurs décisionnels, audit et certification locale |
| `d0760cc` | 2026-09-08 | raffinement UX du cœur d'audit Optivos |
| `9475830` | 2026-09-06 | état de vérification Preview et gates ouverts |
| `4704089` | 2026-09-06 | navigation entreprise vers résultats publiés |
| `f708ab7` | 2026-09-05 | preuves fraîches de certification locale |
| `0762132` | 2026-09-05 | découverte de tous les tests pilote dans la certification |
| `dfb6053` | 2026-09-05 | prévention des faux verts et garde des cibles pilote |
| `b08add4` | 2026-09-05 | historique Supabase autoritaire dans la certification |
| `e9fa7e7` | 2026-09-05 | audit de reprise Optivos et gates de release |
| `25ddef3` | 2026-09-04 | activation du feedback pilote Optivos |
| `66a59c0` | 2026-08-31 | expérience exécutive Optivos |
| `e359859` / `be249b5` / `1876e31` | 2026-08-31 | durcissement persistance Portfolio / ROI / Automation Opportunities |
| `0314be6` / `384d720` | 2026-08-27 | garde et benchmark Brain/Kimi SHADOW |

## 14. Worktrees secondaires

Tous partagent le Git commun d'AUTOMATEX/OPTIVOS; ce ne sont pas des projets distincts.

| Worktree | HEAD / état observé | Rôle |
| --- | --- | --- |
| `automatEx` | branche `recover/advanced-product-flow`, `4e3fab9`, sale (2 modifiés + 2 non suivis) | worktree historique principal/récupération; **ne pas l'utiliser comme source canonique actuelle** |
| `automatEx-feedback-release-25ddef3` | détaché propre, `25ddef3` | snapshot propre du feedback pilote |
| `automatEx-final-clean-p0-a00d304` | détaché propre, `a00d304` | snapshot de la certification P0 reproductible du 24 août |
| `optivos-disposable-cert-20260905` | détaché `0762132`, `.vercel/` non suivi | copie/base jetable ayant servi à la certification locale complète |
| `optivos-preview-0762132` | détaché `4704089`, `.vercel/` non suivi | source propre du correctif de navigation et de la Preview vérifiée |

Deux anciens worktrees temporaires sont marqués `prunable` car leurs gitdirs n'existent plus. Un
worktree de validation PR existe aussi hors du dossier de reprise à
`C:\Users\Admin\Documents\automatex-pr27-validation` au SHA détaché `0432b2c`.

## 15. État Git exact

### Avant cette mission

```text
branch: audit/optivos-v1-hardening-20260905
HEAD: d9bfb1d4cefafd9457f7ef9af2372cff64d9a449
index/staged: 0
tracked modified: 4
untracked: 562
total dirty paths: 566
describe: d9bfb1d-dirty
```

### Après création de ce document

`HANDOFF.md` doit apparaître comme un fichier non suivi supplémentaire tant qu'aucun commit n'est
autorisé. Il ne faut pas l'ajouter à l'index ni le committer pendant cette mission.

## 16. Dernière tâche réellement en cours

**PROVEN :** durcissement P0 de la projection Executive Result / Decision Center par une sûreté
décisionnelle **par opportunité** : qualité et lignée des preuves, contradictions typées, prérequis
connecteur/permission/approbation/remédiation, ROI lié à l'opportunité et comportement fail-closed.

Le chronométrage de la certification canonique est un second sous-chantier local présent dans le
même worktree. Le runner Brain/Kimi est plus ancien et ne constitue pas la dernière tâche.

## 17. Prochaine tâche exacte recommandée

Sans la commencer dans cette reprise :

1. isoler conceptuellement le scope « decision safety » du scope « certification timings » sans
   perdre aucun fichier;
2. établir le contrat métier attendu pour les deux tests rouges (test obsolète ou régression produit)
   avant tout correctif;
3. terminer les tests de repository/hydratation persistée pour lignée cross-tenant, preuves
   absentes/contradictoires, ROI mixte et prérequis non résolus;
4. obtenir 42/42 ciblés puis full Vitest, format, lint, typecheck et build;
5. sur une base locale jetable vérifiée uniquement, exécuter 24/24 migrations, pgTAP/RLS, parcours
   canonique frais, refresh et isolation Tenant B;
6. seulement après un commit cohérent et un SHA propre : créer/certifier une Preview staging exacte.

La **prochaine action immédiate** est donc : **diagnostiquer et trancher les deux régressions ciblées
de `production-executive-decision-view.test.ts` sans modifier le moteur avant d'avoir confirmé le
contrat métier.**

## 18. Actions interdites / dangereuses

- Ne jamais exécuter `git reset`, `git clean`, `git stash`, `checkout`, `switch`, `merge`, `rebase`,
  `pull`, `fetch`, `commit` ou `push` sur ce worktree sans nouvelle autorisation explicite.
- Ne supprimer ni déplacer les 4 fichiers suivis modifiés, les 2 nouveaux fichiers source/test, le
  runner de benchmark, `.vercel/` ou les 557 artefacts avant sauvegarde et décision de classement.
- Ne pas traiter `automatEx` ou un worktree détaché comme plus récent que le worktree canonique.
- Ne pas appliquer, réécrire ou renommer une migration pendant la reprise.
- Ne jamais lancer un reset DB, un test mutant ou une migration contre staging/Production.
- Ne pas réutiliser de secrets staging en Production et ne pas afficher les valeurs d'environnement.
- Ne pas déployer le worktree sale; ne pas promouvoir une Preview non reliée au SHA exact.
- Ne pas promouvoir Brain/Kimi vers CANONICAL sur la base des benchmarks synthétiques présents.
- Ne pas appeler une fonctionnalité « terminée », « certifiée » ou « production ready » sans preuve
  correspondant exactement au SHA et à l'environnement visés.
