# Optivos — revue UX des écrans de référence, 7 septembre 2026

## Périmètre et niveau de preuve

Application locale sur http://localhost:3001, avec les données de staging existantes de l’entreprise `5dd6ebf3-6764-46ab-95ff-998e1414ea48`. Aucun déploiement, aucune migration, aucune modification de production. Les parcours navigateur de cette revue n’envoient pas de nouvelles réponses ni de nouveau feedback. L’authentification utilise les identifiants déjà configurés sans les afficher.

La revue couvre un audit terminé et publié. Elle ne remplace pas la certification du cycle complet d’une nouvelle entreprise. La suite Playwright pilote mutante est rejetée par son garde-fou : une application locale doit utiliser l’Auth et la base locale de certification. Le moteur Docker local est indisponible (`dockerDesktopLinuxEngine` absent). Cette protection n’a pas été contournée.

## Système UX retenu et appliqué

| Élément | Règle issue du produit | Application concrète |
| --- | --- | --- |
| Titre et contexte | Titre métier lisible, contexte bref | Audit, entretien, centre de décision et Results compacts |
| Action principale | La prochaine action avant les détails | Hub ; retour à l’audit depuis l’entretien validé ; centre de décision depuis Results |
| Progression | Distinguer navigation, réponses et validation | Discovery affiche « Informations validées » après validation ; entretien affiche les réponses enregistrées et informations à confirmer |
| Densité | Les priorités d’abord, les détails à la demande | Détails du plan et des opportunités repliés dans Results ; aide conversationnelle après les décisions |
| Statuts et preuves | Préserver les états et valeurs publiés | Aucun calcul, tri canonique, preuve ou conclusion inventés |
| Grilles | Les colonnes appartiennent à l’écran | La règle globale `.grid` du Dashboard devient `.dashboard-grid` ; les cartes longues disposent d’assez de largeur |
| Navigation | Conserver l’entreprise du résultat authentifié | Réutilisation du shell Company sur les détails Opportunités, ROI et Plan ; `aria-current` |
| Formulaires | Contraste et libellés explicites | Entretien sombre lisible, domaines en français, Oui/Non en consultation, données inchangées |
| Feedback | Disponible après la valeur délivrée | Dialogue existant réutilisé dans Results, sans nouveau stockage ni API |
| Mobile | Retour à la ligne plutôt que débordement | Boutons Discovery flexibles, champs financiers repliables, cartes et notes de feedback adaptées |

## Revue de chaque écran

| Écran | Constats et traitement | Suite identifiée |
| --- | --- | --- |
| Overview | Relu ; Dashboard conserve ses propres colonnes ; feedback accessible | Le bloc « Performance globale » sans score n’aide pas à décider. Le statut agrégé d’audit ne reflète pas toujours le dossier canonique affiché. À reprendre dans une passe P2 dédiée. |
| Company | Identité, contexte et CTA accessibles ; navigation conservée | Le résumé indique « Audit / À poursuivre » sur le dossier dont le Hub est terminé. Traçage du modèle d’affichage à prévoir. Le nom très long est celui de la fixture, pas du chrome produit. |
| Audit | Action avant le parcours, en-tête compact, réponses/analyse/validation distinguées | Lecture du contexte sujette à un incident P2028 observé, voir Runtime. |
| Discovery | Plus de temps restant trompeur sur la session validée ; section courante accessible ; boutons flexibles | Le formulaire en cours de saisie et la création d’un nouveau brouillon doivent être rejoués sur la base jetable. |
| Interview | Cartes blanches illisibles corrigées ; vocabulaire métier ; entretien validé en consultation ; retour au Hub | La protection est une présentation du cycle existant, pas une nouvelle garantie d’autorisation serveur. |
| Opportunities | Priorités, preuves manquantes et contrôles conservés ; shell ajouté ; titres et indicateurs lisibles | Certaines décisions de fixture demandent encore des preuves ; elles ne sont pas transformées en autorisations d’automatiser. |
| ROI | États existants conservés, noms de métriques traduits, cartes élargies, shell ajouté | Les cas économiques négatifs restent couverts par les tests existants ; pas de recalcul dans cette passe. |
| Plan | Priorité/phase conservées ; précision d’affichage du ROI limitée à une décimale ; shell ajouté | Duplication Top 3/feuille complète et libellé « Prochaine action » non interactif à revoir en P2. |
| Decision Center | Décisions avant l’aide conversationnelle, synthèse remontée, valeurs longues contenues | Le texte publié contient littéralement `{actor}` et `{share}`. Ne pas inventer ces valeurs : correction de provenance/génération à traiter séparément. |
| Results | Résumé plus compact ; détails complémentaires repliés ; vrai feedback après audit | Le modèle de résumé n’expose pas tous les états économiques détaillés du centre de décision ; pas de nouveau contrat créé pour les simuler. |
| Feedback | Ouverture/fermeture depuis Dashboard et Results ; notes de 1 à 5 sur une ligne après isolation CSS | Envoi, mise à jour et isolation de nouvelles lignes non rejoués ici : suite locale jetable requise. |

## Corrections P1

