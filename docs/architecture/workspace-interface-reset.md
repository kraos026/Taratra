# Nouvelle interface du poste agentique — 16 octobre 2026

L’utilisateur remplace les anciennes règles visuelles Optivos et choisit deux thèmes avec sélecteur. Le [système visuel du workspace](../../design-system/optivos-workspace/MASTER.md) devient la référence de cette interface. Les services métier et frontières Auth/Organization restent les propriétaires des données.

## Modification livrée

Un shell autonome `platform-studio` remplace le shell visuel Codex/Optivos précédent pour les espaces IA. Il possède ses tokens `--ws-*`, sa marque de poste, sa navigation resserrée, ses surfaces et ses composants clair/sombre, sans dépendre de l’ancienne palette `--opt-*`. Les menus secondaires restent accessibles ; les fonctions indisponibles ne constituent plus l’essentiel du rail. Les paramètres n’affichent par défaut que les rubriques utilisables dans le contexte.

La création est un assistant Objectif → Équipe → Vérification. Le retour conserve les valeurs et chaque transition vérifie les champs pertinents ; un nom d’agent dupliqué ou une configuration incomplète bloque l’étape finale. Les options d’autonomie et de dossier d’audit sont dévoilées à la demande. La soumission utilise strictement la fonction, les données et l’API de création existantes ; aucune équipe n’est enregistrée pendant les étapes intermédiaires.

Le canevas prend toute la fenêtre de travail, avec une surface prioritaire et un inspecteur défilant. Les connexions accessibles au clavier rejoignent cet inspecteur. La vue mobile place le canevas puis la configuration dans le même document. Les fonctions d’import/export et validations A1/A3 sont conservées.

La préférence clair/sombre utilise `optivos.workspace.theme.v2` et un magasin externe React. Le thème est transmis par contexte aux menus portalisés, appliqué aux dialogues/champs et au mode xyflow. Aucun contenu métier n’est conservé dans cette préférence. Si son écriture est refusée, le thème reste fonctionnel en mémoire avec un message explicite. Le premier rendu serveur utilise le thème sombre ; la préférence est restaurée après hydratation.

## Preuves et limites

La recette de composants couvre les thèmes, persistance après rechargement, repli du stockage, contraste du texte principal et des menus >=4,5, formulaire mobile, navigation clavier, étapes et retour sans mutation intermédiaire, graphe et missions. Elle utilise des réponses serveur de recette : elle ne prouve pas une session authentifiée sur staging. Les écrans historiques d’audit gardent encore leur présentation ; cette refonte concerne le poste agentique et n’altère pas leur moteur.

Les composants et modèles gardent leurs responsabilités : aucun changement de contrat API, schéma de données, calcul métier, accès organisationnel, service VPS, dépendance ou budget modèle. Les brouillons de graphe restent en mémoire et exportables ; leur sauvegarde serveur et leur exécution ne sont pas ajoutées par la refonte.
