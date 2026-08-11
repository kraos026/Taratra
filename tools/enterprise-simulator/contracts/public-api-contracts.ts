export const ENTERPRISE_SIMULATOR_HEADERS = {
  correlationId: "X-Correlation-ID",
  idempotencyKey: "Idempotency-Key",
  idempotencyReplayed: "Idempotency-Replayed",
} as const;

export const ENTERPRISE_SIMULATOR_ENDPOINTS = {
  latestReadyKnowledgeSnapshot: (companyId: string) =>
    `/api/companies/${companyId}/knowledge-snapshots/latest?status=ready`,
  createSyntheticTenant: (simulationRunId: string) =>
    `/api/test-support/simulation-runs/${simulationRunId}/tenant`,
  cleanupSyntheticTenant: (simulationRunId: string) =>
    `/api/test-support/simulation-runs/${simulationRunId}/tenant`,
  cleanupStatus: (simulationRunId: string) =>
    `/api/test-support/simulation-runs/${simulationRunId}/cleanup`,
  createSyntheticIdentity: (simulationRunId: string) =>
    `/api/test-support/simulation-runs/${simulationRunId}/identities`,
  revokeSyntheticIdentity: (simulationRunId: string, identityId: string) =>
    `/api/test-support/simulation-runs/${simulationRunId}/identities/${identityId}`,
} as const;

export const SYNTHETIC_TENANT_CLASSIFICATION = "SYNTHETIC_TEST" as const;
export const SYNTHETIC_IDENTITY_PROVENANCE = "ENTERPRISE_SIMULATOR" as const;
export const SYNTHETIC_CLEANUP_PERMISSION = "synthetic_test:cleanup" as const;
export const IDEMPOTENCY_MINIMUM_RETENTION_HOURS = 48;
export const SYNTHETIC_IDENTITY_MAXIMUM_LIFETIME_HOURS = 24;

export type EnterpriseSimulatorContractError =
  | "KNOWLEDGE_QUERY_INVALID"
  | "READY_KNOWLEDGE_SNAPSHOT_NOT_FOUND"
  | "ENVIRONMENT_FORBIDDEN"
  | "SYNTHETIC_CLEANUP_FORBIDDEN"
  | "SYNTHETIC_TENANT_NOT_FOUND"
  | "TENANT_CLASSIFICATION_MISMATCH"
  | "SIMULATION_RUN_MISMATCH"
  | "CLEANUP_IN_PROGRESS"
  | "WORKLOAD_IDENTITY_FORBIDDEN"
  | "IDENTITY_ALREADY_EXISTS"
  | "ROLE_NOT_ALLOWED"
  | "IDEMPOTENCY_KEY_REQUIRED"
  | "IDEMPOTENCY_KEY_INVALID"
  | "IDEMPOTENCY_KEY_REUSED"
  | "IDEMPOTENCY_IN_PROGRESS"
  | "IDEMPOTENCY_STORE_UNAVAILABLE"
  | "CORRELATION_ID_INVALID"
  | "CORRELATION_ID_REQUIRED"
  | "CORRELATION_RUN_MISMATCH";
