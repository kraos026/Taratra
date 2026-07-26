# AutomateX — Vision produit

## Mission

AutomateX transforme la connaissance d'une entreprise en informations structurées, explicables et
réutilisables pour identifier, prioriser et restituer des opportunités d'amélioration et
d'automatisation.

La plateforme est un SaaS multi-tenant destiné aux entreprises et aux consultants. Elle privilégie
la traçabilité, la sécurité, la déterminisme des décisions métier et la conservation de la
provenance des données.

## Enterprise Intelligence Engine

L'Enterprise Intelligence Engine est un ensemble de moteurs métier indépendants. Chaque moteur :

- possède son modèle, ses règles, ses services et ses tests ;
- consomme les contrats publiés par les moteurs en amont ;
- ne copie pas leurs données canoniques ;
- produit des résultats persistés et explicables ;
- reste indépendant de tout LLM pour les décisions métier.

Discovery est le premier moteur métier achevé. Il est la source canonique du profil d'entreprise,
de ses offres, départements, rôles, logiciels, processus, objectifs et difficultés.

## Principes non négociables

1. Supabase fournit PostgreSQL, Auth et la défense RLS.
2. Prisma fournit l'accès typé côté serveur, sous le contexte RLS de l'utilisateur.
3. Les migrations SQL Supabase sont la source de vérité du schéma déployé.
4. Aucune route utilisateur ne contourne la RLS avec une clé de service.
5. Les décisions métier sont déterministes et testables.
6. Un LLM peut expliquer, résumer, reformuler ou rédiger, jamais décider.
7. Les futurs moteurs consomment Discovery et ne recréent aucun profil d'entreprise parallèle.

## Direction officielle

Les prochains moteurs sont, dans l'ordre : Adaptive Interview, Process Mapping, Business
Intelligence, AI Opportunity, Automation Opportunity, ROI, Recommendation, puis Executive Report
v2. Cette séquence remplace les anciennes numérotations de sprint.
