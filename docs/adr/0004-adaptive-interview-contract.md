# ADR-0004 — Contrat déterministe Adaptive Interview

- Statut : accepté
- Date : 2026-07-26

## Décision

Interview exige une Discovery validée, référence sa session et lit ses faits via un adaptateur.
Les branches et follow-ups utilisent un catalogue versionné et un DSL limité, sans LLM.
L'entretien possède ses réponses, décisions, preuves, progression et timeline, mais aucune copie
du profil Discovery.

La progression pondère les informations obligatoires. La confiance vaut 100% pour une preuve
validée ou confirmée, 50% pour une réponse incertaine et 0% pour une information manquante.
Process Mapping est prêt lorsque les informations obligatoires sont complètes et que la confiance
globale atteint 80%.

## Conséquences

- Process Mapping consommera uniquement les entretiens validés ;
- chaque décision de question conserve une raison explicable ;
- une réponse d'entretien ne modifie jamais Discovery implicitement ;
- tout enrichissement futur du DSL nécessite validation, tests et évolution de cet ADR.
