import { describe, expect, it } from "vitest";
import { BrainIntegrationPipeline } from "./brain-integration";
import { Evidence, Claim, Confidence } from "./brain-contracts";
import { Process, ProcessModel, ProcessStep } from "./process-causal";
import { KnowledgeContext } from "./knowledge-foundation";
const ev = (id: string) =>
  Evidence.create({
    evidenceId: id,
    sourceType: "OBSERVED",
    sourceReference: id,
    sourceModule: "brain_evaluation",
    capturedAt: new Date("2026-01-01"),
    freshness: "CURRENT",
    reliability: 0.9,
    content: "manual copy",
    provenance: {},
    tags: ["copy"],
  });
const claim = Claim.create({
  claimId: "claim:volume",
  kind: "FACT",
  statement: "volume is known",
  supportingEvidenceIds: ["e1"],
  confidence: Confidence.create(
    0.8,
    {
      supportingEvidenceCount: 1,
      averageSourceReliability: 0.9,
      sourceAgreement: 1,
      freshness: 1,
      directness: 1,
      contradictionPenalty: 0,
      missingDataPenalty: 0,
    },
    "observed",
  ),
  rationale: "evidence",
  createdByModule: "brain_evaluation",
  createdAt: new Date("2026-01-01"),
  lastEvaluatedAt: new Date("2026-01-01"),
});
const input = () => ({
  companyId: "company:1",
  scenarioId: "scenario:1",
  subject: "order re-entry",
  evidence: [ev("e1")],
  claims: [claim],
  unknowns: [],
  process: ProcessModel.create({
    process: Process.create({
      processId: "orders",
      name: "Orders",
      steps: [
        ProcessStep.create({
          stepId: "copy",
          name: "copy",
          processingMinutes: 5,
          waitingMinutes: 20,
        }),
      ],
    }),
  }),
  knowledge: {
    relevantPatterns: [],
    relevantBenchmarks: [],
    relevantRules: [],
    relevantSolutions: [],
    relevantCapabilities: [],
    conflicts: [],
  } as KnowledgeContext,
  economicInputs: {},
  facts: ["manual copy"],
});
describe("Brain integration M1", () => {
  it("executes a deterministic end-to-end flow", () => {
    const p = new BrainIntegrationPipeline();
    expect(p.run(input())).toEqual(p.run(input()));
  });
  it("preserves trace and hard uncertainty gates", () => {
    const result = new BrainIntegrationPipeline().run({
      ...input(),
      unknowns: [
        {
          unknownId: "unknown:api",
          missingField: "api",
          domain: "integration",
          reason: "unknown",
          impact: "feasibility",
          requiredFor: ["decision"],
          priority: "CRITICAL",
          suggestedClarification: "verify API",
        },
      ],
    });
    expect(result.evidenceSummary.count).toBe(1);
    expect(result.opportunityDecisions[0]?.decision.decision).toBe("NEED_MORE_EVIDENCE");
    expect(result.integrationScorecard.evidenceTraceCompleteness).toBe(1);
  });
});
