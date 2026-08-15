import { describe, expect, it } from "vitest";
import { DeterministicAIProvider } from "../../brain-evaluation/ai-interpretation-gateway";
import { UnknownInformation } from "../../brain-evaluation/brain-contracts";
import { RealCompanyBrainOrchestrator, type RealCompanyProductionSnapshot } from "./index";

const tenantId = "tenant-a";
const companyId = "company-a";

function snapshot(
  overrides: Partial<RealCompanyProductionSnapshot> = {},
): RealCompanyProductionSnapshot {
  return {
    company: { id: companyId, name: "Services Co", organizationId: tenantId },
    readinessState: {
      company: { id: companyId, organizationId: tenantId },
      discovery: { exists: true, validated: true },
      interviews: { exists: true, completed: true },
      knowledgeSnapshot: { exists: true, validated: true },
      processMap: { exists: true, published: true },
    },
    sources: [
      {
        id: "interview:manager",
        sourceType: "INTERVIEW",
        sourceReference: "interview:manager",
        content: "Operations reports a bottleneck.",
        rawText: "Operations reports a bottleneck.",
        capturedAt: new Date("2026-01-01T00:00:00Z"),
        reliability: 0.8,
        provenance: { sessionId: "interview-1" },
        interpreted: false,
        sessionId: "interview-1",
        tenantId,
        companyId,
      },
    ],
    processMap: {
      id: "process:published",
      version: 1,
      status: "published",
      name: "Order handling",
      nodes: [
        { id: "step:1", type: "step", name: "Review order", actor: "manager" },
        { id: "step:2", type: "step", name: "Approve order", actor: "manager" },
      ],
      edges: [{ id: "edge:1", from: "step:1", to: "step:2", type: "transfers" }],
    },
    knowledge: {
      relevantPatterns: [],
      relevantBenchmarks: [],
      relevantRules: [],
      relevantSolutions: [],
      relevantCapabilities: [],
      conflicts: [],
    },
    facts: ["A manager review exists"],
    unknowns: [
      UnknownInformation.create({
        unknownId: "unknown:volume",
        missingField: "order volume",
        domain: "economics",
        reason: "No production metric was supplied",
        impact: "ROI cannot be finalized",
        requiredFor: ["ROI"],
        priority: "HIGH",
        suggestedClarification: "Provide monthly order volume",
      }),
    ],
    economicInputs: {},
    ...overrides,
  };
}

describe("RealCompanyBrainOrchestrator", () => {
  it("runs canonical production state through E3, adapters and Brain", async () => {
    const orchestrator = new RealCompanyBrainOrchestrator({
      aiProvider: new DeterministicAIProvider(),
      load: async () => snapshot(),
    });
    const result = await orchestrator.run({ tenantId, companyId });
    expect(result.readiness.status).toBe("READY_FOR_BRAIN");
    expect(result.brain.companyId).toBe(companyId);
    expect(result.evidence.count).toBeGreaterThan(0);
    expect(result.whatWeDoNotKnow).toHaveLength(1);
    expect(result.traceReferences.processMap).toEqual(["process:published"]);
    expect(result.claims.every((claim) => claim.kind !== "FACT")).toBe(true);
  });

  it("rejects evidence from another company", async () => {
    const foreign = snapshot({
      sources: [
        {
          ...snapshot().sources[0],
          companyId: "company-b",
        },
      ],
    });
    const orchestrator = new RealCompanyBrainOrchestrator({ load: async () => foreign });
    await expect(orchestrator.run({ tenantId, companyId })).rejects.toThrow(
      "Source is outside the requested company",
    );
  });

  it("does not project a draft process map", async () => {
    const draft = snapshot({
      readinessState: {
        ...snapshot().readinessState,
        processMap: { exists: true, published: false },
      },
    });
    const orchestrator = new RealCompanyBrainOrchestrator({ load: async () => draft });
    const result = await orchestrator.run({ tenantId, companyId });
    expect(result.readiness.status).toBe("PARTIALLY_READY");
    expect(result.nextBestActions).toContain("published process map");
  });
});
