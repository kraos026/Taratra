export * from "./domain/company-intake";
export * from "./application/company-intake-repository";
export * from "./application/intake-readiness";
export * from "./application/intake-interpretation-adapter";
export * from "./application/real-company-brain-orchestrator";
export * from "./application/adaptive-discovery-production-bridge";
export * from "./application/approved-discovery-action-write-bridge";
export * from "./application/discovery-response-processing";
export * from "./application/closed-loop-discovery-orchestrator";
export * from "./application/production-evidence-ingestion";
export * from "./application/economic-evidence-bridge";
export * from "./application/real-company-audit-pilot";
export * from "./application/executive-decision-view";
export * from "./infrastructure/in-memory-company-intake-repository";

// This module is an application adaptation boundary only. Canonical
// persistence remains in companies, discovery, interviews and knowledge.
