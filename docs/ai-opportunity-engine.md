# AI Opportunity Engine

The engine deterministically detects realistic AI use cases from published Business Analysis,
published Process Mapping and referenced Enterprise Knowledge.

It ships 19 versioned capabilities, 14 versioned detection rules and six versioned score
definitions. Every opportunity retains related findings, Knowledge evidence, capabilities,
affected processes/departments/systems, prerequisites and visible score calculations.

Scores are 0–100. Impact maps finding severity; complexity maps the five approved effort bands;
data readiness measures required-data coverage; confidence combines finding and evidence
confidence; feasibility applies the approved 35/25/25/15 weights; AI readiness averages data
readiness, feasibility and Knowledge confidence.

Lifecycle is `draft -> validated -> published -> archived`. Consultants, admins and owners detect,
rebuild and validate. Only admins and owners publish. Viewers read. Published results are
database-immutable. The read-only explorer is `/ai-opportunities/:id`.