- Isolation de la règle CSS qui imposait deux colonnes à toutes les grilles Tailwind.
- Audit Hub : prochaine action prioritaire et libellés français (passe locale préexistante incluse).
- Discovery : consultation validée sans compte à rebours, `aria-current`, boutons repliables.
- Interview : contraste, vocabulaire naturel et consultation des réponses validées.
- Navigation Company réutilisée sur les trois écrans détaillés publiés.
- Decision Center : aide secondaire repliée après les décisions ; indicateurs lisibles.
- Results : moins de répétitions ouvertes et suppression du faux message « feedback non activé ».
- ROI : vocabulaire et présentation des états longs, sans toucher aux valeurs.

## Corrections P2

- Grille de feedback réparée indirectement par l’isolation CSS ; bouton réutilisable hors Dashboard.
- Plan : libellés de priorité français et arrondi d’affichage du ROI uniquement.
- Overview/Company relus et non refondus aveuglément ; réserves documentées ci-dessus.

## Routes secondaires / legacy

Les cinq routes suivantes ont été ouvertes, HTTP 200. Aucune redirection n’a été ajoutée dans cette mission.

| Classe proposée | Routes | Motif |
| --- | --- | --- |
| KEEP | Détails canoniques `/automation-opportunities/[id]`, `/roi/[id]`, `/recommendations/[id]` | Résultats réels nécessaires, désormais dans le shell Company |
| REDIRECT à planifier | `/reports`, `/recommendations` sans identifiant | Les répertoires génériques choisissent la dernière entreprise ; préférer une destination explicite contextualisée |
| HIDE des parcours clients | `/audits`, `/questionnaires` | Surfaces historiques/admin, déjà absentes de la navigation principale ; ne pas les supprimer sans audit des usages |
| HIDE / REMOVE_LATER | `/settings` | Page future sans fonctionnalité, texte technique « contrat backend public » encore présent |

## Contrat et sécurité

Question IDs, noms de champs, valeurs soumises, routes API, cycle Discovery, liens entreprise/audit et règles métier inchangés. Les pages détaillées transmettent au shell uniquement le `companyId` issu de la lecture serveur déjà authentifiée. Le chargement de navigation existant rejette les modèles d’une autre entreprise. Aucun affaiblissement des contrôles d’accès.

## Validation

- Tests ciblés : 46/46, 10 fichiers.
- Vitest complet : 1133/1133, 188 fichiers.
- Lint, typecheck, build, format ciblé et `git diff --check` : PASS.
- Revue navigateur avant/après : 11 écrans × 6 largeurs (390, 430, 768, 900, 1024, 1440).
- Navigation Discovery, ouverture des finances facultatives, rechargement, égalité du contenu de session avant/après : vérifiés en consultation.
- Entretien validé : aucun bouton Modifier/Terminer ; CTA de retour au Hub.
- Détails publiés : liens vers la même entreprise ; feedback Results ouvert puis fermé sans envoi.
- Accessibilité : smoke clavier, noms des champs, hiérarchie des titres et revue visuelle. Ce n’est pas une certification WCAG exhaustive.
- Playwright pilote complet : BLOQUÉ par la configuration locale/staging ; aucun contournement.

## Runtime — réserve impérative

Pendant la première revue après correction : un HTTP 500 sur `/api/companies/5dd6ebf3-6764-46ab-95ff-998e1414ea48/automation-audit`.

Journal serveur : `PrismaClientKnownRequestError`, code `P2028`, lecture `recommendationPortfolioSnapshot.findFirst`, transaction limitée à 5000 ms, 5763 ms écoulées. Aucun correctif backend ni allongement de timeout dans cette mission UX. Une revue ultérieure réussie ne doit pas effacer cet incident.

## Preuves locales

- `artifacts/ux-reference-before/` : captures et textes de départ.
- `artifacts/ux-reference-after/review.json` : première revue complète après corrections.
- `artifacts/ux-reference-after/additional-checks.json` : incident HTTP 500 et session Discovery inchangée.
- `artifacts/ux-reference-final/` : vérification finale après adaptation des cartes longues.

La vérification finale couvre bien les six largeurs demandées. `body.scrollWidth` ne
dépasse pas le viewport et aucun contrôle n'est sans nom. Le détecteur de texte
tronqué signale seulement des libellés de cartes à largeur contrainte (par exemple
les indicateurs de l'Audit Hub, les métriques Opportunités et les détails ROI/Plan) ;
aucun contenu ne crée de débordement horizontal. Ces signaux restent à reprendre
dans une passe de finition si une troncature métier est confirmée visuellement.

La vérification runtime finale a de nouveau observé des réponses 500 sur
`/api/companies`, `/api/audits` et `/api/companies/:id/automation-audit`.
L'incident `P2028` déjà décrit concerne la lecture de
`recommendationPortfolioSnapshot.findFirst` dans une transaction expirée. Il est
distinct des corrections de présentation et empêche de déclarer le parcours
fonctionnel global certifié.

Les captures, scripts de revue, `.vercel/` et scripts de benchmark restent hors commit.

## Gate

READY_FOR_NEXT_GLOBAL_AUDIT_PHASE = NO tant que la suite pilote locale n’est pas rejouée et que l’incident de lecture P2028 n’est pas résolu/recertifié. La synthèse publiée avec variables non résolues doit aussi être traitée avant toute affirmation de qualité exécutive finale.
