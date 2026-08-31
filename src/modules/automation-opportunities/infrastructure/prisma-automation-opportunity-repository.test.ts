import { describe, expect, it, vi } from "vitest";
import type { TransactionClient } from "@/infrastructure/database/with-authenticated-database";
import type {
  AutomationInput,
  AutomationOpportunityEngine,
} from "../domain/automation-opportunity-engine";
import { PrismaAutomationOpportunityRepository } from "./prisma-automation-opportunity-repository";

type DetectionResult = ReturnType<AutomationOpportunityEngine["detect"]>;

describe("PrismaAutomationOpportunityRepository", () => {
  it("batches automation opportunities and child rows while preserving ranking and provenance", async () => {
    const db = {
      $executeRaw: vi.fn(),
      automationOpportunitySnapshot: {
        findFirst: vi.fn().mockResolvedValue({ versionNumber: 3 }),
        create: vi.fn().mockResolvedValue({ id: "00000000-0000-4000-8000-000000000010" }),
      },
      automationOpportunity: { create: vi.fn(), createMany: vi.fn() },
      automationOpportunityConnector: { createMany: vi.fn() },
      automationOpportunityAiLink: { createMany: vi.fn() },
      automationOpportunityEvidence: { createMany: vi.fn() },
      automationOpportunityScore: { createMany: vi.fn() },
      automationOpportunityValidation: { createMany: vi.fn() },
    };

    const snapshot = await new PrismaAutomationOpportunityRepository(
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
    expect(db.automationOpportunity.create).not.toHaveBeenCalled();
    expect(db.automationOpportunity.createMany).toHaveBeenCalledTimes(1);
    expect(db.automationOpportunityConnector.createMany).toHaveBeenCalledTimes(1);
    expect(db.automationOpportunityAiLink.createMany).toHaveBeenCalledTimes(1);
    expect(db.automationOpportunityEvidence.createMany).toHaveBeenCalledTimes(1);
    expect(db.automationOpportunityScore.createMany).toHaveBeenCalledTimes(1);
    expect(db.automationOpportunityValidation.createMany).toHaveBeenCalledTimes(1);

    const opportunityRows = db.automationOpportunity.createMany.mock.calls[0][0].data as Array<{
      id: string;
      identifier: string;
      businessImpact: number;
    }>;
    expect(opportunityRows.map((row) => row.identifier)).toEqual([
      "invoice_automation:process",
      "case_routing:process",
    ]);
    expect(opportunityRows.map((row) => row.businessImpact)).toEqual([95, 70]);

    const idByIdentifier = new Map(opportunityRows.map((row) => [row.identifier, row.id]));
    expect(db.automationOpportunityConnector.createMany.mock.calls[0][0].data).toEqual([
      expect.objectContaining({
        opportunityId: idByIdentifier.get("invoice_automation:process"),
        connectorId: "00000000-0000-4000-8000-000000000501",
      }),
      expect.objectContaining({
        opportunityId: idByIdentifier.get("case_routing:process"),
        connectorId: "00000000-0000-4000-8000-000000000502",
      }),
    ]);
    expect(db.automationOpportunityAiLink.createMany.mock.calls[0][0].data).toEqual([
      expect.objectContaining({
        opportunityId: idByIdentifier.get("invoice_automation:process"),
        aiOpportunityId: "00000000-0000-4000-8000-000000000601",
      }),
    ]);
    expect(db.automationOpportunityEvidence.createMany.mock.calls[0][0].data).toEqual([
      expect.objectContaining({
        opportunityId: idByIdentifier.get("invoice_automation:process"),
        businessFindingId: "00000000-0000-4000-8000-000000000101",
        knowledgeFactId: "00000000-0000-4000-8000-000000000201",
      }),
      expect.objectContaining({
        opportunityId: idByIdentifier.get("case_routing:process"),
        businessFindingId: "00000000-0000-4000-8000-000000000102",
        knowledgeFactId: "00000000-0000-4000-8000-000000000202",
      }),
    ]);
  });
});

function input(): AutomationInput {
  return {
    aiSnapshotId: "00000000-0000-4000-8000-000000000004",
    aiSnapshotStatus: "published",
    analysisId: "00000000-0000-4000-8000-000000000005",
    analysisStatus: "published",
    processMapId: "00000000-0000-4000-8000-000000000006",
    processMapStatus: "published",
    knowledgeSnapshotId: "00000000-0000-4000-8000-000000000007",
    findings: [],
    facts: [],
    aiOpportunities: [],
    patterns: [],
    connectors: [],
    rules: [],
    scoreDefinitions: [],
  };
}

function detectionResult(): DetectionResult {
  return {
    opportunities: [
      {
        identifier: "invoice_automation:process",
        title: "Invoice automation",
        description: "Automate invoice handling",
        businessProblem: "Manual invoice work",
        pattern: { id: "00000000-0000-4000-8000-000000000401" },
        rule: {
          id: "00000000-0000-4000-8000-000000000301",
          code: "invoice_automation",
          version: 1,
        },
        connectors: [
          {
            connector: { id: "00000000-0000-4000-8000-000000000501" },
            available: true,
          },
        ],
        aiLinks: [{ id: "00000000-0000-4000-8000-000000000601" }],
        findings: [
          {
            id: "00000000-0000-4000-8000-000000000101",
            factIds: ["00000000-0000-4000-8000-000000000201"],
          },
        ],
        evidence: [{ id: "00000000-0000-4000-8000-000000000201", key: "invoice_volume" }],
        triggerType: "Scheduled",
        actions: ["Read", "Transform"],
        outputs: ["validated_invoice"],
        businessImpact: 95,
        automationCoverage: 80,
        technicalFeasibility: 75,
        connectorAvailability: 100,
        automationReadiness: 88,
        complexity: 40,
        confidence: 82,
        implementationEffort: "low",
        processIds: ["00000000-0000-4000-8000-000000000006"],
        departmentIds: [],
        systemIds: [],
        scores: [
          {
            definition: { id: "00000000-0000-4000-8000-000000000701" },
            score: 95,
            calculation: { source: "test" },
          },
        ],
      },
      {
        identifier: "case_routing:process",
        title: "Case routing",
        description: "Route cases",
        businessProblem: "Manual routing",
        pattern: { id: "00000000-0000-4000-8000-000000000402" },
        rule: { id: "00000000-0000-4000-8000-000000000302", code: "case_routing", version: 1 },
        connectors: [
          {
            connector: { id: "00000000-0000-4000-8000-000000000502" },
            available: false,
          },
        ],
        aiLinks: [],
        findings: [
          {
            id: "00000000-0000-4000-8000-000000000102",
            factIds: ["00000000-0000-4000-8000-000000000202"],
          },
        ],
        evidence: [{ id: "00000000-0000-4000-8000-000000000202", key: "routing_delay" }],
        triggerType: "API",
        actions: ["Read", "Notify"],
        outputs: ["routed_case"],
        businessImpact: 70,
        automationCoverage: 60,
        technicalFeasibility: 60,
        connectorAvailability: 50,
        automationReadiness: 60,
        complexity: 60,
        confidence: 70,
        implementationEffort: "medium",
        processIds: ["00000000-0000-4000-8000-000000000006"],
        departmentIds: [],
        systemIds: [],
        scores: [
          {
            definition: { id: "00000000-0000-4000-8000-000000000702" },
            score: 70,
            calculation: { source: "test" },
          },
        ],
      },
    ],
    validations: [
      { code: "automation_opportunities_valid", severity: "information", message: "Traceable" },
    ],
    catalogVersions: {},
  } as unknown as DetectionResult;
}
