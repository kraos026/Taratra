import { describe, expect, it } from "vitest";
import { DeterministicAIProvider } from "../../brain-evaluation/ai-interpretation-gateway";
import { AdaptiveDiscoveryProductionBridge, RealCompanyBrainOrchestrator } from "./index";
import { UnknownInformation } from "../../brain-evaluation/brain-contracts";

const tenantId = "tenant-a";
const companyId = "company-a";

async function brainResult(
  unknowns = [
    UnknownInformation.create({
      unknownId: "unknown:monthly-volume",
      missingField: "monthly volume",
      domain: "economics",
      reason: "Monthly volume is missing",
      impact: "ROI qualification is blocked",
      requiredFor: ["roi"],
      priority: "HIGH",
      suggestedClarification: "Provide monthly volume from system data",
    }),
  ],
) {
  return new RealCompanyBrainOrchestrator({
    aiProvider: new DeterministicAIProvider(),
    load: async () => ({
      company: { id: companyId, name: "Services Co", organizationId: tenantId },
      readinessState: {
        company: { id: companyId, organizationId: tenantId },
        discovery: { exists: true, validated: true },
        interviews: { exists: true, completed: true },
        knowledgeSnapshot: { exists: true, validated: true },
        processMap: { exists: true, published: true },
      },
      sources: [],
      processMap: {
        id: "process:1",
        version: 1,
        status: "published" as const,
        name: "Order process",
        nodes: [{ id: "step:1", type: "step" as const, name: "Review" }],
      },
      knowledge: {
        relevantPatterns: [],
        relevantBenchmarks: [],
        relevantRules: [],
        relevantSolutions: [],
        relevantCapabilities: [],
        conflicts: [],
      },
      facts: [],
      unknowns,
      economicInputs: {},
    }),
  }).run({ tenantId, companyId });
}

describe("AdaptiveDiscoveryProductionBridge", () => {
  it("targets objective system evidence for economic gaps", async () => {
    const plan = await new AdaptiveDiscoveryProductionBridge().plan(await brainResult());
    expect(plan.recommendedActions[0]?.targetSource).toBe("SYSTEM_EVIDENCE");
    expect(plan.recommendedActions[0]?.questionIntent.decisionBlocked).toBe(true);
    expect(plan.recommendedActions[0]?.questionIntent.traceability.companyId).toBe(companyId);
  });

  it("deduplicates already asked questions and stops when no material gaps remain", async () => {
    const bridge = new AdaptiveDiscoveryProductionBridge();
    const first = await bridge.plan(await brainResult());
    const second = await bridge.plan(await brainResult(), {
      alreadyAskedQuestionIds: first.recommendedActions.map((action) => action.questionId),
    });
    expect(second.recommendedActions).toHaveLength(0);
    const sufficient = await bridge.plan(await brainResult([]));
    expect(sufficient.recommendedActions).toHaveLength(0);
    expect(sufficient.readiness.outcome).toBe("READY_FOR_ANALYSIS");
  });

  it("cannot let question rendering change the authoritative intent", async () => {
    const plan = await new AdaptiveDiscoveryProductionBridge().plan(await brainResult(), {
      renderQuestion: async () => "A renderer cannot change the target",
    });
    expect(plan.recommendedActions[0]?.questionIntent.expectedEvidenceType).toBe("METRIC");
    expect(plan.recommendedActions[0]?.naturalWording).toContain("renderer");
  });
});
