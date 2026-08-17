import { describe, expect, it } from "vitest";
import type {
  AIInterpretationRequest,
  AIInterpretationResult,
  AIProvider,
} from "../../brain-evaluation/ai-interpretation-gateway";
import type { ExecutiveAuditResult } from "../executive-results/application/executive-result-model";
import {
  AskAutomateXService,
  ProductionExecutiveDecisionViewBuilder,
  type AskAutomateXReadModelPort,
} from "./index";

const tenantId = "tenant-a";
const companyId = "company-a";

describe("Ask AutomateX production wiring", () => {
  it("answers why-not-automate from the production decision-center projection", async () => {
    const service = new AskAutomateXService(readModelFrom([publishedResult()]));

    const response = await service.ask({
      tenantId,
      companyId,
      userId: "user-a",
      question: "Why shouldn't we automate exception approval?",
      context: { decisionCardId: "finding:finding-1" },
    });

    expect(response.authoritativeDecisionState).toBe("FIX_BEFORE_AUTOMATING");
    expect(response.answer).toContain("Do not automate before remediation");
    expect(response.supportingEvidence.map((item) => item.sourceId)).toContain("process-map-1");
    expect(response.traceability.brainRunId).toContain("production-reconstruction");
  });

  it("uses only current production economics for ROI questions", async () => {
    const response = await new AskAutomateXService(readModelFrom([publishedResult()])).ask({
      tenantId,
      companyId,
      userId: "user-a",
      question: "Is manual reconciliation worth automating?",
      context: { decisionCardId: "opportunity:opportunity-1" },
    });

    expect(response.economicState).toBe("ECONOMICALLY_JUSTIFIED");
    expect(response.answer).toContain("Benefit range: 24000 EUR");
    expect(response.answer).not.toContain("Benefit range: 0 EUR");
  });

  it("shows evidence labels from the current production projection", async () => {
    const response = await new AskAutomateXService(readModelFrom([publishedResult()])).ask({
      tenantId,
      companyId,
      userId: "user-a",
      question: "Show me the evidence.",
      context: { decisionCardId: "opportunity:opportunity-1" },
    });

    expect(response.supportingEvidence.map((item) => item.label)).toEqual([
      "process-map-1",
      "analysis-1",
      "automation-snapshot-1",
      "roi-1",
      "recommendation-portfolio-1",
    ]);
  });

  it("reloads the latest authoritative state for each top-level turn", async () => {
    const service = new AskAutomateXService(
      readModelFrom([publishedResult("Approval delay v1"), publishedResult("Approval delay v2")]),
    );

    const first = await service.ask({
      tenantId,
      companyId,
      userId: "user-a",
      question: "What is wrong?",
    });
    const second = await service.ask({
      tenantId,
      companyId,
      userId: "user-a",
      question: "What changed?",
      context: { previousIntent: first.intent, previousBrainRunId: first.traceability.brainRunId },
    });

    expect(first.answer).toContain("Approval delay v1");
    expect(second.answer).toContain("Approval delay v2");
  });

  it("does not become a generic chatbot for out-of-scope questions", async () => {
    const response = await new AskAutomateXService(readModelFrom([publishedResult()])).ask({
      tenantId,
      companyId,
      userId: "user-a",
      question: "What's the weather?",
    });

    expect(response.answerStatus).toBe("OUT_OF_SCOPE");
    expect(response.answer).toContain("only questions about this company audit");
  });

  it("does not invent strategy alternatives when no authoritative strategy source is wired", async () => {
    const response = await new AskAutomateXService(readModelFrom([publishedResult()])).ask({
      tenantId,
      companyId,
      userId: "user-a",
      question: "What other options exist?",
    });

    expect(response.answer).toContain(
      "Authoritative strategy alternatives are not yet available for this audit.",
    );
    expect(response.relevantStrategies).toHaveLength(0);
  });

  it("falls back deterministically when provider output fails integrity validation", async () => {
    const response = await new AskAutomateXService(
      readModelFrom([publishedResult()]),
      unsafeProvider(),
    ).ask({
      tenantId,
      companyId,
      userId: "user-a",
      question: "What's the ROI?",
      context: { decisionCardId: "opportunity:opportunity-1" },
    });

    expect(response.answerStatus).toBe("PROVIDER_FALLBACK");
    expect(response.providerMetadata).toBeNull();
    expect(response.answer).not.toContain("guaranteed 9.9x");
  });
});

