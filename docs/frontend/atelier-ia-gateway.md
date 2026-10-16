# Passerelle de consultation Hermes

MISSION: Relier la Preview Optivos au VPS existant par HTTPS, sans ouvrir les mutations Hermes.
AFFECTED DOMAIN: Transport agent-workspace et infrastructure privée du pilote.
CANONICAL OWNER: Auth/CompanyService/RLS existants pour les accès ; Hermes existant pour le runtime.
CURRENT STATUS: SHADOW, consultation seulement ; aucun dispatch ou modèle activé.
FILES EXPECTED: Script de provisionnement de la passerelle, documentation et preuves de transport.
DB IMPACT: Aucun.
SECURITY IMPACT: Certificat public vérifié, clé de passerelle distincte de la clé native, liste fermée de chemins GET sans query ; sessions, configuration et mutations refusées. API native conservée en loopback.
TEST PLAN: Valider la configuration Caddy ; recette loopback positive/négative contre le vrai Hermes avant activation publique ; TLS public et refus anonymes ; variables Vercel limitées à la branche Preview.
OUT-OF-SCOPE: Production Optivos, moteur d'audit, dépenses IA, changement du modèle global, installation de Paperclip, missions et sessions globales.

La passerelle utilise Caddy distribué par Ubuntu, extrait sans démarrer le service HTTP par défaut. Le service dédié a un utilisateur dynamique, des capacités limitées aux ports bas, un stockage TLS privé et aucun journal d'accès contenant les en-têtes. Les secrets restent hors dépôt. Le script refuse les secrets natifs malformés et les fichiers de configuration existants différents ; il ne fait pas de rotation implicite.

La clé dédiée n'accorde que la consultation de `/v1/capabilities`, `/v1/skills`, `/v1/toolsets` et d'un identifiant de run de forme stricte. Optivos doit toujours vérifier l'entreprise et la liaison persistante avant de lire un run. Cette passerelle ne constitue pas une isolation multi-client d'un runtime partagé ; le pilote reste limité à un seul dossier explicitement lié.

Le provisionnement prépare les fichiers et exécute la recette locale ; l'activation du service et sa certification publique sont des opérations distinctes. La disponibilité du port 443 et l'émission ACME doivent être vérifiées sur le VPS. Retour arrière : arrêter/désactiver uniquement `optivos-hermes-gateway.service`, retirer les variables de la branche Preview ; conserver le Hermes natif et les autres services.

Cette étape ne garantit pas un coût d'exécution nul : aucun chemin de lancement n'est exposé. Le contrôle des prix, du fournisseur et des outils demeure requis avant un futur dispatch.

Sources : [installation Caddy](https://caddyserver.com/docs/install), [matchers](https://caddyserver.com/docs/caddyfile/matchers), [service systemd](https://caddyserver.com/docs/running#using-the-service).

## Résultat du 15 octobre 2026

Passerelle activée sur `https://srv2059450.hstgr.cloud`, certificat Let's Encrypt vérifié depuis le poste externe, service dédié actif et activé au démarrage. Caddy Ubuntu `2.6.2-6ubuntu0.24.04.3`, paquet extrait sans installation de son service par défaut. Aucune règle de pare-feu existante ni configuration native Hermes modifiée.

Les onze contrôles loopback et onze contrôles HTTPS publics passent : capacités, 64 skills et 27 groupes d'outils disponibles avec la clé dédiée ; anonymes, mauvaise clé, POST, sessions globales, configuration et query refusés. Aucun lancement de run valide ou appel d'inférence. Mémoire cgroup du service observée après recette : 12 021 760 octets ; mesure ponctuelle, pas une économie comparative ou une limite mémoire.

Le dossier `ee427831-284b-4174-82da-b92a319696c7` est confirmé en base comme `CERT-STAGING-ROI-ACTIVITES-20261008` ; il n'est pas relié au runtime personnel. Après demande explicite de création par l'utilisateur, son compte réel et son rôle owner ont été vérifiés. L'espace indépendant « Optivos — équipe IA » est créé sous rôle authenticated/RLS dans son organisation canonique : coordinateur et exécutant, validation humaine, statut préparation, concurrence 1, budget API 0. Aucun dossier d'audit ni identité modifié.

Le connecteur Vercel a configuré les trois variables chiffrées API_URL/API_KEY/WORKSPACE_ID sur la seule branche Preview `codex/optivos-hermes-ui`. La tentative CLI précédente avait échoué HTTP 403 avant écriture ; elle n'est plus le chemin de configuration. La clé dédiée ne quitte le VPS que pour son stockage serveur chiffré Vercel ; la clé native reste sur le VPS.

Les routes `/api/atelier-ia/entreprises/[id]/connection` et `/inventory` réutilisent les clients et panneaux existants après Auth, organisation canonique et lecture RLS de l'espace. Le binding WORKSPACE_ID est distinct du COMPANY_ID historique ; deux bindings simultanés sont refusés, aucun dossier lié ne reçoit implicitement cet accès. Le dépliage du panneau ne déclenche rien : les lectures sont manuelles. Les tests vérifient le refus avant réseau d'un anonyme, d'un espace absent/étranger, d'une erreur de DB et d'un binding différent. L'autre organisation ne voit pas la configuration personnelle en staging. Treize contrôles UI à réponses de recette passent ; cette recette ne remplace pas l'Auth navigateur staging, qui reste NOT RUN.

Les valeurs de clé ne figurent ni dans les commandes journalisées, ni dans les preuves, ni dans Git. Les recettes refusent les redirections pour ne pas transmettre les en-têtes d'authentification vers une autre destination. L'instance Paperclip déjà présente sur le VPS est laissée intacte.
