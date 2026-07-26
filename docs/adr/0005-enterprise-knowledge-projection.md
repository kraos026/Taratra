# ADR-0005 — Enterprise Knowledge comme projection canonique interne

- Statut : accepté
- Date : 2026-07-26

## Contexte

Discovery possède les informations canoniques d'entreprise et Interview possède les connaissances
collectées pendant les entretiens. Les moteurs futurs ne doivent ni interpréter les réponses
brutes indépendamment ni dupliquer les modèles sources.

## Décision

Enterprise Knowledge est un bounded context interne de projection. Il reçoit uniquement des
sessions validées, normalise leurs données en snapshots versionnés et immuables, et conserve pour
chaque fait sa source, sa preuve, sa confiance et les identifiants des enregistrements d'origine.

Les faits dérivés sont en lecture seule. Discovery et Interview restent propriétaires de leurs
données. Aucun moteur existant n'est redirigé vers cette projection dans cette évolution.

## Conséquences

- Process Mapping et les moteurs suivants liront un snapshot `ready` via un port dédié ;
- toute nouvelle collecte produit une nouvelle version au lieu de réécrire l'historique ;
- les sources futures sont extensibles sans perdre la provenance ;
- aucun endpoint public ni UI Enterprise Knowledge n'est créé ;
- les règles de fusion de faits contradictoires devront faire l'objet d'un ADR avant leur ajout.