function readModelFrom(results: readonly ExecutiveAuditResult[]): AskAutomateXReadModelPort {
  let index = 0;
  return {
    read: async () => {
      const result = results[Math.min(index, results.length - 1)];
      index += 1;
      const projection = new ProductionExecutiveDecisionViewBuilder().build({ tenantId, result });
      return projection.view ? { view: projection.view } : null;
    },
  };
}

function unsafeProvider(): AIProvider {
  return {
    providerId: "unsafe-fixture",
    interpret: async (request: AIInterpretationRequest): Promise<AIInterpretationResult> =>
      Object.freeze({
        requestId: request.requestId,
        provider: "unsafe-fixture",
        model: "unsafe-model",
        task: request.task,
        schemaVersion: request.schemaVersion,
        candidates: Object.freeze([
          {
            candidateId: "candidate:unsafe",
            candidateType: "SUMMARY" as const,
            statement: "This is guaranteed 9.9x ROI with no uncertainty.",
            sourceReference: request.sourceId,
            sourceExcerpt: "",
            confidenceHint: 1,
            rationale: "unsafe fixture",
            knowledgeReferences: [],
            status: "AI_DERIVED" as const,
            review: "REQUIRED" as const,
          },
        ]),
        sourceReferences: Object.freeze([request.sourceId]),
        warnings: Object.freeze([]),
        validationIssues: Object.freeze([]),
        createdAt: new Date("2026-01-01T00:00:00Z"),
      }),
  };
}

function publishedResult(findingTitle = "Invoice approval delay"): ExecutiveAuditResult {
  return {
    company: { id: companyId, name: "Pilot Company" },
    complete: true,
    audit: {
      company: { id: companyId, name: "Pilot Company" },
      overallStatus: "COMPLETED",
      currentStage: "COMPLETED",
      nextAction: "VIEW_RESULTS",
      blockingReason: null,
      stages: [
        {
          stage: "PROCESS_MAP",
          label: "Process Map",
          status: "COMPLETED",
          artifact: { id: "process-map-1", version: 1, status: "published" },
          candidateArtifacts: [],
          availableActions: [],
          blockingReason: null,
        },
      ],
    },
    overview: { processes: 1, findings: 1, opportunities: 1, recommendations: 1 },
    process: { id: "process-map-1", name: "Invoice handling" },
    findings: [
      {
        id: "finding-1",
        title: findingTitle,
        description: "Manual handoff creates waiting time before invoice processing.",
        severity: "high",
        impact: "Invoices wait before finance can reconcile them.",
      },
    ],
    opportunities: [
      {
        id: "opportunity-1",
        title: "Manual invoice reconciliation",
        problem: "Manual invoice reconciliation consumes finance capacity.",
        impact: 90,
        readiness: 85,
        confidence: 82,
      },
    ],
    roi: {
      id: "roi-1",
      currency: "EUR",
      evaluations: [
        {
          id: "roi-evaluation-1",
          title: "Invoice reconciliation ROI",
          annualBenefit: 24000,
          roi: 3.2,
          roiSpecialValue: null,
          payback: 4,
        },
      ],
    },
    recommendations: [
      {
        id: "recommendation-1",
        title: "Manual invoice reconciliation",
        action: "Approve a controlled invoice reconciliation automation design.",
        description: "Automate reconciliation after preserving approval controls.",
        priority: "high",
        phase: "Phase 1",
        expectedRoi: 3.2,
        roiSpecialValue: null,
        payback: 4,
        confidence: 82,
      },
    ],
    provenance: {
      processMapId: "process-map-1",
      analysisId: "analysis-1",
      automationOpportunitySnapshotId: "automation-snapshot-1",
      roiId: "roi-1",
      recommendationPortfolioId: "recommendation-portfolio-1",
    },
  };
}
