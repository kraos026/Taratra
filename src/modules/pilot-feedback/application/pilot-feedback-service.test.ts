import { describe, expect, it } from "vitest";
import type { PilotFeedbackContext, PilotFeedbackRepository } from "./pilot-feedback-repository";
import type { PilotFeedbackInput, PilotFeedbackView } from "./pilot-feedback-schema";
import { PilotFeedbackNotFoundError, PilotFeedbackService } from "./pilot-feedback-service";

const input: PilotFeedbackInput = {
  companyId: "11111111-1111-4111-8111-111111111111",
  understandingScore: 5,
  recommendationRelevanceScore: 4,
  roiCredibilityScore: 3,
  nextStepClarityScore: 4,
  experienceScore: 5,
  willingToPay: "YES",
  acceptablePrice: 99,
  priceCurrency: "EUR",
};

class MemoryRepository implements PilotFeedbackRepository {
  records = new Map<string, PilotFeedbackView>();
  saveCalls = 0;
  constructor(private readonly allowedUser = "tenant-a") {}
  async resolveContext(userId: string, companyId: string): Promise<PilotFeedbackContext | null> {
    if (userId !== this.allowedUser || companyId !== input.companyId) return null;
    return {
      organizationId: "org-a",
      companyId,
      auditId: "audit-a",
      executiveResultId: null,
      contextStatus: "AUDIT_COMPLETE",
    };
  }
  async find(userId: string, context: PilotFeedbackContext) {
    return this.records.get(`${userId}:${context.auditId}`) ?? null;
  }
  async save(userId: string, context: PilotFeedbackContext, value: PilotFeedbackInput) {
    this.saveCalls += 1;
    const key = `${userId}:${context.auditId}`;
    const previous = this.records.get(key);
    const record: PilotFeedbackView = {
      ...value,
      id: previous?.id ?? "feedback-a",
      auditId: context.auditId,
      executiveResultId: null,
      contextStatus: context.contextStatus,
      createdAt: previous?.createdAt ?? "2026-09-03T00:00:00.000Z",
      updatedAt: "2026-09-03T00:01:00.000Z",
    };
    this.records.set(key, record);
    return record;
  }
}

describe("PilotFeedbackService", () => {
  it("creates, retrieves and updates one feedback for the authenticated user and audit", async () => {
    const repository = new MemoryRepository();
    const service = new PilotFeedbackService(repository, "tenant-a");
    const created = await service.save(input);
    const updated = await service.save({ ...input, experienceScore: 4 });
    expect(await service.get(input.companyId)).toEqual(updated);
    expect(created.id).toBe(updated.id);
    expect(updated.experienceScore).toBe(4);
    expect(repository.records).toHaveLength(1);
    expect(repository.saveCalls).toBe(2);
  });

  it("does not expose or accept another tenant company", async () => {
    const repository = new MemoryRepository();
    const tenantB = new PilotFeedbackService(repository, "tenant-b");
    await expect(tenantB.get(input.companyId)).rejects.toBeInstanceOf(PilotFeedbackNotFoundError);
    await expect(tenantB.save(input)).rejects.toBeInstanceOf(PilotFeedbackNotFoundError);
  });
});
