export * from "./domain/company-intake";
export * from "./application/company-intake-repository";
export * from "./application/intake-readiness";
export * from "./application/intake-interpretation-adapter";
export * from "./infrastructure/in-memory-company-intake-repository";

// This module is an application adaptation boundary only. Canonical
// persistence remains in companies, discovery, interviews and knowledge.
