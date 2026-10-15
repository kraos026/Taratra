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

Le dossier `ee427831-284b-4174-82da-b92a319696c7` est confirmé en base comme `CERT-STAGING-ROI-ACTIVITES-20261008`. Aucun binding de ce dossier de certification au runtime personnel n'est créé. Les variables privées Vercel ne sont pas configurées : la tentative de lecture via l'identité CLI existante a renvoyé HTTP 403 avant toute écriture. Le connecteur Vercel fonctionne toujours ; la configuration de sa clé reste à effectuer après identification de l'espace pilote réel. Le transport public est testé ; la connexion depuis une page Optivos authentifiée reste NOT RUN.

Les clés ne figurent ni dans les commandes journalisées, ni dans les preuves, ni dans Git. Le certificat et les secrets restent sur le VPS. L'instance Paperclip déjà présente sur le VPS est laissée intacte.
