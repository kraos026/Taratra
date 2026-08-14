import { describe, expect, it } from "vitest";
import { SyntheticBrainEvaluationRunner } from "./brain-evaluator";
import { SyntheticEnterpriseGenerator, createScenarioLibrary } from "./synthetic-enterprise-lab";

const run = (seed: string) => {
  const entry = createScenarioLibrary().find((item) => item.seed === seed)!;
  const enterprise = new SyntheticEnterpriseGenerator().generate(seed, "v1", entry.profile);
  return new SyntheticBrainEvaluationRunner().run(enterprise);
};

describe("C4 opportunity lifecycle and actionability", () => {
  it("keeps an economically unknown candidate visible with next evidence", () => {
    const result = run("crm-erp-reentry");
    expect(result.opportunities).toHaveLength(1);
    expect(result.opportunities[0]?.status).toBe("ECONOMICALLY_UNQUALIFIED");
    expect(result.opportunityActions[0]?.action).toBe("INVESTIGATE");
    expect(result.opportunityActions[0]?.requiredEvidence).toContain(
      "economic inputs are incomplete",
    );
  });

  it("keeps broken data visible while prioritizing remediation", () => {
    const result = run("broken-master-data");
    expect(result.opportunities[0]?.candidateType).toBe("AUTOMATION");
    expect(result.opportunities[0]?.status).toBe("REMEDIATION_REQUIRED");
    expect(result.opportunityActions[0]?.action).toBe("REMEDIATE_FIRST");
    expect(result.opportunities[0]?.prerequisites.length).toBeGreaterThan(0);
  });

  it("keeps material contradictions visible and requests evidence", () => {
    const result = run("conflicting-volume");
    expect(result.opportunities).toHaveLength(1);
    expect(result.opportunities[0]?.status).toBe("UNDER_INVESTIGATION");
    expect(result.opportunityActions[0]?.action).toBe("INVESTIGATE");
    expect(result.decisionRobustness.contradictionResolution[0]?.state).toBe("UNRESOLVED_MATERIAL");
  });
});
