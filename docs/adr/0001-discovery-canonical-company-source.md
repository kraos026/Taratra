# ADR-0001 — Discovery est la source canonique des informations d'entreprise

- Statut : accepté
- Date : 2026-07-26

## Contexte

Le module Companies contient l'identité CRM tandis que Discovery structure la connaissance
opérationnelle nécessaire aux moteurs d'intelligence. Certaines colonnes historiques se
chevauchent.

## Décision

Discovery possède le profil opérationnel et toutes ses entités normalisées. Companies conserve
l'identité, les contacts, le statut commercial et l'archivage. Tout futur moteur lit Discovery via
un contrat dédié et référence la même entreprise par `company_id`.

## Conséquences

- aucun nouveau champ de profil n'est ajouté à Companies ou à un futur moteur ;
- les doublons historiques sont maintenus temporairement pour compatibilité, puis migrés ;
- une session validée constitue le point d'entrée par défaut des analyses futures ;
- une modification canonique passe par le bounded context Discovery.
