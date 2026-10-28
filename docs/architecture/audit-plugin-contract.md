# Plugin métier `optivos.audit` — contrat cible

État : spécification pour le lot A1/A2 du [plan directeur](optivos-platform-blueprint.md). La façade plugin et ses capacités ci-dessous ne sont pas encore implémentées. L’entrée actuelle `optivos-audit / audit.open` du catalogue reste une navigation.

## Paquet métier, moteur existant

Le plugin, facultatif pour la plateforme, regroupe le parcours d’audit de l’entreprise jusqu’au résultat exécutif. Il expose progressivement des capacités versionnées vers les services existants et embarque une skill de méthode pour guider collecte, explication et préparation des suites. Le moteur de règles, le calcul du ROI, les versions publiées et les validations restent propriétaires de leurs décisions. Les missions génériques, équipes Paperclip et workflows n8n ne nécessitent pas d’audit ; seuls les appels aux capacités métier de ce plugin exigent les références de dossier/audit correspondantes.

Identité cible : `optivos.audit`, version de paquet explicite, fournisseur propriétaire de la plateforme. Son descripteur devra déclarer compatibilité des contrats, capacités, schémas d’entrée/sortie, permissions demandées, niveaux d’effet, versions des skills associées et provenance. Ce nouveau contrat de plugin est distinct de `engineManifestSchema` v1 et ne doit pas lui être envoyé comme s’il était déjà pris en charge.

| Capacité envisagée          | Contrat actuel à envelopper                            | Nature et contrôle                                                                                                        |
| --------------------------- | ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------- |
| `company.read`              | `GET /api/companies/:id`, `withCompanyService`         | Lecture autorisée du dossier ; contexte minimal et permission existante                                                   |
| `audit.results.read`        | `GET /api/audits/:id/results`, `withRuleService`       | Lecture du résultat existant après vérification du tenant et de la lignée                                                 |
| `audit.summary.prepare`     | Résultat/version publié autorisé + skill d’explication | Brouillon dérivé avec références ; aucune modification de la source                                                       |
| `audit.validate`            | `POST /api/audits/:id/validate`, `withAuditService`    | Mutation métier ultérieure, conservant le rôle et les préconditions du service ; jamais activée par une simple skill      |
| Étapes Discovery → résultat | Ports publics des modules concernés                    | Une capacité à la fois après identification de son propriétaire ; pas d’accès direct aux repositories d’un autre contexte |

Les premières capacités ouvertes au runtime seront en lecture seulement. La définition exacte des DTO et de la disponibilité des artefacts publiés sera testée en A1/A2 contre les routes et services actuels : ces noms cibles n’inventent pas un endpoint déjà livré.

## Contexte et lignée

Contexte serveur : utilisateur, organisation, rôle et workspace. Références métier : dossier, audit et version d’artefact. Le serveur doit établir la relation entre ces références ; le fait qu’un utilisateur puisse lire deux dossiers ne l’autorise pas à attribuer le résultat du premier au second. Refuser les références incompatibles, les artefacts non accessibles ou dont l’état requis n’est pas satisfait. La capacité n’accepte jamais un `organizationId`, un rôle ou un auteur fourni par un agent comme preuve de droit.

Une sortie contient les identifiants/version de source et les faits accessibles nécessaires. Un artefact manquant produit un état « source manquante », sans inventer de résultat. L’explication ou le brouillon est marqué dérivé ; elle ne remplace ni la confiance, ni les hypothèses, ni la décision métier publiée.

## Skill métier et skills de développement

La future skill d’agent `audit.explain-published-results` charge uniquement les sources autorisées nécessaires, explique observations/hypothèses/manques et prépare des questions. Elle ne calcule pas un second ROI, ne valide pas un audit et ne possède aucune clé. Elle référence des capacités demandées ; le runtime accorde ou refuse leur usage selon l’espace et la mission.

Les skills créées maintenant dans `.codex/skills` servent au développement de cette façade et du runtime ; leur présence ne les publie pas dans le catalogue client et n’active pas les tools Hermes.

## Sortie du lot lecture

- Même résultat et mêmes références que les services canoniques sur les cas représentatifs ; aucun nouveau calcul métier.
- Tests de refus : non authentifié, autre tenant, rôle insuffisant, audit d’un autre dossier, artefact absent/non publié, version incompatible et ID invalide.
- Comparaison des sorties dérivées : sources traçables, contexte borné, données sensibles exclues selon le contrat.
- Aucun effet en lecture : pas de validation, publication, génération payante ou modification des dossiers.
- Activation client distincte de la disponibilité technique ; désactiver le plugin ne supprime pas les données et ne contourne pas les permissions du parcours existant.
