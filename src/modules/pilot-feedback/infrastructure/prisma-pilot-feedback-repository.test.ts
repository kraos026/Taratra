import { describe, expect, it, vi } from "vitest";
import type { TransactionClient } from "@/infrastructure/database/with-authenticated-database";
import { PrismaPilotFeedbackRepository } from "./prisma-pilot-feedback-repository";

const context = {
  organizationId: "11111111-1111-4111-8111-111111111111",
  companyId: "22222222-2222-4222-8222-222222222222",
  auditId: "33333333-3333-4333-8333-333333333333",
  executiveResultId: null,
  contextStatus: "AUDIT_IN_PROGRESS" as const,
};

const input = {
  companyId: context.companyId,
  understandingScore: 5,
  recommendationRelevanceScore: 4,
  roiCredibilityScore: 3,
  nextStepClarityScore: 4,
  experienceScore: 5,
  willingToPay: "YES" as const,
  acceptablePrice: 99,
  priceCurrency: "EUR",
};

describe("PrismaPilotFeedbackRepository", () => {
  it("falls back to same-user same-company pre-audit feedback", async () => {
    const preAudit = row({ auditId: null });
    const findFirst = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(preAudit);
    const repository = repositoryWith({ findFirst });

    await expect(repository.find("user-a", context)).resolves.toMatchObject({
      id: preAudit.id,
      auditId: null,
    });
    expect(findFirst).toHaveBeenNthCalledWith(2, {
      where: {
        userId: "user-a",
        companyId: context.companyId,
        auditId: null,
        organizationId: context.organizationId,
      },
    });
  });

  it("prefers current-audit feedback over the pre-audit fallback", async () => {
    const linked = row({ auditId: context.auditId });
    const findFirst = vi.fn().mockResolvedValueOnce(linked);
    const repository = repositoryWith({ findFirst });

    await expect(repository.find("user-a", context)).resolves.toMatchObject({
      id: linked.id,
      auditId: context.auditId,
    });
    expect(findFirst).toHaveBeenCalledTimes(1);
  });

  it("lazily attaches the pre-audit row on update instead of creating a duplicate", async () => {
    const preAudit = row({ auditId: null });
    const updated = row({ auditId: context.auditId });
    const findFirst = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: preAudit.id });
    const update = vi.fn().mockResolvedValue(updated);
    const create = vi.fn();
    const repository = repositoryWith({ findFirst, update, create });

    await expect(repository.save("user-a", context, input)).resolves.toMatchObject({
      id: preAudit.id,
      auditId: context.auditId,
    });
    expect(update).toHaveBeenCalledWith({
      where: { id: preAudit.id },
      data: expect.objectContaining({
        userId: "user-a",
        companyId: context.companyId,
        organizationId: context.organizationId,
        auditId: context.auditId,
      }),
    });
    expect(create).not.toHaveBeenCalled();
  });

  it("never reuses fallback feedback from another company or tenant", async () => {
    const findFirst = vi.fn().mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    const repository = repositoryWith({ findFirst });

    await expect(repository.find("user-a", context)).resolves.toBeNull();
    expect(findFirst).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: expect.objectContaining({
          userId: "user-a",
          companyId: context.companyId,
          organizationId: context.organizationId,
        }),
      }),
    );
  });
});

function repositoryWith(pilotFeedback: Record<string, unknown>) {
  return new PrismaPilotFeedbackRepository({ pilotFeedback } as unknown as TransactionClient);
}

function row(overrides: { auditId: string | null }) {
  return {
    id: "44444444-4444-4444-8444-444444444444",
    organizationId: context.organizationId,
    companyId: context.companyId,
    auditId: overrides.auditId,
    executiveResultId: null,
    userId: "user-a",
    contextStatus: "AUDIT_IN_PROGRESS",
    understandingScore: 5,
    recommendationRelevanceScore: 4,
    roiCredibilityScore: 3,
    nextStepClarityScore: 4,
    experienceScore: 5,
    willingToPay: "YES",
    acceptablePrice: { toNumber: () => 99 },
    priceCurrency: "EUR",
    comment: null,
    createdAt: new Date("2026-09-04T00:00:00.000Z"),
    updatedAt: new Date("2026-09-04T00:01:00.000Z"),
  };
}
