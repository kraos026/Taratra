# Menus du poste Optivos : référence Codex Desktop

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
