# ADR-0030 — Plateforme Optivos, plugin audit et frontière nodale

Date : 2026-10-16. Statut : direction produit demandée explicitement par l’utilisateur ; implémentation planifiée, hors promotion Production.

## Contexte

L’utilisateur demande une plateforme d’orchestration multi-moteurs, un audit accessible comme skill/plugin, un système nodal fondé sur xyflow et Rete, puis une analyse et un plan avant de poursuivre la construction. Le parcours métier existant et le socle expérimental de dispatch Hermes ont des propriétaires et des preuves distincts.

## Décision

1. Positionner l’audit complet comme plugin métier de premier niveau et facultatif, avec façade et skills de méthode, en conservant ses services, règles, ROI, données et validations canoniques. Le runtime générique n’exige pas d’audit préalable.
2. Garder Auth/Organization/Company et les politiques de la plateforme dans le noyau partagé.
3. Définir un graphe neutre versionné et un seul canevas produit xyflow. Évaluer Rete pour des calculs purs par un POC d’adaptation ; il ne possède pas l’exécution durable des effets externes.
4. Conserver un propriétaire de mission globale Optivos ; les moteurs délégués gardent leurs sessions/identifiants sans reprise automatique susceptible de doubler une action.
5. Livrer les contrats avant le plugin en lecture et le canevas, puis la persistance/runtime et un parcours réel. Ne pas installer les bibliothèques ou réorganiser les modules dans cette mission de cadrage.

## Portée des décisions antérieures

La direction produit évolue vers la plateforme. Les invariants de domaine, couches, tenant, provenance, droits, statut SHADOW et absence de promotion automatique restent applicables. Les anciens documents agentiques restent des références de contrats ; leur ancien ordre de roadmap n’est pas une déclaration d’implémentation et doit être lu avec le nouveau plan. Aucun moteur parallèle ne remplace les moteurs métier.

## Conséquences

Un plugin ne se réduit pas à un prompt ; il requiert contrat, versions, activation et permissions. Deux représentations de graphe doivent passer par un adaptateur vérifié, pas par la persistance des objets internes d’une bibliothèque. Le runtime durable, les migrations/RLS et les connecteurs demeurent des lots non livrés. Le POC peut conduire à conserver xyflow sans Rete en exécution si son apport n’est pas démontré, sans changer les graphes métiers.

Références : [plan directeur](../architecture/optivos-platform-blueprint.md), [décision nodale](../architecture/nodal-system-decision.md), [contrat plugin audit](../architecture/audit-plugin-contract.md).
