import type { WorkActivity } from "../domain/work-intelligence";

export interface WorkActivityRepository {
  append(activity: WorkActivity, expectedVersion: number): Promise<void>;
  appendBatch(activities: readonly WorkActivity[]): Promise<void>;
  get(tenantId: string, companyId: string, activityId: string): Promise<WorkActivity | null>;
  latest(tenantId: string, companyId: string, lineageId: string): Promise<WorkActivity | null>;
  list(tenantId: string, companyId: string): Promise<readonly WorkActivity[]>;
  history(tenantId: string, companyId: string, lineageId: string): Promise<readonly WorkActivity[]>;
}

export interface WorkIntelligenceClock {
  now(): Date;
}

export interface WorkActivityIdentityProvider {
  nextId(): string;
}

export interface WorkIntelligenceRetentionPolicy {
  readonly policyId: string;
  readonly policyKey: string;
  readonly version: number;
}

export interface WorkIntelligenceRetentionPolicyResolver {
  currentPublishedPolicy(tenantId: string): Promise<WorkIntelligenceRetentionPolicy>;
}
