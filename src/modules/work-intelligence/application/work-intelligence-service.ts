import {
  type ActivityNormalizer,
  type WorkActivityCorrection,
  type WorkActivityInput,
  WorkActivity,
  WorkIntelligenceError,
} from "../domain/work-intelligence";
import type {
  WorkActivityIdentityProvider,
  WorkActivityRepository,
  WorkIntelligenceClock,
  WorkIntelligenceRetentionPolicyResolver,
} from "./work-activity-repository";

export type CaptureWorkActivityInput = Omit<
  WorkActivityInput,
  "activityId" | "lineageId" | "version" | "normalizedActivity" | "category" | "confidence"
> & { confidence?: number };

export class WorkIntelligenceService {
  constructor(
    private readonly repository: WorkActivityRepository,
    private readonly normalizer: ActivityNormalizer,
    private readonly identities: WorkActivityIdentityProvider,
    private readonly clock: WorkIntelligenceClock,
    private readonly retentionPolicies?: WorkIntelligenceRetentionPolicyResolver,
  ) {}

  async capture(input: CaptureWorkActivityInput): Promise<WorkActivity> {
    const activity = await this.build(input);
    await this.repository.append(activity, 0);
    return activity;
  }

  async captureDay(inputs: readonly CaptureWorkActivityInput[]): Promise<readonly WorkActivity[]> {
    const activities = await Promise.all(inputs.map((input) => this.build(input)));
    await this.repository.appendBatch(activities);
    return Object.freeze(activities);
  }

  async confirm(tenantId: string, companyId: string, lineageId: string): Promise<WorkActivity> {
    const current = await this.requireLatest(tenantId, companyId, lineageId);
    const confirmed = current.confirm(this.identities.nextId());
    await this.repository.append(confirmed, current.version);
    return confirmed;
  }

  async correct(
    tenantId: string,
    companyId: string,
    lineageId: string,
    correction: WorkActivityCorrection,
  ): Promise<WorkActivity> {
    const current = await this.requireLatest(tenantId, companyId, lineageId);
    const corrected = current.correct(this.identities.nextId(), correction);
    await this.repository.append(corrected, current.version);
    return corrected;
  }

  private async build(input: CaptureWorkActivityInput): Promise<WorkActivity> {
    const normalized = this.normalizer.normalize(input.originalDescription);
    const retentionPolicy = this.retentionPolicies
      ? await this.retentionPolicies.currentPublishedPolicy(input.tenantId)
      : null;
    return WorkActivity.create({
      ...input,
      activityId: this.identities.nextId(),
      normalizedActivity: normalized.normalizedActivity,
      category: normalized.category,
      confidence: input.confidence ?? normalized.confidence,
      provenance: [
        ...input.provenance,
        `normalization:${normalized.ruleVersion}`,
        `captured-at:${this.clock.now().toISOString()}`,
      ],
      retentionPolicy: retentionPolicy
        ? { policyId: retentionPolicy.policyId, version: retentionPolicy.version }
        : undefined,
    });
  }

  private async requireLatest(
    tenantId: string,
    companyId: string,
    lineageId: string,
  ): Promise<WorkActivity> {
    const activity = await this.repository.latest(tenantId, companyId, lineageId);
    if (!activity) throw new WorkIntelligenceError("Work activity not found in tenant scope");
    return activity;
  }
}
