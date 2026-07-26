# ADR-0006 — Process Mapping consomme exclusivement Enterprise Knowledge

- Statut : accepté
- Date : 2026-07-26

## Décision

Process Mapping reconstruit les processus uniquement depuis un snapshot Enterprise Knowledge
`ready`. Les patterns versionnés décrivent explicitement les faits attendus, leurs poids, le graphe
et les validations. Aucun accès à Discovery ou Interview n'est autorisé dans ce bounded context.

Chaque build crée une version draft et conserve les faits consommés, les faits ignorés, les raisons
de sélection et la version du pattern. Rebuild crée toujours une nouvelle version. Une publication
fige totalement graphe, validations, scores, provenance et pattern.

## Conséquences

- le moteur est déterministe, explicable et reproductible ;
- les cycles sont des warnings et non des erreurs bloquantes ;
- coverage et confiance sont calculés uniquement sur les faits pertinents pondérés ;
- les futurs moteurs consommeront uniquement des versions publiées et prêtes ;
- un changement de Knowledge ou de pattern requiert un rebuild explicite.
