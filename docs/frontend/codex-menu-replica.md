# Menus du poste Optivos : référence Codex Desktop

## Amélioration de la navigation des paramètres

MISSION: corriger le cadrage mobile des paramètres et faciliter le repérage des fonctions raccordées.
AFFECTED DOMAIN: présentation agent-workspace ; CANONICAL OWNER: composants du poste existants ; CURRENT STATUS: SHADOW / Preview.
FILES EXPECTED: codex-settings.tsx, styles ciblés, recette de composants et cette note.
DB IMPACT: aucun ; SECURITY IMPACT: aucun changement de droits ni nouvel appel externe.
ROOT CAUSE: PRODUCT BUG : la grille mobile imposait une colonne de 145 px et affichait les cases à cocher à la suite des libellés sans espace réservé.
TEST PLAN: détail pleine largeur à 375 px, absence de collision, focus aller/retour, filtre réversible, recherche sans accents, recette existante et CI.
OUT-OF-SCOPE: moteurs, API, production, activation de nouvelles capacités.

Sur mobile, les rubriques et le détail occupent successivement la largeur disponible. Le retour conserve la sélection et rend le focus à la rubrique ; le choix d’une rubrique place le focus sur son titre. Sur ordinateur, les deux colonnes restent visibles. La recherche ignore les accents et masque les groupes sans résultat. Le filtre facultatif « Utilisables ici uniquement » conserve le catalogue complet lorsqu’il est désactivé ; les rubriques sans contenu raccordé sont signalées dès la liste. Les lecteurs Hermes restent manuels et l’inventaire ne permet toujours pas d’installation.

Validation locale de cette amélioration : 73 tests et 22 contrôles de composants PASS ; TypeScript, ESLint et formatage PASS. Captures à 375 px inspectées : détail pleine largeur et aucun chevauchement des cases à cocher. API de recette simulée, aucune mission réelle ni dépense API ; recette propriétaire authentifiée sur staging toujours NOT RUN.

MISSION: reconstruire la navigation et les menus livrés de Codex, au-delà de la disposition conversationnelle.
AFFECTED DOMAIN: présentation agent-workspace.
CANONICAL OWNER: même workspace, lecteurs Hermes et routes audit existants.
CURRENT STATUS: SHADOW / Preview.
FILES EXPECTED: catalogue des menus, composants de menus/paramètres, intégration au poste, recette visuelle.
DB IMPACT: aucun ; préférences d’affichage locales seulement.
SECURITY IMPACT: commandes de mission réutilisant le client existant ; aucun nouveau droit, outil ou fournisseur.
TEST PLAN: menus clavier, sous-menus, recherche, paramètres, export réel et refus des commandes non raccordées ; mobile et CI.
OUT-OF-SCOPE: réimplémentation des services internes Codex, achat, moteur audit, production, faux agents ou résultats.

## Source et limites

Version de référence : Codex Desktop Windows 26.1007.9446.0, archive applicative locale. Inventaire statique des identifiants `windowsMenuBar.*`, `sidebarElectron.*`, `settings.nav.*`, `codex.profileFooter.*`, du composeur et des menus contextuels. Les bundles ne sont ni exécutés ni incorporés au produit ; aucun historique utilisateur lu. Le catalogue dérivé et les preuves restent hors dépôt, à l’exception des noms de menus et identifiants servant de référence.

La version contient plusieurs modes et des entrées conditionnelles. Présence dans le code ne signifie pas disponibilité dans chaque compte. Le modèle Optivos expose les catégories du catalogue, en distinguant commandes opérationnelles, préférences locales et fonctions non raccordées. Les entrées internes réservées aux employés/débogage ne sont pas présentées comme des services accessibles. Le projet ne revendique pas une copie du moteur ou des capacités Codex.

## Comportement

Barre d’application en haut ; actions Nouveau chat/Rechercher ; navigation des rubriques et groupe Audit Optivos ; projets/équipes et historique à gauche ; menu du profil en bas ; paramètres avec navigation latérale et recherche ; menus du composeur et de conversation. Nouveau chat et recherche restent locaux jusqu’à un lancement explicite. Exporter/copier utilise uniquement un résultat réel déjà chargé. Les commandes de suppression, archivage, partage public, terminal, Git, worktrees et installation non disponibles restent identifiées comme non raccordées, sans mutation simulée.

Le menu de déconnexion soumet le formulaire POST `/auth/logout` existant : aucune logique d’authentification n’est recréée. Les préférences de texte/mouvement/largeur du rail se synchronisent avec le stockage local via `useSyncExternalStore` ; si l’écriture est refusée, la page reste utilisable et annonce l’absence de persistance. Aucun texte de mission ou secret n’est conservé dans ces préférences.

Le catalogue contient 45 rubriques de paramètres et six alias pour les variantes de comptes de Codex. Les menus natifs Windows ont aussi été inventoriés dans les bundles du processus principal ; les commandes réservées à macOS et aux outils internes ne sont pas annoncées comme disponibles sur cette référence Windows.

## Vérification

73 tests des modules concernés et de la porte d’entrée ; 21 contrôles UI de composants avec réponses de recette. La recette vérifie les sous-menus au clavier, le retour du focus, le filtrage des paramètres, la persistance des préférences, un export dont le contenu correspond au résultat chargé, le refus d’archivage sans mutation, la recherche locale et le cadrage des menus/paramètres à 375 px. TypeScript, ESLint et formatage vérifiés. Ces contrôles ne constituent pas une recette navigateur avec la session propriétaire sur le staging ; celle-ci reste NOT RUN.
