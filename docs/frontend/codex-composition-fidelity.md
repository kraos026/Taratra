# Composition du poste : rapprochement de Codex

MISSION: rapprocher le poste conversationnel de la composition et des interactions Codex.
AFFECTED DOMAIN: présentation agent-workspace.
CANONICAL OWNER: registre des entreprises IA et cycle de mission Hermes existants ; parcours audit conservé.
CURRENT STATUS: SHADOW / Preview.
FILES EXPECTED: rail, menus, free-pilot-panel, styles ciblés, recette de composants et cette note.
DB IMPACT: aucun.
SECURITY IMPACT: aucun nouveau droit, fournisseur ou outil ; les suggestions préremplissent uniquement le champ. Envoi explicite et politique gratuite existante.
TEST PLAN: composition vide/active, suggestions sans requête, Entrée/Maj+Entrée/composition IME, refus d’envoi non prêt, menus complets, rail repliable, 375/820/1440 px, CI.
OUT-OF-SCOPE: services Codex, moteurs audit, activation des commandes non raccordées, production, code propriétaire incorporé.

Écart constaté : rail trop chargé, logo occupant une ligne entière, composer à plusieurs étages, état vide séparé de la saisie par une grande hauteur. Les composants existants sont conservés ; aucune seconde interface ou persistance créée.

Référence : archive Codex Desktop Windows 26.1007.9446.0 lue comme données inertes. Inventaire de onze modules (286 259 octets) : sources communes, quick chat, sélecteur de cible et variantes de sidebar. Certaines variantes correspondent à Work, aux réunions ou aux revues : elles ne prouvent pas la disposition du mode principal. L’analyse REA groupée a atteint sa capacité mémoire ; une analyse ciblée du module sidebar-1c126b303584.js a ensuite terminé avec une limite de 384 Mio. Son résultat structurel est distinct de la comparaison visuelle ; il ne prouve pas une identité pixel par pixel. Sources et graphes restent hors dépôt. Aucun appel de modèle pour cette analyse.

REA ciblé : preuve `ev_56edbebda9bdee322926b04803f6c70fb47523a5f362a696fbd5f3534d15f7aa`, 22 959 octets, 7 405 nœuds AST, zéro échec de parsing. Couverture sémantique déclarée `unknown`, non tronquée : aucune revendication de reconstruction exhaustive.

Le poste conserve tous les menus : MCP et revue de code passent dans « Plus », avec leurs destinations existantes. L’en-tête du rail permet le repli et la réouverture avec retour du focus. La nouvelle mission rapproche le titre, trois amorces de texte et le composeur. Les amorces n’effectuent aucune lecture ou génération, n’écrasent pas un texte déjà saisi et restent limitées aux missions textuelles. La vérification manuelle du pilote rejoint la barre de session. Entrée déclenche la soumission explicite uniquement lorsque le pilote est prêt ; Maj+Entrée conserve une nouvelle ligne, la composition IME et les touches répétées ne déclenchent pas l’envoi. Les contrôles serveur restent inchangés. Le focus des paramètres est appliqué pendant le rendu pour éviter qu’un rappel différé ne reprenne le focus à une recherche commencée entre-temps.

Recette de composants avec API mockée : 23 contrôles, dont préremplissage sans requête, envoi clavier, ligne nouvelle/IME sans envoi, repli/réouverture, absence de perte de menus, saisie visible sur mobile et défilement des réponses longues. La recette attend l’affichage du résultat actualisé avant de mesurer le défilement. Les captures sont des données de test ; session propriétaire staging E2E NOT RUN. Aucun nouvel appel IA ni modification du runtime VPS.
