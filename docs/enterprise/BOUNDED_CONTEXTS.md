# Bounded Context Catalog

Status: **Implemented**

| Context                  | State       | Canonical responsibility                                                                  |
| ------------------------ | ----------- | ----------------------------------------------------------------------------------------- |
| Foundation/Onboarding    | Implemented | atomic account, organization and owner foundation                                         |
| Companies                | Implemented | CRM identity and company lifecycle                                                        |
| Questionnaires/Audits    | Implemented | versioned audit definitions, sessions and answers                                         |
| Discovery                | Implemented | canonical company profile                                                                 |
| Adaptive Interview       | Implemented | deterministic adaptive collection                                                         |
| Enterprise Knowledge     | Implemented | normalized, versioned facts with provenance                                               |
| Process Mapping          | Implemented | process graphs from ready Knowledge snapshots                                             |
| Business Analysis        | Implemented | deterministic findings and health dimensions                                              |
| AI Opportunity           | Implemented | explainable AI opportunity detection without LLM decisions                                |
| Automation Opportunity   | Implemented | explainable automation opportunities                                                      |
| ROI Evaluations          | Implemented | versioned deterministic economic evaluation                                               |
| Recommendation Portfolio | Implemented | priorities, dependencies and transformation roadmap                                       |
| Solution Designer        | Implemented | published solution blueprints                                                             |
| Automation Specification | Implemented | abstract specifications from published blueprints                                         |
| Automation Generator     | In Progress | Domain/Application/Infrastructure/Composition implemented; real compiler and REST planned |
| Sandbox Validation       | Planned     | future validation of generated artifacts                                                  |
| Platform Compilation     | Planned     | future provider-specific artifact generation                                              |
| Deployment/Monitoring    | Planned     | future controlled execution and observability                                             |
| Enterprise Simulator     | Planned     | separately proposed internal validation tool; not in this repo                            |
