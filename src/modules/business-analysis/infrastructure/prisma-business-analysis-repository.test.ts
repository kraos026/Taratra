import { describe, expect, it, vi } from "vitest";
import type { TransactionClient } from "@/infrastructure/database/with-authenticated-database";
import type { AnalysisInput, BusinessAnalysisEngine } from "../domain/business-analysis-engine";
import { PrismaBusinessAnalysisRepository } from "./prisma-business-analysis-repository";

type AnalysisResult = ReturnType<BusinessAnalysisEngine["analyze"]>;

describe("PrismaBusinessAnalysisRepository", () => {
  it("batches business findings and evidence while preserving ordering and provenance", async () => {
    const db = {
      $executeRaw: vi.fn(),
      analysisSnapshot: {
        findFirst: vi.fn().mockResolvedValue({ versionNumber: 2 }),
        create: vi.fn().mockResolvedValue({ id: "00000000-0000-4000-8000-000000000010" }),
      },
      businessFinding: { createMany: vi.fn() },
      findingEvidence: { createMany: vi.fn() },
      businessScore: { createMany: vi.fn() },
      businessHealth: { createMany: vi.fn() },
      analysisValidation: { createMany: vi.fn() },
    };

    const analysis = await new PrismaBusinessAnalysisRepository(
      db as unknown as TransactionClient,
    ).persist(
      "00000000-0000-4000-8000-000000000001",
      "00000000-0000-4000-8000-000000000002",
      "00000000-0000-4000-8000-000000000003",
      "00000000-0000-4000-8000-000000000004",
      "00000000-0000-4000-8000-000000000005",
      analysisInput(),
      analysisResult(),
      null,
    );

    expect(analysis.id).toBe("00000000-0000-4000-8000-000000000010");
    expect(db.businessFinding.createMany).toHaveBeenCalledTimes(1);
    expect(db.findingEvidence.createMany).toHaveBeenCalledTimes(1);
    const findingRows = db.businessFinding.createMany.mock.calls[0][0].data as Array<{
      id: string;
      identifier: string;
      severity: string;
      riskPoints: number;
    }>;
    expect(findingRows.map((row) => row.identifier)).toEqual(["approval_delay", "manual_rework"]);
    expect(findingRows.map((row) => row.severity)).toEqual(["critical", "high"]);
    const idByIdentifier = new Map(findingRows.map((row) => [row.identifier, row.id]));
    expect(db.findingEvidence.createMany.mock.calls[0][0].data).toEqual([
      expect.objectContaining({
        findingId: idByIdentifier.get("approval_delay"),
        knowledgeFactId: "00000000-0000-4000-8000-000000000101",
      }),
      expect.objectContaining({
        findingId: idByIdentifier.get("manual_rework"),
        knowledgeFactId: "00000000-0000-4000-8000-000000000102",
      }),
    ]);
    expect(db.businessScore.createMany).toHaveBeenCalledTimes(1);
    expect(db.businessHealth.createMany).toHaveBeenCalledTimes(1);
    expect(db.analysisValidation.createMany).toHaveBeenCalledTimes(1);
  });
});

function analysisInput(): AnalysisInput {
  return {
    processMap: {
      id: "00000000-0000-4000-8000-000000000004",
      name: "Invoice processing",
      status: "published",
      completeness: 90,
      confidence: 85,
      coverage: 80,
      ownerId: null,
      systemIds: [],
      validationCodes: [],
    },
    nodes: [],
    facts: [],
    rules: [
      {
        id: "00000000-0000-4000-8000-000000000201",
        code: "approval_delay",
        version: 1,
        title: "Approval delay",
        description: "Delay",
        severity: "critical",
        category: "bottleneck",
        evaluationLogic: {},
        explanationTemplate: "Delay",
        recommendationHint: "Fix approval",
      },
    ],
  } as unknown as AnalysisInput;
}

function analysisResult(): AnalysisResult {
  return {
    findings: [
      {
        rule: {
          id: "00000000-0000-4000-8000-000000000201",
          code: "approval_delay",
          version: 1,
          title: "Approval delay",
          severity: "critical",
          category: "bottleneck",
        },
        identifier: "approval_delay",
        description: "Approvals wait too long.",
        relatedStepId: "00000000-0000-4000-8000-000000000301",
        relatedDepartmentId: null,
        relatedActorId: null,
        relatedSystemId: null,
        confidence: 91,
        businessImpact: "High queue impact",
        riskPoints: 95,
        evidenceFactIds: ["00000000-0000-4000-8000-000000000101"],
        evidence: { reason: "Observed queue" },
      },
      {
        rule: {
          id: "00000000-0000-4000-8000-000000000202",
          code: "manual_rework",
          version: 1,
          title: "Manual rework",
          severity: "high",
          category: "quality",
        },
        identifier: "manual_rework",
        description: "Manual correction is frequent.",
        relatedStepId: null,
        relatedDepartmentId: null,
        relatedActorId: null,
        relatedSystemId: null,
        confidence: 82,
        businessImpact: "Rework cost",
        riskPoints: 70,
        evidenceFactIds: ["00000000-0000-4000-8000-000000000102"],
        evidence: { reason: "Manual correction" },
      },
    ],
    scores: [
      {
        code: "automation_readiness",
        label: "Automation readiness",
        score: 75,
        direction: "higher_is_better",
        calculation: { formula: "example", contributions: [] },
      },
    ],
    health: [
      {
        dimension: "control",
        scopeType: "process",
        scopeReferenceId: null,
        score: 80,
        calculation: { formula: "example" },
      },
    ],
    validations: [{ code: "traceable", severity: "info", message: "Traceable" }],
  } as unknown as AnalysisResult;
}
