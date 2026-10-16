---
name: optivos-engine-adapter
description: Raccorder une capacité d’un moteur ou transport à Optivos en conservant ses sessions, ses permissions, son budget et ses preuves ; ne pas confondre catalogue et exécution.
metadata:
  version: "0.1.0"
---

# Raccorder un moteur à Optivos

Consulter le [socle actuel](../../../docs/architecture/universal-orchestration.md), le registre `src/modules/agent-workspace/domain/engine-registry.ts` et la frontière `application/universal-dispatch.ts`. Le dispatch v1 n’accepte que le texte Hermes ; l’ajout d’un manifeste ne suffit pas à créer un binding exécutable.

Définir une capacité précise, son schéma d’entrée/sortie, ses effets, son propriétaire et sa portée. Réutiliser les services et traitements existants par un port versionné. Une nouvelle capacité ne doit pas élargir silencieusement l’enveloppe v1 ou donner à un autre moteur les secrets du pilote.

Les endpoints et credentials sont résolus côté serveur pour le bon espace ; ne jamais transformer une URL/commande fournie par l’agent en exécution arbitraire. Un connecteur de l’opérateur n’est pas une autorisation client. Pour les outils de sécurité, lier l’exécution au périmètre d’actifs autorisé et au rôle de la mission.

Documenter lancement, lecture, arrêt, timeout, résultat, erreur et reprise. Conserver l’identifiant externe et l’UUID d’intention. Un timeout n’est pas la preuve d’un échec sans effet ; consulter l’état avant de rejouer et refuser les replis implicites. Les actions non idempotentes requièrent une stratégie propre au moteur.

Budget actuel : aucun nouveau frais API autorisé. Vérifier prix/limites réels, refuser le coût inconnu et le repli payant ; ne pas assimiler « compatible OpenAI », abonnement ou modèle local à « gratuit ». Les opérations déterministes, schémas et routages explicites ne nécessitent pas un LLM. Jev n’est évalué que pour un travail sémantique répétitif pertinent, selon la politique globale et son budget.

Tester les refus réels avant de qualifier le binding d’actif : tenant, rôle, origine/tailles, paramètres injectés, versions incompatibles, coût inconnu, doublon, délai ambigu et absence de fuite. Rapporter séparément tests mockés, transport réel, E2E propriétaire et état Production. Vérifier licence et ressources avant l’offre vendue ou l’ajout d’un service.
