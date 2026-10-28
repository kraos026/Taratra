---
name: optivos-audit-plugin
description: Concevoir ou implémenter la façade plugin métier de l’audit Optivos et ses skills de méthode en réutilisant les services canoniques, leurs preuves et leurs permissions.
metadata:
  version: "0.1.0"
---

# Plugin métier d’audit Optivos

Lire le [contrat cible du plugin](../../../docs/architecture/audit-plugin-contract.md). Le plugin cible est `optivos.audit` ; l’entrée actuelle `optivos-audit / audit.open` est seulement une navigation. Le paquet de plugin, sa skill métier et ses outils ne sont pas rendus disponibles par un simple changement de libellé.

Identifier le cas d’usage et son propriétaire avant de l’exposer. Les lectures actuelles de référence passent par `withCompanyService`, `withRuleService` ou la frontière applicative du module concerné. Ne pas importer ses repositories/Prisma depuis un autre contexte et ne pas réimplémenter règles, ROI ou publication dans une skill.

Commencer par les lectures d’artefacts accessibles. Vérifier l’utilisateur, le tenant, le rôle, le dossier, l’audit, la version et leur lignée. Distinguer une source absente, non publiée, non autorisée et une sortie dérivée. Une synthèse conserve les références utiles sans exporter toutes les données du client.

Une skill métier fournit la méthode et les capacités demandées ; le runtime décide des permissions. Elle ne reçoit aucun credential et n’accorde pas `validate`, `publish` ou un accès réseau. Les mutations ultérieures réutilisent les préconditions et validations des services existants.

Avant de qualifier la façade de raccordée, comparer ses sorties aux sorties canoniques et vérifier les refus : autre tenant, audit d’un autre dossier, rôle insuffisant, version/ID invalide, artefact absent ou incompatible. Une lecture ne doit ni publier ni lancer une génération. Ne pas ajouter des tests qui recopient seulement la forme du manifeste.

L’installation/désactivation future d’un plugin ne supprime pas les dossiers ou résultats. Les skills de développement de ce dépôt ne sont pas des plugins clients ou des tools Hermes installés.
