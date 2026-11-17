# Entreprises IA : concept Paperclip adapté à Optivos

## Source étudiée

Paperclip : commit `5b29b9062e9b877ef16660936c49d2c132ffc1ea`, clone officiel en lecture seule, sans installation des dépendances ni lancement du serveur. Licence MIT, Copyright (c) 2025 Paperclip AI. Aucun code Paperclip n'est importé dans le produit pour cette première version ; les concepts sont repris avec des composants Optivos.

Sources primaires à ce commit : [création d'entreprise](https://github.com/paperclipai/paperclip/blob/5b29b9062e9b877ef16660936c49d2c132ffc1ea/docs/guides/board-operator/creating-a-company.md), [validations](https://github.com/paperclipai/paperclip/blob/5b29b9062e9b877ef16660936c49d2c132ffc1ea/docs/guides/board-operator/approvals.md), [politiques de budget](https://github.com/paperclipai/paperclip/blob/5b29b9062e9b877ef16660936c49d2c132ffc1ea/server/src/services/budgets.ts#L647), [adaptateur Hermes](https://github.com/paperclipai/paperclip/blob/5b29b9062e9b877ef16660936c49d2c132ffc1ea/packages/adapters/hermes/src/gateway/server/execute.ts), [licence](https://github.com/paperclipai/paperclip/blob/5b29b9062e9b877ef16660936c49d2c132ffc1ea/LICENSE).

## Fonctionnement retenu

Dans Paperclip, l'entreprise regroupe un objectif, un organigramme d'agents, des tâches, des budgets, des approbations et un historique. Un responsable délègue à ses subordonnés ; les agents s'exécutent via des adaptateurs et des réveils/heartbeats. L'opérateur humain peut consulter, valider et suspendre le travail. Les adaptateurs Hermes local et gateway sont présents ; le gateway utilise les runs HTTP, leur état, les événements et l'arrêt. Cela ouvre une piste de réutilisation ultérieure, sans prouver sa compatibilité avec notre installation tant qu'elle n'a pas été testée.

Différence essentielle : dans le service budgets étudié, un montant zéro désactive la politique (`nextIsActive = amount > 0 ...`). Reprendre ce réglage ne garantit pas notre plafond de zéro nouveaux frais API. Optivos garde les configurations en préparation et n'ajoute aucun endpoint de lancement ; une politique de prix vérifiés, de permissions et de refus du repli payant reste nécessaire au raccordement.

## Analyse REA réellement effectuée

REA 6.4.0 existant sur le VPS, sans modèle génératif ni installation supplémentaire. Analyse statique limitée à cinq fichiers dérivés des sources : schémas companies/agents, transport-security, parseurs stdout local/gateway. Les trois TypeScript sont transpilés avec le compilateur existant, sans exécuter leur code ; le manifeste de provenance conserve les chemins et empreintes des sources et des fichiers analysés. Le manifeste JSON compte comme sixième fichier inventorié.

Limites : heap de l'analyseur 128 MiB, heap V8 du CLI 256 MiB (aucune limite RSS déduite), timeout par source 20 secondes. Résultat : 5 JavaScript parsés, 2 010 nœuds AST visités, aucune erreur de parsing, couverture sémantique partielle, aucun module résolu. Evidence `ev_76c9ea9e90bbc0eee05070494853af1ef9260baf67d45d380593856f0d7b1fdc`. Ce contrôle ne certifie ni l'architecture complète, ni les budgets en exécution, ni les performances de Paperclip. Les conclusions fonctionnelles viennent de la lecture des guides et services source, et non d'un runtime simulé.

Le guide REA recommande la lecture ordinaire pour les dépôts source complets ; l'analyse ciblée supplémentaire répond à la demande humaine explicite, sans élargir aux milliers de fichiers ou lancer des agents.

## Décision d'intégration

Reprendre d'abord le concept dans l'interface et la persistance Optivos, en réutilisant Auth/Organization/Company/RLS. Éviter à cette étape un second frontend, une seconde authentification et une migration de toutes les tables Paperclip. Ce choix réduit le périmètre d'installation ; aucune économie de mémoire ou de tokens n'est présentée comme mesurée.

La création d'équipe n'est pas un moteur de travail supplémentaire : elle enregistre les profils que le runtime Hermes devra ensuite utiliser. Un fork Paperclip complet ou la réutilisation de son orchestration restent des choix futurs à éprouver sur le VPS, avec isolation et contrôle financier. On ne recopie pas les budgets zéro désactivés ni une activation automatique.

## Première version construite

- Nouvelle entrée Créer une entreprise IA depuis `/atelier-ia` et depuis l'atelier d'un dossier.
- `/atelier-ia/entreprises` : guidé, modèle ou manuel ; nom, objectif, profils, autonomie souhaitée et dossier facultatif.
- Équipe de un à trois profils : direction humaine, premier profil coordinateur, suivants sous sa coordination. La proposition guidée est déterministe, sans appel IA.
- Configuration enregistrée dans `agent_company_workspaces`, sous l'organisation canonique même sans dossier d'audit. Liaison facultative et modifiable ensuite à un dossier actif du même tenant.
- Le listing et les liaisons persistent ; budget API 0, statut preparation et limite de concurrence 1 contraints en DB. Pas de secret, activation ou suppression depuis le navigateur.
- Authentification obligatoire ; création/liaison owner/admin/consultant, consultation viewer. Rejeu d'une création par même UUID et contenu renvoie la configuration existante, sans l'écraser. Payloads stricts/bornés et origine contrôlée.

Cette version configure une entreprise d'agents ; elle ne fait pas travailler l'équipe. Aucun objectif accompli, revenu, coût économisé ou agent actif n'est inventé. La petite équipe opérationnelle demande encore le raccordement Hermes, le dispatch, les rôles/outils effectifs, la validation humaine et des résultats persistants.

## Vérification et suite

Tests du service et recette UI des trois modes ; SQL pgTAP sur Supabase LOCAL CI jetable, puis migration additive et isolation sur staging avant publication finale. La recette UI à réponses API de test ne constitue pas une preuve d'Auth staging. Aucun moteur d'audit, compte client, campagne ou Production modifié.

Suite : relier une configuration à un runtime privé, vérifier zéro frais, exécuter une mission en séquence avec preuves puis ajouter délégation, planning, historique d'équipe et validations. Les skills/plugins/API/MCP seront associés à des profils avec des permissions effectives ; les profils seuls ne confèrent aucun accès.

## Migration staging et identité

La migration source est `20261014181521_agent_company_workspaces.sql`, alignée sur la version attribuée par le MCP Supabase en staging. Son SQL a d'abord passé la CI LOCAL jetable sous l'identifiant CLI initial 20261014174747. La seule correction de recette concernait un statut de fixture : `prospect`, valeur canonique, remplace `draft` qui n'existe pas dans Optivos. Aucun schéma ou moteur existant n'a été changé pour satisfaire le test.

En staging, la création indépendante, la consultation et la liaison au dossier du même tenant ont été vérifiées sous rôle authenticated ; une liaison à l'autre tenant, sa lecture et la lecture anonyme sont refusées. La transaction de recette a été annulée : aucune configuration de test conservée. Cette preuve SQL n'est pas une recette de l'interface staging authentifiée.
