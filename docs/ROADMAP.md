# Roadmap officielle

Cette roadmap remplace toutes les anciennes numérotations. Un sprint futur ne démarre qu'après
validation de son contrat d'entrée, de ses frontières métier et de ses critères de sécurité.

## Livré

- Sprint 1 — Foundation : Auth, multi-tenant, PostgreSQL, Prisma, CI/CD et tests.
- Sprint 2 — Audit Engine foundation : questionnaires versionnés, audits et réponses.
- Sprint 3 — Executive Report Layer v1 : ReportBuilder, dashboard, KPI, graphiques, résumé et API.
- Sprint 4 — Enterprise Discovery Engine : profil canonique, wizard, sessions, validation,
  verrouillage optimiste, REST, RLS et documentation.

## À venir

### Sprint 5 — Adaptive Interview Engine

Consomme le profil Discovery validé pour préparer et conduire des entretiens adaptatifs. Il
conserve les réponses d'entretien sans modifier les données canoniques Discovery implicitement.

### Sprint 6 — Process Mapping Engine

Construit une cartographie versionnée à partir des processus Discovery et des entretiens. Il ne
duplique ni le profil ni le catalogue des processus.

### Sprint 7 — Business Intelligence Engine

Produit des constats explicables depuis Discovery, Interview et Process Mapping. Une décision ADR
devra établir le devenir du Rule Engine préexistant.

### Sprint 8 — AI Opportunity Engine

Identifie des opportunités liées à l'IA à partir des constats structurés. Le terme « AI » décrit le
domaine d'opportunité ; toute décision reste gouvernée par des règles déterministes.

### Sprint 9 — Automation Opportunity Engine

Identifie et qualifie les opportunités d'automatisation indépendamment du moteur AI Opportunity.

### Sprint 10 — ROI Engine

Calcule des scénarios financiers explicables. Le moteur ROI MVP existant doit faire l'objet d'une
décision explicite de migration ou de remplacement.

### Sprint 11 — Recommendation Engine

Priorise les opportunités évaluées. Le moteur Recommendation MVP existant est provisoire jusqu'à
la définition de ce nouveau contrat.

### Sprint 12 — Executive Report v2

Projette les résultats persistés des moteurs précédents sans recalcul métier. Il succède à la
couche Report v1 et prépare les formats de restitution ultérieurs.

## Gates d'architecture

Pour chaque sprint :

- contrat d'entrée provenant des moteurs en amont ;
- absence de duplication des entités Discovery ;
- modèle tenant-scoped, contraintes composites et RLS testée ;
- décisions déterministes hors LLM ;
- migration Supabase et projection Prisma alignées ;
- tests unitaires, intégration, pgTAP, typecheck et build verts ;
- ADR lorsque la frontière ou le devenir d'un composant existant change.
