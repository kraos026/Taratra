# Atelier IA / Hermes — périmètre de l’intégration

MISSION: Réorganiser la navigation et ajouter le tableau Hermes Facile dans Optivos, sans modifier ses moteurs.
AFFECTED DOMAIN: Présentation, navigation, expérimentation des missions d’agents.
CANONICAL OWNER: Les services Auth/Organization/Company existants restent propriétaires de l’accès. Les moteurs d’audit, ROI et recommandation restent propriétaires des décisions.
CURRENT STATUS: SHADOW — démonstration, pas un runtime actif.
FILES EXPECTED: Module agent-workspace, pages Atelier IA, navigation des deux shells, proxy et documentation/tests associés.
DB IMPACT: Aucune migration ni écriture supplémentaire. La démonstration garde ses missions uniquement dans l’état React ; quitter ou actualiser la page les efface.
SECURITY IMPACT: Accès via Supabase et CompanyService existants ; identifiants d’entreprise vérifiés. Aucun secret fournisseur, appel de modèle ou outil externe. Accès expérimental désactivé par défaut et refusé en Production.
TEST PLAN: Contrôle du flag, accès à l’entreprise, isolation par contexte, états de simulation, liens/navigation, types/lint et aperçu visuel. La certification Supabase/RLS et STAGING du nouveau module reste NOT RUN tant qu’elle n’est pas exécutée.
OUT-OF-SCOPE: Moteurs, calculs, recommandations, campagne email, suppression de données, migrations, publication Production, activation de Hermes/OpenRouter/9Router/ArtCraft.

Base: `29ea642ba09215767258770d5e448fe9b0c0b6e2`. Travail isolé dans la branche `codex/optivos-hermes-ui`. Les fichiers de mesures non suivis du checkout principal restent en attente dans ce checkout ; ils ne sont ni incorporés ni modifiés.

Les échanges consultés confirment le positionnement: Optivos pour décider et spécifier ; un menu distinct « Atelier IA » pour les missions d’agents, avec « Studio créatif » comme extension éventuelle. Les anciennes certifications concernent leurs SHA et environnements, pas ce nouvel espace. Elles ne sont pas réutilisées comme preuve de certification.
