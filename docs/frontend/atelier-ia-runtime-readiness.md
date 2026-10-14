# Raccordement réel Hermes — diagnostic du 14 octobre 2026

## Ce qui a été vérifié sans inférence

- VPS Hostinger 2059450, srv2059450.hstgr.cloud, KVM 1 : running.
- GET natif des capacités : sessions de discussion, missions idempotentes, état, événements, arrêt, validations et skills annoncés disponibles.
- GET natif des skills et groupes d'outils : 64 skills, 27 groupes. Le nouveau client Optivos a validé et projeté les réponses réelles via le tunnel privé LOCAL, sans appel de modèle. Aucun compte client ni registre de mission modifié.
- GET des options modèle : fournisseur actuel openrouter, modèle deepseek/deepseek-v4.1-flash. Ce constat frais remplace les anciennes observations du fournisseur/modèle.
- Catalogue public OpenRouter : ce modèle a des prix strictement positifs ; son utilisation ne respecte donc pas le plafond de 0 € de nouveaux frais API. Aucun appel d'inférence lancé.
- Le même catalogue propose 13 modèles `:free` annonçant tools et prix prompt/completion nuls. Il s'agit de candidats, pas d'une disponibilité ou d'une qualité validée par inférence.

Sources vérifiées : [catalogue officiel OpenRouter](https://openrouter.ai/api/v1/models), [dépôt 9Router](https://github.com/decolua/9router), [API Hermes](https://hermes-agent.nousresearch.com/docs/user-guide/features/api-server). Le dépôt 9Router existe sous licence MIT ; ses promesses marketing ne prouvent ni gratuité des comptes amont ni compatibilité de chaque modèle avec Hermes.

## Ordre de réalisation

1. Établir une connexion HTTPS authentifiée Vercel → passerelle VPS. Le tunnel localhost du PC n'est pas joignable depuis Vercel. Garder le serveur natif Hermes en loopback ; utiliser une clé dédiée et des chemins autorisés. La passerelle ne doit pas exposer la liste globale des sessions des clients.
2. Définir et tester le contrôle du plafond : modèle explicitement gratuit, tarifs actuels vérifiés, absence de repli payant, coûts d'outils désactivés sans autorisation. Échec fermé si modèle indisponible, prix inconnu ou contrôle non effectif. Un budget déclaré dans l'interface n'est pas un contrôle financier.
3. Ajouter le dispatch avec enregistrement durable entreprise/mission, idempotence et permissions. Gérer le cas où Hermes accepte une mission mais l'enregistrement échoue, avant d'autoriser un rejeu.
4. Ajouter session de discussion privée, résultats/fichiers et validations/arrêt. Tester propriétaire, lecteur et autre entreprise sur chaque action.
5. Ajouter inventaire détaillé, installation et activation des skills/plugins/API/MCP avec permissions, versions et provenance. Ouvrir les clients pilotes après validation de l'isolation du runtime et des secrets.

OpenRouter gratuit est une piste prioritaire pour éviter d'héberger un modèle gourmand sur KVM 1. 9Router reste une alternative à vérifier ; le modèle local/VPS demandera une mesure de mémoire, latence et qualité d'utilisation des outils. Aucun changement de fournisseur ou d'installation n'a été appliqué par ce diagnostic.

## Limites de la publication

Le tableau ne simule plus d'exécution. La consultation du registre, de la connexion et de l'inventaire est implémentée, mais dépend de la configuration serveur du dossier. Discussion, création de mission, arrêt et installation depuis Optivos restent non raccordés. Les écrans les annoncent explicitement. Aucun déploiement Production, achat ou appel payant.
