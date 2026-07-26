# Business Analysis Engine

Sprint 7 adds deterministic reasoning over published Process Maps and their Enterprise Knowledge
snapshots. Discovery and Interview are forbidden dependencies.

The catalog contains 19 named MVP rules (the specification says 18 but names 19). Rules expose
operators and thresholds in `evaluation_logic`. Findings preserve rule version, process, optional
step/department/actor/system references and Knowledge evidence. Score formulas and contributions
are stored in `calculation_json`.

Lifecycle: `draft -> validated -> published -> archived`. Rebuild creates a new draft.
Consultants, admins and owners analyze, rebuild and validate; admins and owners publish; viewers
read. Published snapshots and their children are database-immutable.

Routes: analyze a Process Map, rebuild/validate/publish/get an analysis, and list company analyses.
The read-only explorer is `/analysis/:id`.
