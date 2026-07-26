# ADR-0003 — Moteurs indépendants et réalignement de la roadmap

- Statut : accepté
- Date : 2026-07-26

## Contexte

Le dépôt possède des moteurs Rules, ROI et Recommendation antérieurs à la roadmap officielle.
Les futurs moteurs doivent former une chaîne explicable fondée sur Discovery, sans devenir un
monolithe partagé.

## Décision

Chaque moteur futur est un bounded context indépendant avec un contrat d'entrée versionné. Les
implémentations Rules/ROI/Recommendations existantes sont maintenues comme v1 provisoire, sans
extension structurelle, jusqu'aux décisions de migration des Sprints 7, 10 et 11.

## Conséquences

- le code existant reste fonctionnel et testé ;
- sa présence ne signifie pas que les sprints futurs sont livrés ;
- chaque sprint concerné commence par un ADR « migrer, adapter ou remplacer » ;
- Executive Report v2 lit des résultats persistés et ne réexécute aucun moteur.
