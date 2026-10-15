# Premier pilote textuel Hermes à zéro nouveaux frais API

MISSION: Permettre une première mission textuelle réelle sur le VPS, avec preuve de réponse et de coût, idempotence et arrêt au prochain point sûr.
AFFECTED DOMAIN: Agent-workspace SHADOW et adaptateur privé de lancement.
CANONICAL OWNER: Auth/Organization et agent_company_workspaces pour les accès ; AIAgent Hermes existant pour le travail. Le moteur d'audit reste inchangé.
CURRENT STATUS: EXPERIMENTAL, profil textuel sans outil ; aucune équipe autonome complète annoncée.
FILES EXPECTED: Barrière financière Python, worker ponctuel, file de missions et service privé du pilote ; routes et panneau du même Atelier.
DB IMPACT: SQLite privé du runtime sur le VPS, lié de façon immuable à l'organisation/espace existants ; aucune nouvelle table métier ou migration Supabase.
SECURITY IMPACT: Clé de lancement distincte, filtrage GET/POST explicite, accès Auth/RLS avant réseau, worker uid 65534 sans identifiants du runtime partagé. Aucun modèle global, outil ou plugin existant modifié.
TEST PLAN: Prix inconnus/non nuls/périmés, injection de modèle/outils/plugins, mauvais jetons, idempotence, arrêt, redémarrage sans rejeu, binding immuable. Attestation réelle sans inférence avant premier appel gratuit ; résultat et coût effectifs ensuite.
OUT-OF-SCOPE: Production Optivos, achat, API payante, délégation, outils externes, installation de modèles lourds et changements des moteurs canoniques.

TARGET: VPS existant, service privé optivos-hermes-pilot ; branche Preview du pilote uniquement.
PRODUCTION?: Optivos Production non concerné.
DISPOSABLE?: Non ; vraies missions du pilote, pas de réinitialisation.
BACKUP?: Ajout de fichiers et d'une base neuve ; sauvegarde du Caddyfile avant extension, données existantes conservées.
MIGRATION REQUIRED?: Aucune migration Supabase ; le schéma de file privée est détenu par l'adaptateur, pas par Prisma.
RLS IMPACT?: Aucun changement ; chaque route Next contrôle l'espace dans l'organisation canonique via RLS avant d'utiliser sa clé privée.
TENANT IMPACT?: Un seul espace/organisation par base VPS, binding persistant non modifiable ; aucune session globale importée.
ROLLBACK PLAN?: Revenir à la Preview précédente, arrêter le seul service pilote, restaurer le Caddyfile sauvegardé et conserver les missions. Hermes partagé reste en place.

## Pourquoi ce profil isolé

Le serveur Hermes partagé applique sa configuration d'outils et ses fallbacks. Un simple modèle `:free` transmis à cet endpoint ne prouve pas l'absence d'appel à un outil payant. Le pilote utilise la classe AIAgent déjà installée, dans un processus ponctuel avec un répertoire propre, sans mémoire externe, contexte du compte, outils, repli ou revue de fond. Le worker sans privilèges ne peut pas lire `/opt/data/.env` et reçoit uniquement un jeton temporaire du proxy local ; la clé OpenRouter reste dans le service de contrôle.

Le proxy admet le seul modèle gratuit fixé côté serveur, vérifie chaque champ de tarif et la fraîcheur du catalogue, reconstruit la requête et force les prix prompt/completion maximum à zéro et `allow_fallbacks=false`. Modèles alternatifs, plugins, outils et streaming sont refusés. Une requête maximum par lancement, réponse bornée à 1 536 tokens et délais stricts ; raisonnement désactivé pour cette tâche textuelle courte. Une réponse tronquée ou vide bloque les continuations. Un coût/modèle effectif non vérifiable suspend durablement les nouveaux appels jusqu'à vérification opérateur. Aucune redirection d'authentification n'est suivie. Le texte final doit correspondre exactement au contenu d'une réponse fournisseur vérifiée, afin qu'un message d'erreur généré par le harness ne puisse pas être présenté comme un résultat modèle.

Le contrôle doit précéder toute inférence. Un coût déclaré dans le formulaire ou le nom `:free` seul ne le remplace pas. Le résultat n'est marqué terminé qu'avec une réponse réelle, une attestation d'isolation et un coût nul explicite pour chaque réponse attendue. La disponibilité et les quotas gratuits ne sont pas garantis ; un refus reste un échec visible, sans résultat inventé ni repli payant.

## Persistance et limites

Chaque requête de contrôle transporte aussi l'identifiant d'espace vérifié par Next. Le VPS le compare à son binding immuable, même si la clé est valide : une erreur de configuration Vercel ne doit pas exposer les missions d'un autre espace. Le worker prend un verrou système exclusif, conservé jusqu'à sa sortie, y compris si le service de contrôle redémarre. Son profil temporaire est supprimé à la fin.

La file privée conserve l'identifiant UUID, l'espace, l'organisation et l'auteur vérifiés, la demande, les états réels, le résultat et ses preuves. Elle ne duplique pas Auth, les entreprises ou le moteur de décision. Une base existante refuse un autre binding. Une même requête/id est rejouée sans relancer ; un contenu différent reçoit 409. Les tâches interrompues restent interrompues après redémarrage. Au plus une mission active, dix en attente et cent missions conservées pour ce pilote ; pas de purge automatique.

L'arrêt annule la file ou refuse le prochain appel. Une requête fournisseur déjà acceptée peut finir ; le worker a une durée maximale de 70 secondes. Les skills, plugins, API, MCP, navigation et actions externes resteront désactivés pour ce premier test. Ils demanderont des permissions et des contrôles de coût supplémentaires.

Sources primaires consultées : [catalogue OpenRouter](https://openrouter.ai/api/v1/models), [sélection des fournisseurs](https://openrouter.ai/docs/guides/routing/provider-selection), code Hermes installé `run_agent.AIAgent`, `agent_init_fallback`, `model_tools` et serveur API. Analyse statique et attestation ne constituent pas une preuve d'inférence ou de coût mesuré.

## Preuve réelle du 15 octobre 2026

Mission conservée sur le VPS : `bd21a02a-3d7a-4669-bd30-3fe8cc8c5d91`, procédure d'accueil client en cinq lignes, résultat de 581 caractères. Runtime Hermes AIAgent, modèle `nvidia/nemotron-3.5-lightning:free`, une requête et une réponse vérifiée : 608 tokens d'entrée, 133 de sortie, coût fournisseur retourné `0 USD`. Le texte final correspond au contenu de cette réponse, pas à un message local du harness. Ce contrôle technique ne valide pas automatiquement la qualité métier du texte.

Après redémarrage du service, une nouvelle soumission du même UUID/contenu retrouve la mission terminée, son résultat et son compteur à une requête. Les essais antérieurs échoués sont conservés. Le profil initial utilisait le streaming implicite d'Hermes : il a été refusé par la barrière, puis désactivé dans le seul profil pilote. Une réponse Liquid tronquée et un refus 429 ont ensuite motivé une tâche plus courte et le choix opérateur explicite du modèle NVIDIA gratuit ; aucun routage automatique payant n'a été ajouté. Le contrôle refuse les continuations et tout résultat sans preuve.

Les unités de politique/file ainsi que la recette UI ne font aucune inférence. Les réponses de la recette de composants sont des fixtures ; elles ne prouvent pas une session navigateur staging authentifiée. La preuve d'inférence ci-dessus vient du vrai VPS. Le formulaire public reste protégé par Auth, organisation, RLS, origine, JSON borné et rôle d'écriture.
