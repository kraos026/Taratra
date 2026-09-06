# Optivos — contrôle Preview et navigation, 6 septembre 2026

## Périmètre et défaut reproduit

La Preview du SHA `07621326fd3148e1d2ff1f820dcf8ae727dcf6ea`
(`https://taratra-kgvoiuniy-optivos.vercel.app`) répondait en HTTP 200 sur les
pages publiées, mais les liens Opportunités, ROI et Plan d’action du layout
entreprise renvoyaient systématiquement vers l’Audit. Classe : PRODUCT BUG,
présentation/navigation. Le layout construisait ces trois destinations en dur.
Il interprétait également le segment statique `new` comme un identifiant entreprise.

## Correction isolée

Commit `4704089c565a5fd4c08ed3cbf85cb53ea6cceacd` :
`fix: route company navigation to published audit results`.

- `src/app/companies/layout.tsx`
- `src/components/dashboard/company-navigation.ts`
- `src/components/dashboard/company-navigation.test.ts`

Réutilisation de `customerJourneyRoutes`, alimenté par le GET existant
`/api/companies/[id]/automation-audit`. Seuls les éléments publiés fournissent
des liens directs. Les brouillons, données absentes, erreurs et réponses d’une
autre entreprise ne fournissent pas de destination publiée. Les requêtes sont
annulées lors des changements de contexte. Aucune modification de moteur,
de contrat API, de schéma, de publication ou de formule ROI.

Validation sur ce changement :

- Tests ciblés : 3 fichiers / 18 tests PASS.
- Vitest : 186 fichiers / 1125 tests PASS.
- Lint, typecheck, build, format limité aux trois fichiers : PASS.
- Navigateur local connecté au staging : liens vérifiés à 1440, 820 et 390 px ;
  trois clics réels vers Opportunités, ROI et Plan PASS ; absence de liens
  `/companies/new/...` sur la création ; aucune erreur page/HTTP 500 observée.

## Nouvelle Preview

- URL : <https://taratra-87a71r0gm-optivos.vercel.app>
- ID : `dpl_4VzPozJwfCkSeJ5DkkLN1jBafRM6`
- Cible : Preview, équipe Optivos, projet taratra.
- État : READY.
- SHA Git et métadonnée verifiedSourceSha : `4704089c565a5fd4c08ed3cbf85cb53ea6cceacd`.
- Source : worktree détaché propre ; 862 fichiers contrôlés avant envoi.
- Exclusions vérifiées : fichiers env, `.vercel`, artifacts, résultats Playwright,
  script expérimental Brain/Kimi.
- Configuration : mêmes quatre valeurs staging vérifiées, limitées à ce
  déploiement et son build ; aucune variable partagée Production modifiée.

Sur cette Preview, la navigation corrigée passe aux trois largeurs ; les trois
clics réels atteignent leurs pages publiées. Le parcours de lecture d’une
entreprise staging déjà complète répond 200 : Overview, Company, Audit,
Discovery, Opportunities, ROI, Plan, Decision Center, Results et
`/recommendations`. Aucun écran d’erreur ou retour au login observé.
Résultats : aucun débordement horizontal à 390, 820 et 1440 px.
Le compte B s’authentifie réellement et reçoit HTTP 404 sur les trois API de
l’entreprise A : entreprise, Executive Result et Decision Center. Isolation
en lecture PASS pour ce scénario. Aucun changement de donnée métier effectué.

Ces contrôles utilisent des données staging existantes : ils ne constituent pas
une nouvelle génération canonique complète sur Preview. La certification
canonique locale neuve du SHA précédent reste documentée dans
`OPTIVOS_HARDENING_PROGRESS_2026-09-05.md`.

## Points encore ouverts

- Le test `zz-decision-center.spec.ts` tolère des interruptions/timeouts de
  navigation et ne vérifie essentiellement que l’absence de `/login` : son
  résultat antérieur ne certifie pas à lui seul le rendu du Decision Center.
  Correction et nouvelle certification du harness à faire séparément.
- Le sélecteur de fixture Playwright accepte une première correspondance
  approximative si le nom exact est absent : revue nécessaire avant une suite
  distante complète pouvant modifier des fixtures.
- La capture mobile de l’Audit terminé montre encore le libellé anglais
  « View recommendations » : défaut de copie, non corrigé dans le patch de liens.
- Durées de navigation observées (incluant l’attente navigateur) : environ
  2,5 à 9 secondes ; ne pas présenter ces mesures comme une latence API pure.
- Docker Desktop ne répond plus correctement. Son redémarrage standard a
  échoué avec `context deadline exceeded` et des processus restant actifs.
  Le retour en service du projet local initial n’est pas certifié ; ses volumes
  ont été conservés. Aucun reset ou suppression de volume effectué.
- Les gates sécurité, exploitation, DNS/SSL et V1 payante du rapport précédent
  restent ouverts. Aucun basculement Production, changement DNS ou push.

**Statut : navigation publiée vérifiée sur Preview ; certification globale de
release toujours incomplète. Aucun feu vert Production.**
