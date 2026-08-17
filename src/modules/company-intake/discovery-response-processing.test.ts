import { describe, expect, it } from "vitest";
import { DeterministicAIProvider } from "../../brain-evaluation/ai-interpretation-gateway";
import {
  DiscoveryResponseProcessor,
  type DiscoveryResponseProcessingResult,
  type ProductionResponse,
  type ResponseLineage,
} from "./index";
import type { AdaptiveDiscoveryPlan } from "./application/adaptive-discovery-production-bridge";
import type { RealCompanyBrainResult } from "./application/real-company-brain-orchestrator";

const response: ProductionResponse = {
  productionResponseId: "answer:1",
  type: "InterviewAnswer",
  tenantId: "tenant-a",
  companyId: "company-a",
  productionQuestionId: "question:1",
  questionText: "What is monthly volume?",
  rawAnswer: "I don't know.",
  actorId: "manager-1",
  sessionId: "session:1",
  capturedAt: new Date("2026-01-01T00:00:00Z"),
  reliability: 0.7,
  sourceReference: "interview:manager:answer:1",
};

const lineage: ResponseLineage = {
  tenantId: "tenant-a",
  companyId: "company-a",
  originalBrainRunId: "brain:old",
  actionId: "action:1",
  gapId: "gap:monthly-volume",
  questionIntent: {
    gapId: "gap:monthly-volume",
    targetSource: "MANAGER_INTERVIEW",
    businessConcept: "monthly volume",
    reason: "ROI is blocked",
    expectedEvidenceType: "METRIC",
    materiality: "HIGH",
    decisionBlocked: true,
    traceability: {
      companyId: "company-a",
      tenantId: "tenant-a",
      unknownIds: ["monthly-volume"],
      contradictionIds: [],
      evidenceIds: [],
      affectedDecisionIds: ["roi"],
    },
  },
  productionQuestionId: "question:1",
};

const plan: AdaptiveDiscoveryPlan = {
  companyId: "company-a",
  tenantId: "tenant-a",
  brainRunReference: "brain:new",
  contextReferences: {},
  materialGaps: [],
  recommendedActions: [],
  stoppingReason: "No gaps",
  readiness: {
    outcome: "READY_FOR_ANALYSIS",
    rationale: "No gaps",
    blockingGapIds: [],
    declaredUncertaintyGapIds: [],
  },
  remainingQuestionBudget: 10,
};

const brainResult = {
  companyId: "company-a",
  tenantId: "tenant-a",
  readiness: {} as never,
  sourceSnapshot: { companyId: "company-a" },
  evidence: { count: 1, ids: ["response:answer:1"] },
  brainEvidence: [],
  claims: [],
  whatWeKnow: [],
  whatWeBelieve: [],
  whatWeDoNotKnow: [],
  contradictions: [],
  processFindings: [],
  rootCauseHypotheses: [],
  bottlenecks: [],
  criticalIssues: [],
  detectedOpportunities: [],
  qualifiedOpportunities: [],
  deferredOpportunities: [],
  rejectedOpportunities: [],
  remediationRequired: [],
  economicState: {} as never,
  nextBestActions: [],
  traceReferences: {},
  brain: { scenarioId: "company:company-a" },
} as unknown as RealCompanyBrainResult;

function makePorts(overrides: Record<string, unknown> = {}) {
  const processed = new Map<string, DiscoveryResponseProcessingResult>();
  let knowledgeCalls = 0;
  return {
    knowledgeCalls: () => knowledgeCalls,
    production: {
      loadResponse: async () => response,
      loadLineage: async () => lineage,
      currentBrainRunId: async () => "brain:old",
      integrateKnowledge: async ({ evidence }: { evidence: readonly { id: string }[] }) => {
        knowledgeCalls += 1;
        return {
          previousKnowledgeSnapshotId: "knowledge:old",
          newKnowledgeSnapshotId: "knowledge:new",
          evidenceIds: evidence.map((item) => item.id),
          rawSourceId: response.productionResponseId,
        };
      },
      findProcessed: async (id: string) => processed.get(id) ?? null,
      saveProcessed: async (id: string, value: DiscoveryResponseProcessingResult) => {
        processed.set(id, value);
      },
      ...overrides,
    },
    aiProvider: new DeterministicAIProvider(),
    orchestrator: { run: async () => brainResult },
    discoveryBridge: { plan: async () => plan },
  };
}

describe("DiscoveryResponseProcessor", () => {
  it("preserves raw answer, integrates knowledge and reruns Brain", async () => {
    const ports = makePorts();
    const result = await new DiscoveryResponseProcessor(ports).process({
      tenantId: "tenant-a",
      companyId: "company-a",
      productionResponseId: "answer:1",
    });
    expect(result.rawAnswer).toBe("I don't know.");
    expect(result.knowledgeUpdate.newKnowledgeSnapshotId).toBe("knowledge:new");
    expect(result.newBrainRunId).toBe("company:company-a");
    expect(result.traceability.response).toEqual(["answer:1"]);
    expect(ports.knowledgeCalls()).toBe(1);
  });

  it("is idempotent and does not duplicate knowledge integration", async () => {
    const ports = makePorts();
    const processor = new DiscoveryResponseProcessor(ports);
    const first = await processor.process({
      tenantId: "tenant-a",
      companyId: "company-a",
      productionResponseId: "answer:1",
    });
    const second = await processor.process({
      tenantId: "tenant-a",
      companyId: "company-a",
      productionResponseId: "answer:1",
    });
    expect(second).toBe(first);
    expect(ports.knowledgeCalls()).toBe(1);
  });

  it("rejects cross-company responses before Knowledge or Brain", async () => {
    const ports = makePorts({
      loadResponse: async () => ({ ...response, companyId: "company-b" }),
    });
    await expect(
      new DiscoveryResponseProcessor(ports).process({
        tenantId: "tenant-a",
        companyId: "company-a",
        productionResponseId: "answer:1",
      }),
    ).rejects.toThrow("outside the requested company");
    expect(ports.knowledgeCalls()).toBe(0);
  });
});
