export * from "./domain/company-intake";
export * from "./application/company-intake-repository";
export * from "./application/intake-readiness";
export * from "./application/intake-interpretation-adapter";
export * from "./application/real-company-brain-orchestrator";
export * from "./application/adaptive-discovery-production-bridge";
export * from "./application/approved-discovery-action-write-bridge";
export * from "./application/discovery-response-processing";
export * from "./application/closed-loop-discovery-orchestrator";
export * from "./application/adaptive-interview-intelligence";
export * from "./application/solution-strategy-generation";
export * from "./application/ask-automatex";
export * from "./application/production-evidence-ingestion";
export * from "./application/economic-evidence-bridge";
export * from "./application/real-company-audit-pilot";
export * from "./application/executive-decision-view";
export * from "./application/production-executive-decision-view";
export * from "./application/executive-explanation-service";
export * from "./application/patron-decision-center";
export * from "./infrastructure/in-memory-company-intake-repository";
export * from "./infrastructure/prisma-patron-decision-center-read-model";

// This module is an application adaptation boundary only. Canonical
// persistence remains in companies, discovery, interviews and knowledge.
