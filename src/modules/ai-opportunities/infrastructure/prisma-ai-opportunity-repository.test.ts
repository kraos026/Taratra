import { describe, expect, it, vi } from "vitest";
import type { TransactionClient } from "@/infrastructure/database/with-authenticated-database";
import type { AiOpportunityEngine, AiOpportunityInput } from "../domain/ai-opportunity-engine";
import { PrismaAiOpportunityRepository } from "./prisma-ai-opportunity-repository";

type DetectionResult = ReturnType<AiOpportunityEngine["detect"]>;

describe("PrismaAiOpportunityRepository", () => {
  it("batches AI opportunities and child rows while preserving ranking and provenance", async () => {
    const db = {
      $executeRaw: vi.fn(),
      aiOpportunitySnapshot: {
        findFirst: vi.fn().mockResolvedValue({ versionNumber: 4 }),
        create: vi.fn().mockResolvedValue({ id: "00000000-0000-4000-8000-000000000010" }),
      },
      aiOpportunity: { create: vi.fn(), createMany: vi.fn() },
      aiOpportunityCapability: { createMany: vi.fn() },
      aiOpportunityEvidence: { createMany: vi.fn() },
      aiOpportunityScore: { createMany: vi.fn() },
      aiOpportunityPrerequisite: { createMany: vi.fn() },
      aiOpportunityValidation: { createMany: vi.fn() },
    };

    const snapshot = await new PrismaAiOpportunityRepository(
      db as unknown as TransactionClient,
    ).persist(
      "00000000-0000-4000-8000-000000000001",
      "00000000-0000-4000-8000-000000000002",
      "00000000-0000-4000-8000-000000000003",
      input(),
      detectionResult(),
      null,
    );

    expect(snapshot.id).toBe("00000000-0000-4000-8000-000000000010");
    expect(db.aiOpportunity.create).not.toHaveBeenCalled();
    expect(db.aiOpportunity.createMany).toHaveBeenCalledTimes(1);
    expect(db.aiOpportunityCapability.createMany).toHaveBeenCalledTimes(1);
    expect(db.aiOpportunityEvidence.createMany).toHaveBeenCalledTimes(1);
    expect(db.aiOpportunityScore.createMany).toHaveBeenCalledTimes(1);
    expect(db.aiOpportunityPrerequisite.createMany).toHaveBeenCalledTimes(1);
    expect(db.aiOpportunityValidation.createMany).toHaveBeenCalledTimes(1);

    const opportunityRows = db.aiOpportunity.createMany.mock.calls[0][0].data as Array<{
      id: string;
      identifier: string;
      businessImpact: number;
    }>;
    expect(opportunityRows.map((row) => row.identifier)).toEqual([
      "high_impact:process",
      "medium_impact:process",
    ]);
    expect(opportunityRows.map((row) => row.businessImpact)).toEqual([95, 70]);

    const idByIdentifier = new Map(opportunityRows.map((row) => [row.identifier, row.id]));
    expect(db.aiOpportunityCapability.createMany.mock.calls[0][0].data).toEqual([
      expect.objectContaining({
        opportunityId: idByIdentifier.get("high_impact:process"),
        capabilityId: "00000000-0000-4000-8000-000000000301",
      }),
      expect.objectContaining({
        opportunityId: idByIdentifier.get("medium_impact:process"),
        capabilityId: "00000000-0000-4000-8000-000000000302",
      }),
    ]);
    expect(db.aiOpportunityEvidence.createMany.mock.calls[0][0].data).toEqual([
      expect.objectContaining({
        opportunityId: idByIdentifier.get("high_impact:process"),
        businessFindingId: "00000000-0000-4000-8000-000000000101",
        knowledgeFactId: "00000000-0000-4000-8000-000000000201",
      }),
      expect.objectContaining({
        opportunityId: idByIdentifier.get("medium_impact:process"),
        businessFindingId: "00000000-0000-4000-8000-000000000102",
        knowledgeFactId: "00000000-0000-4000-8000-000000000202",
      }),
    ]);
  });
});

function input(): AiOpportunityInput {
  return {
    analysisId: "00000000-0000-4000-8000-000000000004",
    analysisStatus: "published",
    processMapId: "00000000-0000-4000-8000-000000000005",
    processMapStatus: "published",
    processName: "Invoice processing",
    processConfidence: 90,
    knowledgeSnapshotId: "00000000-0000-4000-8000-000000000006",
    findings: [],
    facts: [],
    capabilities: [],
    detectionRules: [],
    scoreDefinitions: [],
  };
}

function detectionResult(): DetectionResult {
  return {
    opportunities: [
      {
        identifier: "high_impact:process",
        title: "High impact",
        description: "High impact opportunity",
        businessProblem: "Approval delays",
        rule: {
          id: "00000000-0000-4000-8000-000000000401",
          code: "high_impact",
          version: 1,
        },
        capabilities: [{ id: "00000000-0000-4000-8000-000000000301" }],
        findings: [
          {
            id: "00000000-0000-4000-8000-000000000101",
            identifier: "approval_delay",
            factIds: ["00000000-0000-4000-8000-000000000201"],
          },
        ],
        evidenceFacts: [{ id: "00000000-0000-4000-8000-000000000201", key: "approval_delay" }],
        confidence: 90,
        feasibility: 80,
        businessImpact: 95,
        technicalComplexity: 30,
        dataReadiness: 85,
        aiReadiness: 82,
        implementationEffort: "medium",
        risk: "medium",
        processIds: ["00000000-0000-4000-8000-000000000005"],
        departmentIds: [],
        systemIds: [],
        prerequisites: [{ code: "invoice_data", description: "Invoice data", satisfied: true }],
        scores: [
          {
            definition: { id: "00000000-0000-4000-8000-000000000501" },
            score: 95,
            calculation: { source: "test" },
          },
        ],
      },
      {
        identifier: "medium_impact:process",
        title: "Medium impact",
        description: "Medium impact opportunity",
        businessProblem: "Manual checks",
        rule: {
          id: "00000000-0000-4000-8000-000000000402",
          code: "medium_impact",
          version: 1,
        },
        capabilities: [{ id: "00000000-0000-4000-8000-000000000302" }],
        findings: [
          {
            id: "00000000-0000-4000-8000-000000000102",
            identifier: "manual_check",
            factIds: ["00000000-0000-4000-8000-000000000202"],
          },
        ],
        evidenceFacts: [{ id: "00000000-0000-4000-8000-000000000202", key: "manual_check" }],
        confidence: 75,
        feasibility: 70,
        businessImpact: 70,
        technicalComplexity: 40,
        dataReadiness: 70,
        aiReadiness: 70,
        implementationEffort: "low",
        risk: "low",
        processIds: ["00000000-0000-4000-8000-000000000005"],
        departmentIds: [],
        systemIds: [],
        prerequisites: [{ code: "case_data", description: "Case data", satisfied: true }],
        scores: [
          {
            definition: { id: "00000000-0000-4000-8000-000000000502" },
            score: 70,
            calculation: { source: "test" },
          },
        ],
      },
    ],
    validations: [
      { code: "ai_opportunities_valid", severity: "information", message: "Traceable" },
    ],
    catalogVersions: {},
  } as unknown as DetectionResult;
}
