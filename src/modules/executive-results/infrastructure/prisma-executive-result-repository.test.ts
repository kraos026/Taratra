import { describe, expect, it, vi } from "vitest";
import type { TransactionClient } from "@/infrastructure/database/with-authenticated-database";
import { AssistedAuditError } from "@/modules/assisted-audit/application/assisted-audit-errors";
const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("@/modules/assisted-audit/application/assisted-audit-service", () => ({
  AssistedAuditService: class {
    get = get;
  },
}));
import { PrismaExecutiveResultRepository } from "./prisma-executive-result-repository";

describe("executive result error distinction", () => {
  const repo = new PrismaExecutiveResultRepository({} as TransactionClient);
  it("returns absent only for company not found", async () => {
    get.mockRejectedValue(new AssistedAuditError("COMPANY_NOT_FOUND", "not found", 404));
    expect(await repo.read("user", "company")).toBeNull();
  });
  it.each([
    new Error("P2028"),
    new Error("database unavailable"),
    new AssistedAuditError("FORBIDDEN", "denied", 403),
  ])("propagates failures rather than inventing an empty result", async (error) => {
    get.mockRejectedValue(error);
    await expect(repo.read("user", "company")).rejects.toBe(error);
  });
});

describe("published implementation cost projection", () => {
  it.each([1000, 0, null])(
    "reads the scoped published metric without inventing a cost: %s",
    async (cost) => {
      get.mockResolvedValue({
        company: { id: "company", name: "Synthetic" },
        currentStage: "COMPLETED",
        stages: [
          "PROCESS_MAP",
          "BUSINESS_ANALYSIS",
          "AUTOMATION_OPPORTUNITIES",
          "ROI",
          "RECOMMENDATIONS",
        ].map((stage) => ({ stage, artifact: { id: stage } })),
      });
      const metrics =
        cost === null
          ? []
          : [{ evaluationId: "evaluation", code: "implementation_cost", value: cost }];
      const db = {
        organizationMember: { findFirst: vi.fn().mockResolvedValue({ organizationId: "tenant" }) },
        processMap: {
          findFirst: vi.fn().mockResolvedValue({ id: "PROCESS_MAP", name: "Invoices" }),
        },
        businessFinding: { findMany: vi.fn().mockResolvedValue([]) },
        automationOpportunity: { findMany: vi.fn().mockResolvedValue([]) },
        roiEvaluationSnapshot: {
          findFirst: vi.fn().mockResolvedValue({ id: "ROI", currency: "EUR" }),
        },
        roiScenario: { findFirst: vi.fn().mockResolvedValue({ id: "expected" }) },
        transformationRecommendation: { findMany: vi.fn().mockResolvedValue([]) },
        roiEvaluation: {
          findMany: vi
            .fn()
            .mockResolvedValue([
              { id: "evaluation", title: "Test", automationOpportunityId: "opportunity" },
            ]),
        },
        roiMetric: { findMany: vi.fn().mockResolvedValue(metrics) },
        automationOpportunityEvidence: { findMany: vi.fn().mockResolvedValue([]) },
        automationOpportunityConnector: { findMany: vi.fn().mockResolvedValue([]) },
        automationDetectionRuleCatalog: { findMany: vi.fn().mockResolvedValue([]) },
      };
      const result = await new PrismaExecutiveResultRepository(
        db as unknown as TransactionClient,
      ).read("user", "company");
      expect(result?.roi?.evaluations[0]?.implementationCost).toBe(cost);
      expect(db.roiMetric.findMany).toHaveBeenCalledWith({
        where: { snapshotId: "ROI", scenarioId: "expected", organizationId: "tenant" },
      });
    },
  );
});
